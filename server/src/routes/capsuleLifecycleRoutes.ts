import { logError } from "../logger.js";
import {
  buildAnnotatedCapsuleResponse,
  sendCapsuleMutationResponse,
} from "./capsuleRouteResponses.js";

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
        logError("capsule.save.failed", error);
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
        logError("capsule.revert.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerCapsuleMetadataRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.patch(
    "/capsules/:id/pin",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        if (typeof req.body?.pin !== "boolean") {
          return res.status(400).json({ error: "invalid_payload" });
        }
        const capsule = await context.setCapsulePinImpl(
          req.user.email,
          req.params.id,
          req.body.pin,
        );
        return sendCapsuleMutationResponse(req, res, capsule, context);
      } catch (error) {
        logError("capsule.pin.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

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
        logError("capsule.rename.failed", error);
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
        logError("capsule.duplicate.failed", error);
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
        logError("capsule.select.failed", error);
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
        logError("capsule.delete.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerCapsuleLifecycleRoutes(app, context) {
  registerCapsuleStateRoutes(app, context);
  registerCapsuleMetadataRoutes(app, context);
  registerCapsuleSelectionRoutes(app, context);
}

export { registerCapsuleLifecycleRoutes };
