import crypto from "node:crypto";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  isTrustedOrigin,
  parseCookies,
  readCsrfHeader,
} from "./httpCookies.js";
import { logError, logWarn, runWithRequestLogContext } from "./logger.js";
import {
  recordHttpRequestMetric,
  recordRejectionMetric,
} from "./observabilityMetrics.js";

type SecurityMiddlewareOptions = {
  clientOrigin?: string;
  mcpOAuthIssuer?: string;
};

const REQUEST_ID_HEADER = "X-Request-Id";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SLOW_REQUEST_THRESHOLD_MS = 1_000;

function resolveRequestId(req): string {
  const headerValue = req.get?.(REQUEST_ID_HEADER);
  const requestId = String(
    Array.isArray(headerValue) ? headerValue[0] : headerValue || "",
  ).trim();
  return REQUEST_ID_PATTERN.test(requestId) ? requestId : crypto.randomUUID();
}

export function getHttpRequestLogLevel({ durationMs, statusCode }) {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400 || durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
    return "warn";
  }
  return null;
}

export function applyObservabilityMiddleware(app) {
  app.use((req, res, next) => {
    const requestId = resolveRequestId(req);
    const startedAt = process.hrtime.bigint();
    res.setHeader(REQUEST_ID_HEADER, requestId);

    return runWithRequestLogContext({ requestId }, () => {
      res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const roundedDurationMs = Math.round(durationMs * 100) / 100;
        const method = String(req.method || "").toUpperCase();
        const path = String(req.path || req.url || "").split("?")[0] || "/";
        recordHttpRequestMetric({
          durationMs: roundedDurationMs,
          method,
          statusCode: res.statusCode,
        });
        const logLevel = getHttpRequestLogLevel({
          durationMs: roundedDurationMs,
          statusCode: res.statusCode,
        });
        if (!logLevel) return;
        const fields = {
          method,
          path,
          statusCode: res.statusCode,
          durationMs: roundedDurationMs,
        };
        if (logLevel === "error") {
          logError("http.request.failed", fields);
        } else if (res.statusCode >= 400) {
          logWarn("http.request.failed", fields);
        } else {
          logWarn("http.request.slow", fields);
        }
      });
      return next();
    });
  });
}

function resolveCspOrigin(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  try {
    const url = new URL(rawValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.origin;
  } catch {
    return "";
  }
}

function isHttpsOrigin(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return false;
  }

  try {
    return new URL(rawValue).protocol === "https:";
  } catch {
    return false;
  }
}

function buildFormActionSources({
  clientOrigin,
  mcpOAuthIssuer,
}: SecurityMiddlewareOptions = {}) {
  const sources = new Set(["'self'"]);
  if (isHttpsOrigin(mcpOAuthIssuer)) {
    sources.add("https:");
  }

  for (const value of [clientOrigin, mcpOAuthIssuer]) {
    const origin = resolveCspOrigin(value);
    if (origin) {
      sources.add(origin);
    }
  }

  return Array.from(sources);
}

function buildTooManyRequestsHandler(scope: string) {
  return (_req, res) => {
    recordRejectionMetric(`rate_limit:${scope}`);
    return res.status(429).json({ error: "too_many_requests" });
  };
}

function getIpRateLimitKey(req) {
  return ipKeyGenerator(String(req.ip || ""));
}

function getAuthenticatedUserRateLimitKey(req) {
  const subject =
    String(req.user?.email || "")
      .trim()
      .toLowerCase() || getIpRateLimitKey(req);
  const routePath = String(req.route?.path || req.path || "").trim();
  return routePath ? `${subject}:${routePath}` : subject;
}

function getMcpRateLimitKey(req) {
  const subject = String(req.mcpAuth?.subject || "")
    .trim()
    .toLowerCase();
  const clientId = String(req.mcpAuth?.clientId || "").trim();
  return subject && clientId
    ? `${subject}:${clientId}`
    : getIpRateLimitKey(req);
}

