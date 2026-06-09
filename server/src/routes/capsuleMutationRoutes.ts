import { logError } from "../logger.js";
import { registerCapsulePdfRoute } from "./capsulePdfRoute.js";

function isObjectPayload(body) {
  return Boolean(body) && typeof body === "object" && !Array.isArray(body);
}

// eslint-disable-next-line max-lines-per-function
function registerCapsuleCreateRoutes(app, context) {
  const { hasOwnProperty, requireTrustedOrigin, requireAuth, requireCsrf } =
    context;

  app.post(
    "/capsules",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    // eslint-disable-next-line complexity
    async (req, res) => {
      if (
        !isObjectPayload(req.body) ||
        context.hasUnexpectedCapsuleCreateFields(req.body)
      ) {
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
        if (
          error?.code === "invalid_payload" ||
          error?.message === "invalid_payload"
        ) {
          return res.status(400).json({ error: "invalid_payload" });
        }
        logError("[capsules/create]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.patch(
    "/capsules/:id/filters",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    // eslint-disable-next-line complexity
    async (req, res) => {
      if (
        !isObjectPayload(req.body) ||
        context.hasUnexpectedCapsuleFiltersFields(req.body) ||
        !hasOwnProperty(req.body, "filters")
      ) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
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
        const nextDraft = {
          filters: normalizedFilters,
          data: { wardrobe: null, rejectedUrls: [] },
        };
        const capsule = await context.updateCapsuleSnapshotImpl(
          req.user.email,
          req.params.id,
          nextDraft,
        );
        if (!capsule) {
          return res.status(404).json({ error: "not_found" });
        }

        if (context.isTruthyQueryFlag(req.query?.regenerate)) {
          return context.regenerateCapsuleWardrobeHandler(req, res);
        }

        return sendCapsuleMutationResponse(req, res, capsule, context);
      } catch (error) {
        if (
          error?.code === "invalid_payload" ||
          error?.message === "invalid_payload"
        ) {
          return res.status(400).json({ error: "invalid_payload" });
        }
        logError("[capsules/filters]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
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

async function buildAnnotatedCapsuleResponse(capsule, req, context) {
  const likedUrls = await context.listLikedItemUrlsImpl(req.user.email);
  return context.annotateLikedItems(
    context.toCapsuleResponse(capsule),
    likedUrls,
  );
}

async function sendCapsuleMutationResponse(req, res, capsule, context) {
  if (!capsule) {
    return res.status(404).json({ error: "not_found" });
  }

  return res.json({
    ok: true,
    capsule: await buildAnnotatedCapsuleResponse(capsule, req, context),
  });
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

function registerCapsuleStateRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/capsules/:id/save",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const capsule = await context.saveCapsuleImpl(
          req.user.email,
          req.params.id,
        );
        return sendCapsuleMutationResponse(req, res, capsule, context);
      } catch (error) {
        logError("[capsules/save]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.post(
    "/capsules/:id/revert",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const capsule = await context.revertCapsuleImpl(
          req.user.email,
          req.params.id,
        );
        return sendCapsuleMutationResponse(req, res, capsule, context);
      } catch (error) {
        logError("[capsules/revert]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerCapsuleMetadataRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.patch(
    "/capsules/:id/rename",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const name = String(req.body?.name || "").trim();
        if (!name) {
          return res.status(400).json({ error: "invalid_payload" });
        }
        const capsule = await context.renameCapsuleImpl(
          req.user.email,
          req.params.id,
          name,
        );
        return sendCapsuleMutationResponse(req, res, capsule, context);
      } catch (error) {
        logError("[capsules/rename]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.post(
    "/capsules/:id/duplicate",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const capsule = await context.duplicateCapsuleImpl(
          req.user.email,
          req.params.id,
          String(req.body?.name || "").trim() || undefined,
        );
        if (!capsule) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.status(201).json({
          ok: true,
          capsule: await buildAnnotatedCapsuleResponse(capsule, req, context),
        });
      } catch (error) {
        logError("[capsules/duplicate]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerCapsuleSelectionRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/capsules/:id/select",
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
        return res.json({
          ok: true,
          capsuleId: capsule.id,
        });
      } catch (error) {
        logError("[capsules/select]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.delete(
    "/capsules/:id",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const deleted = await context.deleteCapsuleImpl(
          req.user.email,
          req.params.id,
        );
        if (!deleted) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ ok: true });
      } catch (error) {
        logError("[capsules/delete]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

export function registerCapsuleMutationRoutes(app, context) {
  registerCapsuleCreateRoutes(app, context);
  registerRejectedUrlRoute(app, context);
  registerCapsuleStateRoutes(app, context);
  registerCapsuleMetadataRoutes(app, context);
  registerCapsuleSelectionRoutes(app, context);
  registerCapsulePdfRoute(app, context);
}
