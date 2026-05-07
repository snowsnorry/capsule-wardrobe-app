import { logError } from "../logger.js";
import { registerCapsulePdfRoute } from "./capsulePdfRoute.js";

function isObjectPayload(body) {
  return Boolean(body) && typeof body === "object" && !Array.isArray(body);
}

function registerCapsuleCreateRoutes(app, context) {
  const { hasOwnProperty, requireTrustedOrigin, requireAuth, requireCsrf } =
    context;

  app.post(
    "/capsules",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      if (
        !isObjectPayload(req.body) ||
        context.hasUnexpectedCapsuleCreateFields(req.body)
      ) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const profile = await context.getProfileImpl(req.user.email);
        const capsule = await context.createCapsuleImpl(req.user.email, {
          name: String(req.body?.name || "").trim() || undefined,
          draft: context.buildCapsuleDraftFromFilters(
            profile,
            req.body?.filters,
          ),
          saved: null,
          setActive: true,
        });
        return res
          .status(201)
          .json({ ok: true, capsule: context.toCapsuleResponse(capsule) });
      } catch (error) {
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
    async (req, res) => {
      if (
        !isObjectPayload(req.body) ||
        context.hasUnexpectedCapsuleFiltersFields(req.body) ||
        !hasOwnProperty(req.body, "filters")
      ) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const nextDraft = {
          filters: context.normalizeCapsuleSnapshot({
            filters: req.body?.filters,
          })?.filters,
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

        return res.json({
          ok: true,
          capsule: context.toCapsuleResponse(capsule),
        });
      } catch (error) {
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

function sendCapsuleMutationResponse(res, capsule, context) {
  if (!capsule) {
    return res.status(404).json({ error: "not_found" });
  }

  return res.json({ ok: true, capsule: context.toCapsuleResponse(capsule) });
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

    return sendCapsuleMutationResponse(res, nextCapsule, context);
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
        return capsule
          ? res.json({ ok: true, capsule: context.toCapsuleResponse(capsule) })
          : res.status(404).json({ error: "not_found" });
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
        return capsule
          ? res.json({ ok: true, capsule: context.toCapsuleResponse(capsule) })
          : res.status(404).json({ error: "not_found" });
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
        return capsule
          ? res.json({ ok: true, capsule: context.toCapsuleResponse(capsule) })
          : res.status(404).json({ error: "not_found" });
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
        return capsule
          ? res
              .status(201)
              .json({ ok: true, capsule: context.toCapsuleResponse(capsule) })
          : res.status(404).json({ error: "not_found" });
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
        const profile = await context.updateProfileActiveCapsuleIdImpl(
          req.user.email,
          capsule.id,
        );
        return res.json({
          ok: true,
          activeCapsuleId: profile?.activeCapsuleId || capsule.id,
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
        const activeCapsule = await context.resolveActiveCapsuleImpl(
          req.user.email,
        );
        return res.json({
          ok: true,
          activeCapsule: context.toCapsuleResponse(activeCapsule),
        });
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
