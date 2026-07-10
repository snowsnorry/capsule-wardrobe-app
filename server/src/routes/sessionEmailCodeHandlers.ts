import {
  CODE_TTL_MS,
  MAX_CODE_SENDS_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} from "../authStore.js";
import { SUPPORTED_LOCALES } from "../appConfig.js";
import { setCsrfCookie, setSessionCookie } from "../httpCookies.js";
import { logError, logInfo } from "../logger.js";

export function createRequestCodeHandler({
  authTestMode,
  createPendingCodeImpl,
  sendLoginCodeEmailImpl,
}) {
  return async (req, res) => {
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
      logError("auth.code.request.failed", error);
      return res.status(503).json({ error: "service_unavailable" });
    }

    const blockedResponse = sendCodeBlockedResponse(res, result);
    if (blockedResponse) {
      return blockedResponse;
    }

    if (authTestMode) {
      return sendAuthTestModeCodeResponse(res, email, result.code);
    }

    try {
      await sendLoginCodeEmailImpl({
        email,
        code: result.code,
        locale: emailLocale,
        expiresInMs: CODE_TTL_MS,
      });
    } catch (error) {
      logError("auth.code.email.send.failed", error);
      return res.status(503).json({ error: "email_unavailable" });
    }
    return res.json({ ok: true, expiresInMs: CODE_TTL_MS });
  };
}

export function createVerifyCodeHandler({
  createSessionImpl,
  nodeEnv,
  verifyCodeImpl,
}) {
  return async (req, res) => {
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
      logError("auth.code.verify.failed", error);
      return res.status(503).json({ error: "service_unavailable" });
    }

    const invalidCodeResponse = verifyCodeFailureResponse(res, result);
    if (invalidCodeResponse) {
      return invalidCodeResponse;
    }

    return createVerifiedCodeSession({
      createSessionImpl,
      email,
      nodeEnv,
      res,
    });
  };
}

async function createVerifiedCodeSession({
  createSessionImpl,
  email,
  nodeEnv,
  res,
}) {
  try {
    const { sessionId, session } = await createSessionImpl(email);
    setSessionCookie(res, sessionId, nodeEnv);
    setCsrfCookie(res, session.csrfToken, nodeEnv);
    return res.json({ ok: true, user: { email: session.email } });
  } catch (error) {
    logError("auth.session.create.failed", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
}

function sendAuthTestModeCodeResponse(res, email, code) {
  const expiresInMinutes = Math.max(1, Math.ceil(CODE_TTL_MS / (60 * 1000)));
  logInfo("auth.test.code.issued", { email, code, expiresInMinutes });
  return res.json({ ok: true, expiresInMs: CODE_TTL_MS });
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