function skipRouteRateLimitInTest() {
  return process.env.NODE_ENV === "test";
}

export function applySecurityMiddleware(
  app,
  nodeEnv,
  options: SecurityMiddlewareOptions = {},
) {
  if (nodeEnv === "production") {
    app.use(
      helmet({
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://accounts.google.com"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
              "https://accounts.google.com",
            ],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https:"],
            frameSrc: ["'self'", "https://accounts.google.com"],
            formAction: buildFormActionSources(options),
          },
        },
      }),
    );
    return;
  }

  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      contentSecurityPolicy: false,
    }),
  );
}

export function createRateLimiters() {
  return {
    requestCodeLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      handler: buildTooManyRequestsHandler("auth_request_code"),
    }),
    verifyCodeLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      handler: buildTooManyRequestsHandler("auth_verify_code"),
    }),
    passkeyAuthenticateOptionsLimiter: rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      handler: buildTooManyRequestsHandler("passkey_auth_options"),
    }),
    passkeyAuthenticateVerifyLimiter: rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      handler: buildTooManyRequestsHandler("passkey_auth_verify"),
    }),
    passkeyRegisterOptionsLimiter: rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      handler: buildTooManyRequestsHandler("passkey_register_options"),
    }),
    oauthRegisterLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      handler: buildTooManyRequestsHandler("oauth_register"),
    }),
    oauthTokenLimiter: rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      handler: buildTooManyRequestsHandler("oauth_token"),
    }),
    mcpRequestLimiter: rateLimit({
      windowMs: 60 * 1000,
      max: 180,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: getMcpRateLimitKey,
      handler: buildTooManyRequestsHandler("mcp"),
    }),
    jobEnqueueLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: getAuthenticatedUserRateLimitKey,
      skip: skipRouteRateLimitInTest,
      handler: buildTooManyRequestsHandler("job_enqueue"),
    }),
    uploadEnqueueLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 12,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: getAuthenticatedUserRateLimitKey,
      skip: skipRouteRateLimitInTest,
      handler: buildTooManyRequestsHandler("upload_enqueue"),
    }),
  };
}

export function applyCorsMiddleware(app, { nodeEnv, clientOrigin }) {
  if (nodeEnv === "development") {
    return;
  }

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", clientOrigin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      [
        "Content-Type",
        "X-CSRF-Token",
        "Authorization",
        "Mcp-Session-Id",
        "Mcp-Protocol-Version",
      ].join(", "),
    );
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });
}

export function createRequestGuards({ nodeEnv, clientOrigin, getSessionImpl }) {
  function requireTrustedOrigin(req, res, next) {
    if (nodeEnv === "development" || isTrustedOrigin(req, clientOrigin)) {
      return next();
    }

    return res.status(403).json({ error: "forbidden_origin" });
  }

  async function requireAuth(req, res, next) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies.session;
    if (!sessionId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    let session;
    try {
      session = await getSessionImpl(sessionId);
    } catch (error) {
      logError("auth.require.failed", error);
      return res.status(503).json({ error: "service_unavailable" });
    }

    if (!session) {
      return res.status(401).json({ error: "unauthorized" });
    }

    req.user = { email: session.email };
    req.auth = {
      sessionId,
      csrfToken: session.csrfToken,
    };
    return next();
  }

  function requireCsrf(req, res, next) {
    const cookies = parseCookies(req.headers.cookie);
    const csrfFromCookie = String(cookies.csrf || "").trim();
    const csrfFromHeader = readCsrfHeader(req);
    const csrfFromSession = String(req.auth?.csrfToken || "").trim();

    if (!csrfFromCookie || !csrfFromHeader || !csrfFromSession) {
      return res.status(403).json({ error: "csrf_invalid" });
    }

    if (
      csrfFromCookie !== csrfFromHeader ||
      csrfFromHeader !== csrfFromSession
    ) {
      return res.status(403).json({ error: "csrf_invalid" });
    }

    return next();
  }

  return { requireAuth, requireCsrf, requireTrustedOrigin };
}
