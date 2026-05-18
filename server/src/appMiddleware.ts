import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  isTrustedOrigin,
  parseCookies,
  readCsrfHeader,
} from "./httpCookies.js";
import { logError } from "./logger.js";

export function applySecurityMiddleware(app, nodeEnv) {
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
