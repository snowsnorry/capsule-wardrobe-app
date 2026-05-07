import {
  CODE_TTL_MS,
  MAX_CODE_SENDS_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} from "../authStore.js";
import { GOOGLE_CLIENT_ID, SUPPORTED_LOCALES } from "../appConfig.js";
import {
  clearSessionCookie,
  setCsrfCookie,
  setSessionCookie,
} from "../httpCookies.js";
import { logError, logInfo } from "../logger.js";

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

  app.post("/auth/request-code", requestCodeLimiter, async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const locale = String(req.body?.locale || "")
      .trim()
      .toLowerCase();
    const emailLocale = SUPPORTED_LOCALES.has(locale) ? locale : "en";
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "invalid_email" });
    }

    let result;
    try {
      result = await createPendingCodeImpl(email);
    } catch (error) {
      logError("[auth/request-code]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }

    const blockedResponse = sendCodeBlockedResponse(res, result);
    if (blockedResponse) {
      return blockedResponse;
    }

    if (authTestMode) {
      const expiresInMinutes = Math.max(
        1,
        Math.ceil(CODE_TTL_MS / (60 * 1000)),
      );
      logInfo(
        `[auth/test-mode] Sign-in code for ${email}: ${result.code} (expires in ${expiresInMinutes} minute(s))`,
      );
      return res.json({ ok: true, expiresInMs: CODE_TTL_MS });
    }

    try {
      await sendLoginCodeEmailImpl({
        email,
        code: result.code,
        locale: emailLocale,
        expiresInMs: CODE_TTL_MS,
      });
    } catch (error) {
      logError("[auth/send-code-email]", error);
      return res.status(503).json({ error: "email_unavailable" });
    }
    return res.json({ ok: true, expiresInMs: CODE_TTL_MS });
  });

  app.post(
    "/auth/verify-code",
    requireTrustedOrigin,
    verifyCodeLimiter,
    async (req, res) => {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const code = String(req.body?.code || "").trim();
      if (!email || !code) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      let result;
      try {
        result = await verifyCodeImpl(email, code);
      } catch (error) {
        logError("[auth/verify-code]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }

      const invalidCodeResponse = verifyCodeFailureResponse(res, result);
      if (invalidCodeResponse) {
        return invalidCodeResponse;
      }

      let created;
      try {
        created = await createSessionImpl(email);
      } catch (error) {
        logError("[auth/create-session]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }

      const { sessionId, session } = created;
      setSessionCookie(res, sessionId, nodeEnv);
      setCsrfCookie(res, session.csrfToken, nodeEnv);
      return res.json({ ok: true, user: { email: session.email } });
    },
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
      logError("[auth/google-verify]", error);
      return res.status(401).json({ error: "invalid_google_token" });
    }

    try {
      const { sessionId, session } = await createSessionImpl(email);
      setSessionCookie(res, sessionId, nodeEnv);
      setCsrfCookie(res, session.csrfToken, nodeEnv);
      return res.json({ ok: true, user: { email } });
    } catch (error) {
      logError("[auth/google-create-session]", error);
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
        logError("[auth/logout]", error);
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

function sendCodeBlockedResponse(res, result) {
  if (result.ok) {
    return null;
  }
  if (result.reason === "cooldown") {
    return res
      .status(429)
      .json({ error: "cooldown", retryAfterMs: RESEND_COOLDOWN_MS });
  }
  return result.reason === "rate_limit"
    ? res
        .status(429)
        .json({ error: "rate_limit", maxPerHour: MAX_CODE_SENDS_PER_HOUR })
    : null;
}

function verifyCodeFailureResponse(res, result) {
  if (result.ok) {
    return null;
  }
  if (result.reason === "expired") {
    return res.status(400).json({ error: "expired" });
  }
  return result.reason === "max_attempts"
    ? res
        .status(429)
        .json({ error: "max_attempts", maxAttempts: MAX_VERIFY_ATTEMPTS })
    : res.status(400).json({ error: "invalid" });
}
