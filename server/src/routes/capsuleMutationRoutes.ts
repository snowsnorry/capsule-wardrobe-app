import { logError } from "../logger.js";
import { hashCapsuleContent } from "../db.js";
import { getEffectiveCapsuleSnapshot } from "../capsuleStore.js";
import { enqueueRouteJob, sendQueuedJob } from "./jobRouteResponses.js";
import { registerCapsuleLifecycleRoutes } from "./capsuleLifecycleRoutes.js";
import { registerCapsulePdfRoute } from "./capsulePdfRoute.js";
import {
  buildAnnotatedCapsuleResponse,
  sendCapsuleMutationResponse,
} from "./capsuleRouteResponses.js";

function isObjectPayload(body) {
  return Boolean(body) && typeof body === "object" && !Array.isArray(body);
}

function isInvalidCapsuleCreatePayload(body, context) {
  return (
    !isObjectPayload(body) || context.hasUnexpectedCapsuleCreateFields(body)
  );
}

function isInvalidCapsuleFiltersPayload(body, context) {
  const { hasOwnProperty: ownsProperty } = context;
  return (
    !isObjectPayload(body) ||
    context.hasUnexpectedCapsuleFiltersFields(body) ||
    !ownsProperty(body, "filters")
  );
}

function isInvalidPayloadError(error) {
  return (
    error?.code === "invalid_payload" || error?.message === "invalid_payload"
  );
}

function buildCapsuleGenerateDedupeKey(capsuleId, capsule) {
  return `capsuleGenerate:${capsuleId}:${hashCapsuleContent(
    getEffectiveCapsuleSnapshot(capsule),
  )}`;
}

