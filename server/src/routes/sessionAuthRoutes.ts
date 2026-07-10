import { GOOGLE_CLIENT_ID } from "../appConfig.js";
import {
  clearSessionCookie,
  setCsrfCookie,
  setSessionCookie,
} from "../httpCookies.js";
import { logError } from "../logger.js";
import {
  createRequestCodeHandler,
  createVerifyCodeHandler,
} from "./sessionEmailCodeHandlers.js";

export function registerSessionAuthRoutes(app, context) {
  registerEmailCodeRoutes(app, context);
  registerGoogleAuthRoute(app, context);
  registerSessionLifecycleRoutes(app, context);
}

function registerEmailCodeRoutes(app, context) {
  const {
    authTestMode,
    createPendingCodeImpl,
    createSessionImpl,
    nodeEnv,
    requireTrustedOrigin,
    requestCodeLimiter,
    sendLoginCodeEmailImpl,
    verifyCodeImpl,
    verifyCodeLimiter,
  } = context;

  app.post(
    "/auth/request-code",
    requestCodeLimiter,
    createRequestCodeHandler({
      authTestMode,
      createPendingCodeImpl,
      sendLoginCodeEmailImpl,
    }),
  );

  app.post(
    "/auth/verify-code",
    requireTrustedOrigin,
    verifyCodeLimiter,
    createVerifyCodeHandler({ createSessionImpl, nodeEnv, verifyCodeImpl }),
  );
}

function registerGoogleAuthRoute(app, context) {
  const { createSessionImpl, googleAuthClient, nodeEnv, requireTrustedOrigin } =
    context;

  app.post("/auth/google", requireTrustedOrigin, async (req, res) => {
    const idToken = String(req.body?.idToken || "").trim();
    if (!idToken) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    if (!googleAuthClient) {
      return res.status(503).json({ error: "google_auth_not_configured" });
    }

    let email: string;
    try {
      const ticket = await googleAuthClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.email_verified) {
        return res.status(401).json({ error: "invalid_google_token" });
      }
      email = payload.email.trim().toLowerCase();
    } catch (error) {
      logError("auth.google.verify.failed", error);
      return res.status(401).json({ error: "invalid_google_token" });
    }

    try {
      const { sessionId, session } = await createSessionImpl(email);
      setSessionCookie(res, sessionId, nodeEnv);
      setCsrfCookie(res, session.csrfToken, nodeEnv);
      return res.json({ ok: true, user: { email } });
    } catch (error) {
      logError("auth.google.session.create.failed", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

function registerSessionLifecycleRoutes(app, context) {
  const {
    nodeEnv,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
    revokeSessionImpl,
  } = context;

  app.post(
    "/auth/logout",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        await revokeSessionImpl(req.auth.sessionId);
      } catch (error) {
        logError("auth.logout.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
      clearSessionCookie(res, nodeEnv);
      return res.json({ ok: true });
    },
  );

  app.get("/auth/me", requireAuth, (req, res) => {
    res.json({ ok: true, user: req.user });
  });
}
