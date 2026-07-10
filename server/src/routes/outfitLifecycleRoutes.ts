import { logError } from "../logger.js";
import {
  buildAnnotatedOutfitResponse,
  sendOutfitMutationResponse,
} from "./outfitRouteResponses.js";

function registerOutfitStateRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/outfits/:id/save",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.saveOutfitImpl(
          req.user.email,
          req.params.id,
        );
        return sendOutfitMutationResponse(req, res, outfit, context);
      } catch (error) {
        logError("outfit.save.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.post(
    "/outfits/:id/revert",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.revertOutfitImpl(
          req.user.email,
          req.params.id,
        );
        return sendOutfitMutationResponse(req, res, outfit, context);
      } catch (error) {
        logError("outfit.revert.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerOutfitMetadataRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.patch(
    "/outfits/:id/pin",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        if (typeof req.body?.pin !== "boolean") {
          return res.status(400).json({ error: "invalid_payload" });
        }
        const outfit = await context.setOutfitPinImpl(
          req.user.email,
          req.params.id,
          req.body.pin,
        );
        return sendOutfitMutationResponse(req, res, outfit, context);
      } catch (error) {
        logError("outfit.pin.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.patch(
    "/outfits/:id/rename",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const name = String(req.body?.name || "").trim();
        if (!name) {
          return res.status(400).json({ error: "invalid_payload" });
        }
        const outfit = await context.renameOutfitImpl(
          req.user.email,
          req.params.id,
          name,
        );
        return sendOutfitMutationResponse(req, res, outfit, context);
      } catch (error) {
        logError("outfit.rename.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.post(
    "/outfits/:id/duplicate",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.duplicateOutfitImpl(
          req.user.email,
          req.params.id,
          String(req.body?.name || "").trim() || undefined,
        );
        if (!outfit) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.status(201).json({
          ok: true,
          outfit: await buildAnnotatedOutfitResponse(outfit, req, context),
        });
      } catch (error) {
        logError("outfit.duplicate.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerOutfitSelectionRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/outfits/:id/select",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.getOutfitImpl(
          req.user.email,
          req.params.id,
        );
        if (!outfit) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ ok: true, outfitId: outfit.id });
      } catch (error) {
        logError("outfit.select.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.delete(
    "/outfits/:id",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const deleted = await context.deleteOutfitImpl(
          req.user.email,
          req.params.id,
        );
        if (!deleted) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ ok: true });
      } catch (error) {
        logError("outfit.delete.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerOutfitLifecycleRoutes(app, context) {
  registerOutfitStateRoutes(app, context);
  registerOutfitMetadataRoutes(app, context);
  registerOutfitSelectionRoutes(app, context);
}

export { registerOutfitLifecycleRoutes };