async function handleCapsuleCreate(req, res, context) {
  if (isInvalidCapsuleCreatePayload(req.body, context)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await context.getProfileImpl(req.user.email);
    const draft = context.buildCapsuleDraftFromFilters(
      profile,
      req.body?.filters,
    );
    const anchors = await context.validateCapsuleAnchorItemsImpl(
      req.user.email,
      draft?.filters?.anchorItemRefs,
    );
    draft.filters.anchorItemRefs = anchors.anchorItemRefs || [];
    const capsule = await context.createCapsuleImpl(req.user.email, {
      name: String(req.body?.name || "").trim() || undefined,
      draft,
      saved: null,
    });
    return res.status(201).json({
      ok: true,
      capsule: await buildAnnotatedCapsuleResponse(capsule, req, context),
    });
  } catch (error) {
    if (isInvalidPayloadError(error)) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    logError("[capsules/create]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
}

async function buildCapsuleFiltersDraft(req, context) {
  const normalizedFilters = context.normalizeCapsuleSnapshot({
    filters: req.body?.filters,
  })?.filters;
  const anchors = await context.validateCapsuleAnchorItemsImpl(
    req.user.email,
    normalizedFilters?.anchorItemRefs,
  );
  if (normalizedFilters) {
    normalizedFilters.anchorItemRefs = anchors.anchorItemRefs || [];
  }
  return {
    filters: normalizedFilters,
    data: { wardrobe: null, rejectedUrls: [] },
  };
}

async function handleCapsuleFiltersUpdate(req, res, context) {
  if (isInvalidCapsuleFiltersPayload(req.body, context)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const capsule = await context.updateCapsuleSnapshotImpl(
      req.user.email,
      req.params.id,
      await buildCapsuleFiltersDraft(req, context),
    );
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }

    if (context.isTruthyQueryFlag(req.query?.regenerate)) {
      const job = await enqueueRouteJob(context, {
        kind: "capsuleGenerate",
        profileEmail: req.user.email,
        entity: { type: "capsule", id: String(req.params.id || "") },
        dedupeKey: buildCapsuleGenerateDedupeKey(req.params.id, capsule),
        phase: "queued",
        payload: { capsuleId: req.params.id },
        progressLabel: "Generating capsule",
      });
      return sendQueuedJob(res, job);
    }

    return sendCapsuleMutationResponse(req, res, capsule, context);
  } catch (error) {
    if (isInvalidPayloadError(error)) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    logError("[capsules/filters]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
}

function registerCapsuleCreateRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/capsules",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    (req, res) => handleCapsuleCreate(req, res, context),
  );

  app.patch(
    "/capsules/:id/filters",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    (req, res) => handleCapsuleFiltersUpdate(req, res, context),
  );
}

function getRejectedUrlsPayloadError(body, context) {
  const { hasOwnProperty } = context;
  if (
    !isObjectPayload(body) ||
    context.hasUnexpectedRejectedUrlsFields(body) ||
    !hasOwnProperty(body, "rejectedUrls")
  ) {
    return "invalid_payload";
  }

  return null;
}

function getRejectedUrlsValidationResponse(validationResult) {
  if (!validationResult || !("error" in validationResult)) {
    return null;
  }

  return validationResult.error === "not_found"
    ? { status: 404, error: "not_found" }
    : { status: 400, error: "invalid_payload" };
}

function getCapsuleReportErrorStatus(error) {
  switch (error?.code) {
    case "invalid_payload":
      return 400;
    case "not_found":
      return 404;
    default:
      return 503;
  }
}

function registerCapsuleReportRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/capsules/:id/report",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const capsule = await context.getCapsuleImpl(
          req.user.email,
          req.params.id,
        );
        if (!capsule) {
          return res.status(404).json({ error: "not_found" });
        }
        const job = await enqueueRouteJob(context, {
          kind: "capsuleReportGenerate",
          profileEmail: req.user.email,
          entity: { type: "capsule", id: String(req.params.id || "") },
          dedupeKey: `capsuleReport:${req.params.id}`,
          phase: "queued",
          payload: { capsuleId: req.params.id },
          progressLabel: "Generating capsule report",
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        const status = getCapsuleReportErrorStatus(error);
        if (status === 503) {
          logError("[capsules/report]", error);
        }
        return res
          .status(status)
          .json({ error: status === 503 ? "service_unavailable" : error.code });
      }
    },
  );

  app.delete(
    "/capsules/:id/report",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const capsule = await context.updateCapsuleReportImpl(
          req.user.email,
          req.params.id,
          null,
        );
        return sendCapsuleMutationResponse(req, res, capsule, context);
      } catch (error) {
        logError("[capsules/report/delete]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function buildCapsuleReportSnapshotPatch(snapshot) {
  return Object.prototype.hasOwnProperty.call(snapshot || {}, "report")
    ? { report: snapshot.report || null }
    : {};
}

async function updateRejectedUrls(req, res, context) {
  if (getRejectedUrlsPayloadError(req.body, context)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const capsule = await context.getCapsuleImpl(req.user.email, req.params.id);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }

    const validationResult = context.getValidatedRejectedUrls(
      capsule,
      req.body?.rejectedUrls,
    );
    const validationResponse =
      getRejectedUrlsValidationResponse(validationResult);
    if (validationResponse) {
      return res
        .status(validationResponse.status)
        .json({ error: validationResponse.error });
    }

    const effectiveSnapshot = context.getEffectiveCapsuleSnapshot(capsule);
    const nextCapsule = await context.updateCapsuleSnapshotImpl(
      req.user.email,
      req.params.id,
      {
        filters: effectiveSnapshot?.filters,
        data: {
          wardrobe: effectiveSnapshot?.data?.wardrobe || null,
          rejectedUrls:
            validationResult && "rejectedUrls" in validationResult
              ? validationResult.rejectedUrls
              : [],
        },
        ...buildCapsuleReportSnapshotPatch(effectiveSnapshot),
      },
    );

    return sendCapsuleMutationResponse(req, res, nextCapsule, context);
  } catch (error) {
    logError("[capsules/rejected-urls]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
}

function registerRejectedUrlRoute(app, context) {
  app.patch(
    "/capsules/:id/rejected-urls",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    (req, res) => updateRejectedUrls(req, res, context),
  );
}

export function registerCapsuleMutationRoutes(app, context) {
  registerCapsuleCreateRoutes(app, context);
  registerRejectedUrlRoute(app, context);
  registerCapsuleReportRoutes(app, context);
  registerCapsuleLifecycleRoutes(app, context);
  registerCapsulePdfRoute(app, context);
}
