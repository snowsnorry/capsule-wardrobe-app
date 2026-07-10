import { logError } from "../logger.js";

export function registerPasskeyDeleteRoute(app, context) {
  const {
    deletePasskeyByIdForEmailImpl,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
  } = context;

  app.delete(
    "/auth/passkeys/:id",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      const passkeyId = String(req.params?.id || "").trim();
      if (!passkeyId) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const deleted = await deletePasskeyByIdForEmailImpl({
          email: req.user.email,
          passkeyId,
        });
        if (!deleted) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ ok: true });
      } catch (error) {
        logError("auth.passkeys.delete.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}
