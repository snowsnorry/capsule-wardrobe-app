import crypto from "node:crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  isTrustedOrigin,
  parseCookies,
  readCsrfHeader,
} from "./httpCookies.js";
import { logError, logInfo, runWithRequestLogContext } from "./logger.js";
import { recordHttpRequestMetric } from "./observabilityMetrics.js";

type SecurityMiddlewareOptions = {
  clientOrigin?: string;
  mcpOAuthIssuer?: string;
};

const REQUEST_ID_HEADER = "X-Request-Id";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function resolveRequestId(req): string {
  const headerValue = req.get?.(REQUEST_ID_HEADER);
  const requestId = String(
    Array.isArray(headerValue) ? headerValue[0] : headerValue || "",
  ).trim();
  return REQUEST_ID_PATTERN.test(requestId) ? requestId : crypto.randomUUID();
}

function shouldLogHttpRequest({ method, path, statusCode }) {
  return !(method === "GET" && path === "/health" && statusCode < 400);
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
        if (
          !shouldLogHttpRequest({ method, path, statusCode: res.statusCode })
        ) {
          return;
        }
        logInfo("http_request", {
          event: "http_request",
          method,
          path,
          statusCode: res.statusCode,
          durationMs: roundedDurationMs,
        });
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
      message: { error: "too_many_requests" },
    }),
    verifyCodeLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "too_many_requests" },
    }),
    passkeyAuthenticateOptionsLimiter: rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "too_many_requests" },
    }),
    passkeyAuthenticateVerifyLimiter: rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "too_many_requests" },
    }),
    passkeyRegisterOptionsLimiter: rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "too_many_requests" },
    }),
    oauthRegisterLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "too_many_requests" },
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
    res.header("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
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
      logError("[requireAuth]", error);
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
