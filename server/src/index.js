import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_CODE_SENDS_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  SESSION_TTL_MS,
  createPendingCode,
  verifyCode,
  createSession,
  getSession,
  revokeSession
} from "./authStore.js";
import { sendLoginCodeEmail } from "./email.js";
import {
  createProfile,
  deleteProfile,
  getStylePreferences,
  getWardrobeOccasions,
  getProfile,
  hasProfile,
  updateProfile,
  updateProfileLocale
} from "./profileStore.js";
import { getWardrobeItems } from "./ai.js";
import { checkDatabaseConnection, ensureTables } from "./db.js";

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";
const SUPPORTED_LOCALES = new Set(["en", "ru"]);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_PATH = path.resolve(__dirname, "../../client/dist");
const CLIENT_ROOT = path.resolve(__dirname, "../../client");

const app = express();

app.use(express.json());
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

const requestCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" }
});

const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" }
});

function isValidSelection(items, allowedItems) {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }
  return items.every((item) => typeof item === "string" && allowedItems.includes(item));
}

if (NODE_ENV !== "development") {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", CLIENT_ORIGIN);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function setSessionCookie(res, sessionId) {
  const secure = NODE_ENV === "production";
  const sameSite = secure ? "None" : "Lax";
  const parts = [
    `session=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    `SameSite=${sameSite}`
  ];
  if (secure) {
    parts.push("Secure");
  }
  res.header("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  res.header("Set-Cookie", "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}

function isTrustedOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    return origin === CLIENT_ORIGIN;
  }

  if (referer) {
    try {
      return new URL(referer).origin === CLIENT_ORIGIN;
    } catch {
      return false;
    }
  }

  return false;
}

function requireTrustedOrigin(req, res, next) {
  if (NODE_ENV === "development") {
    return next();
  }

  if (isTrustedOrigin(req)) {
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
    session = await getSession(sessionId);
  } catch (error) {
    console.error("[requireAuth]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }

  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  req.user = { email: session.email };
  return next();
}

app.post("/auth/request-code", requestCodeLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "invalid_email" });
  }

  let result;
  try {
    result = await createPendingCode(email);
  } catch (error) {
    console.error("[auth/request-code]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }

  if (!result.ok) {
    if (result.reason === "cooldown") {
      return res.status(429).json({ error: "cooldown", retryAfterMs: RESEND_COOLDOWN_MS });
    }
    if (result.reason === "rate_limit") {
      return res.status(429).json({ error: "rate_limit", maxPerHour: MAX_CODE_SENDS_PER_HOUR });
    }
  }

  await sendLoginCodeEmail({ email, code: result.code });
  return res.json({ ok: true, expiresInMs: CODE_TTL_MS });
});

app.post("/auth/verify-code", verifyCodeLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();
  if (!email || !code) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  let result;
  try {
    result = await verifyCode(email, code);
  } catch (error) {
    console.error("[auth/verify-code]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }

  if (!result.ok) {
    if (result.reason === "expired") {
      return res.status(400).json({ error: "expired" });
    }
    if (result.reason === "max_attempts") {
      return res.status(429).json({ error: "max_attempts", maxAttempts: MAX_VERIFY_ATTEMPTS });
    }
    return res.status(400).json({ error: "invalid" });
  }

  let created;
  try {
    created = await createSession(email);
  } catch (error) {
    console.error("[auth/create-session]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }

  const { sessionId, session } = created;
  setSessionCookie(res, sessionId);
  return res.json({ ok: true, user: { email: session.email } });
});

app.post("/auth/logout", requireTrustedOrigin, async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.session) {
    try {
      await revokeSession(cookies.session);
    } catch (error) {
      console.error("[auth/logout]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  }
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.get("/profile/status", requireAuth, async (req, res) => {
  try {
    const exists = await hasProfile(req.user.email);
    return res.json({ ok: true, hasProfile: exists });
  } catch (error) {
    console.error("[profile/status]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/profile/me", requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.email);
    if (!profile) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, profile });
  } catch (error) {
    console.error("[profile/me]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/profile/style-preferences", requireAuth, (req, res) => {
  res.json({ ok: true, items: getStylePreferences() });
});

app.get("/profile/wardrobe-occasions", requireAuth, (req, res) => {
  res.json({ ok: true, items: getWardrobeOccasions() });
});

app.get("/wardrobe/items", requireAuth, getWardrobeItems);

app.post("/profile/initialize", requireTrustedOrigin, requireAuth, async (req, res) => {
  const stylePreferences = Array.isArray(req.body?.stylePreferences)
    ? req.body.stylePreferences
    : [];
  const wardrobeOccasions = Array.isArray(req.body?.wardrobeOccasions)
    ? req.body.wardrobeOccasions
    : [];
  const locale = String(req.body?.locale || "").trim().toLowerCase();

  if (
    !isValidSelection(stylePreferences, getStylePreferences()) ||
    !isValidSelection(wardrobeOccasions, getWardrobeOccasions()) ||
    !SUPPORTED_LOCALES.has(locale)
  ) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await createProfile(req.user.email, {
      stylePreferences,
      wardrobeOccasions,
      locale
    });
    if (!profile) {
      return res.status(409).json({ error: "profile_exists" });
    }
    return res.json({ ok: true, profile });
  } catch (error) {
    console.error("[profile/initialize]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.patch("/profile/me", requireTrustedOrigin, requireAuth, async (req, res) => {
  const stylePreferences = Array.isArray(req.body?.stylePreferences)
    ? req.body.stylePreferences
    : [];
  const wardrobeOccasions = Array.isArray(req.body?.wardrobeOccasions)
    ? req.body.wardrobeOccasions
    : [];
  const locale = String(req.body?.locale || "").trim().toLowerCase();

  if (
    !isValidSelection(stylePreferences, getStylePreferences()) ||
    !isValidSelection(wardrobeOccasions, getWardrobeOccasions()) ||
    !SUPPORTED_LOCALES.has(locale)
  ) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await updateProfile(req.user.email, {
      stylePreferences,
      wardrobeOccasions,
      locale
    });
    if (!profile) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, profile });
  } catch (error) {
    console.error("[profile/update]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.patch("/profile/locale", requireTrustedOrigin, requireAuth, async (req, res) => {
  const locale = String(req.body?.locale || "").trim().toLowerCase();
  if (!SUPPORTED_LOCALES.has(locale)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await updateProfileLocale(req.user.email, locale);
    if (!profile) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, profile });
  } catch (error) {
    console.error("[profile/locale]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.delete("/profile/me", requireTrustedOrigin, requireAuth, async (req, res) => {
  try {
    const deleted = await deleteProfile(req.user.email);
    if (!deleted) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("[profile/delete]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/health", async (req, res) => {
  try {
    await checkDatabaseConnection();
    return res.json({ ok: true });
  } catch (error) {
    console.error("[health]", error);
    return res.status(503).json({ ok: false });
  }
});

const startServer = async () => {
  await ensureTables();

  if (NODE_ENV === "development") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: CLIENT_ROOT,
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      if (
        req.originalUrl.startsWith("/auth") ||
        req.originalUrl.startsWith("/profile") ||
        req.originalUrl.startsWith("/wardrobe") ||
        req.originalUrl.startsWith("/health")
      ) {
        return next();
      }

      try {
        const htmlPath = path.join(CLIENT_ROOT, "index.html");
        const template = await fs.promises.readFile(htmlPath, "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error);
        next(error);
      }
      return undefined;
    });
  } else if (fs.existsSync(CLIENT_DIST_PATH)) {
    app.use(express.static(CLIENT_DIST_PATH));

    app.get("*", (req, res) => {
      if (
        req.path.startsWith("/auth") ||
        req.path.startsWith("/profile") ||
        req.path.startsWith("/wardrobe") ||
        req.path.startsWith("/health")
      ) {
        return res.status(404).json({ error: "not_found" });
      }
      return res.sendFile(path.join(CLIENT_DIST_PATH, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
};

startServer();
