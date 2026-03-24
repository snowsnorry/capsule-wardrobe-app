import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OAuth2Client } from "google-auth-library";
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
  getFormalityLevels,
  getStyles,
  getOccasions,
  getSeasons,
  getAudienceOptions,
  getPatternOptions,
  getProfile,
  hasProfile,
  updateProfile,
  updateProfileLocale
} from "./profileStore.js";
import { getSearchOptions, getSavedSearch, runSavedSearch } from "./searchStore.js";
import { getWardrobeItems } from "./ai/ai.js";
import { downloadWardrobePdf } from "./wardrobePdf.js";
import { checkDatabaseConnection, ensureTables } from "./db.js";
import { ACCENT_COLOR_OPTIONS } from "../../shared/accentColors.js";

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";
const AUTH_TEST_MODE =
  NODE_ENV !== "production" && ["1", "true", "yes"].includes(String(process.env.AUTH_TEST_MODE || "").toLowerCase());
const SUPPORTED_LOCALES = new Set(["en", "ru"]);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_PATH = path.resolve(__dirname, "../../client/dist");
const CLIENT_ROOT = path.resolve(__dirname, "../../client");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

const app = express();
app.set("trust proxy", 1);
const googleAuthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

app.use(express.json());
if (NODE_ENV === "production") {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://accounts.google.com"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'", "https:"],
          frameSrc: ["'self'", "https://accounts.google.com"]
        }
      }
    })
  );
} else {
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
}

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

function isValidSingleSelection(item, allowedItems) {
  return typeof item === "string" && allowedItems.includes(item);
}

function isValidOptionalSingleSelection(item, allowedItems) {
  return item === null || (typeof item === "string" && allowedItems.includes(item));
}

function parseOptionalSelection(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

function isApiPath(pathname = "") {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/wardrobe") ||
    pathname.startsWith("/health") ||
    pathname === "/search/options" ||
    pathname === "/search/me" ||
    pathname === "/search/run"
  );
}

if (NODE_ENV !== "development") {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", CLIENT_ORIGIN);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
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
    const value = rest.join("=");
    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }
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
  res.append("Set-Cookie", parts.join("; "));
}

function setCsrfCookie(res, csrfToken) {
  const secure = NODE_ENV === "production";
  const sameSite = secure ? "None" : "Lax";
  const parts = [
    `csrf=${encodeURIComponent(csrfToken)}`,
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    `SameSite=${sameSite}`
  ];
  if (secure) {
    parts.push("Secure");
  }
  res.append("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const secure = NODE_ENV === "production";
  const sameSite = secure ? "None" : "Lax";

  const sessionParts = ["session=", "HttpOnly", "Path=/", "Max-Age=0", `SameSite=${sameSite}`];
  const csrfParts = ["csrf=", "Path=/", "Max-Age=0", `SameSite=${sameSite}`];

  if (secure) {
    sessionParts.push("Secure");
    csrfParts.push("Secure");
  }

  res.append("Set-Cookie", sessionParts.join("; "));
  res.append("Set-Cookie", csrfParts.join("; "));
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
  req.auth = {
    sessionId,
    csrfToken: session.csrfToken
  };
  return next();
}

function readCsrfHeader(req) {
  const raw = req.headers["x-csrf-token"];
  if (Array.isArray(raw)) {
    return String(raw[0] || "").trim();
  }
  return String(raw || "").trim();
}

function requireCsrf(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const csrfFromCookie = String(cookies.csrf || "").trim();
  const csrfFromHeader = readCsrfHeader(req);
  const csrfFromSession = String(req.auth?.csrfToken || "").trim();

  if (!csrfFromCookie || !csrfFromHeader || !csrfFromSession) {
    return res.status(403).json({ error: "csrf_invalid" });
  }

  if (csrfFromCookie !== csrfFromHeader || csrfFromHeader !== csrfFromSession) {
    return res.status(403).json({ error: "csrf_invalid" });
  }

  return next();
}

app.post("/auth/request-code", requestCodeLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const locale = String(req.body?.locale || "").trim().toLowerCase();
  const emailLocale = SUPPORTED_LOCALES.has(locale) ? locale : "en";
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

  if (AUTH_TEST_MODE) {
    const expiresInMinutes = Math.max(1, Math.ceil(CODE_TTL_MS / (60 * 1000)));
    console.log(
      `[auth/test-mode] Sign-in code for ${email}: ${result.code} (expires in ${expiresInMinutes} minute(s))`
    );
    return res.json({ ok: true, expiresInMs: CODE_TTL_MS });
  }

  try {
    await sendLoginCodeEmail({
      email,
      code: result.code,
      locale: emailLocale,
      expiresInMs: CODE_TTL_MS
    });
  } catch (error) {
    console.error("[auth/send-code-email]", error);
    return res.status(503).json({ error: "email_unavailable" });
  }
  return res.json({ ok: true, expiresInMs: CODE_TTL_MS });
});

app.post("/auth/verify-code", requireTrustedOrigin, verifyCodeLimiter, async (req, res) => {
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
  setCsrfCookie(res, session.csrfToken);
  return res.json({ ok: true, user: { email: session.email } });
});

app.post("/auth/google", requireTrustedOrigin, async (req, res) => {
  const idToken = String(req.body?.idToken || "").trim();
  if (!idToken) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  if (!googleAuthClient) {
    return res.status(503).json({ error: "google_auth_not_configured" });
  }

  let email = "";
  try {
    const ticket = await googleAuthClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: "invalid_google_token" });
    }
    email = payload.email.trim().toLowerCase();
  } catch (error) {
    console.error("[auth/google-verify]", error);
    return res.status(401).json({ error: "invalid_google_token" });
  }

  try {
    const { sessionId, session } = await createSession(email);
    setSessionCookie(res, sessionId);
    setCsrfCookie(res, session.csrfToken);
    return res.json({ ok: true, user: { email } });
  } catch (error) {
    console.error("[auth/google-create-session]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/auth/logout", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    await revokeSession(req.auth.sessionId);
  } catch (error) {
    console.error("[auth/logout]", error);
    return res.status(503).json({ error: "service_unavailable" });
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

app.get("/profile/formality-levels", requireAuth, async (req, res) => {
  try {
    const items = await getFormalityLevels(req.user.email);
    return res.json({ ok: true, items });
  } catch (error) {
    console.error("[profile/formality-levels]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/profile/styles", requireAuth, async (req, res) => {
  try {
    const items = await getStyles(req.user.email);
    return res.json({ ok: true, items });
  } catch (error) {
    console.error("[profile/styles]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/profile/occasions", requireAuth, async (req, res) => {
  try {
    const items = await getOccasions(req.user.email);
    return res.json({ ok: true, items });
  } catch (error) {
    console.error("[profile/occasions]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/profile/seasons", requireAuth, async (req, res) => {
  try {
    const items = await getSeasons(req.user.email);
    return res.json({ ok: true, items });
  } catch (error) {
    console.error("[profile/seasons]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/profile/audience", requireAuth, (req, res) => {
  res.json({ ok: true, items: getAudienceOptions() });
});

app.get("/profile/patterns", requireAuth, async (req, res) => {
  try {
    const items = await getPatternOptions(req.user.email);
    return res.json({ ok: true, items });
  } catch (error) {
    console.error("[profile/patterns]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/wardrobe/items", requireTrustedOrigin, requireAuth, requireCsrf, getWardrobeItems);
app.post("/wardrobe/items/pdf", requireTrustedOrigin, requireAuth, requireCsrf, downloadWardrobePdf);

app.get("/search/options", requireAuth, async (req, res) => {
  try {
    const options = await getSearchOptions(req.user.email);
    return res.json({ ok: true, ...options });
  } catch (error) {
    console.error("[search/options]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/search/me", requireAuth, async (req, res) => {
  try {
    const search = await getSavedSearch(req.user.email);
    return res.json({ ok: true, search });
  } catch (error) {
    console.error("[search/me]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/search/run", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const result = await runSavedSearch(req.user.email, req.body || {});
    return res.json({ ok: true, ...result });
  } catch (error) {
    if (error?.code === "invalid_payload" || error?.message === "invalid_payload") {
      return res.status(400).json({ error: "invalid_payload" });
    }
    console.error("[search/run]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/profile/initialize", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  const formalityLevel = String(req.body?.formalityLevel || "").trim().toLowerCase();
  const style = parseOptionalSelection(req.body?.style);
  const occasions = Array.isArray(req.body?.occasions)
    ? req.body.occasions
    : [];
  const season = Array.isArray(req.body?.season)
    ? req.body.season
    : [];
  const audience = String(req.body?.audience || "").trim().toLowerCase();
  const color = parseOptionalSelection(req.body?.color);
  const pattern = parseOptionalSelection(req.body?.pattern);
  const locale = String(req.body?.locale || "").trim().toLowerCase();
  const [allowedFormalityLevels, allowedStyles, allowedOccasions, allowedSeasons, allowedPatterns] = await Promise.all([
    getFormalityLevels(req.user.email),
    getStyles(req.user.email),
    getOccasions(req.user.email),
    getSeasons(req.user.email),
    getPatternOptions(req.user.email)
  ]);

  if (
    !isValidSingleSelection(formalityLevel, allowedFormalityLevels) ||
    !isValidOptionalSingleSelection(style, allowedStyles) ||
    !isValidSelection(occasions, allowedOccasions) ||
    !isValidSelection(season, allowedSeasons) ||
    !isValidSingleSelection(audience, getAudienceOptions()) ||
    !isValidOptionalSingleSelection(color, ACCENT_COLOR_OPTIONS) ||
    !isValidOptionalSingleSelection(pattern, allowedPatterns) ||
    !SUPPORTED_LOCALES.has(locale)
  ) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await createProfile(req.user.email, {
      formalityLevel,
      style,
      occasions,
      season,
      audience,
      color,
      pattern,
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

app.patch("/profile/me", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  const formalityLevel = String(req.body?.formalityLevel || "").trim().toLowerCase();
  const style = parseOptionalSelection(req.body?.style);
  const occasions = Array.isArray(req.body?.occasions)
    ? req.body.occasions
    : [];
  const season = Array.isArray(req.body?.season)
    ? req.body.season
    : [];
  const audience = String(req.body?.audience || "").trim().toLowerCase();
  const color = parseOptionalSelection(req.body?.color);
  const pattern = parseOptionalSelection(req.body?.pattern);
  const locale = String(req.body?.locale || "").trim().toLowerCase();
  const [allowedFormalityLevels, allowedStyles, allowedOccasions, allowedSeasons, allowedPatterns] = await Promise.all([
    getFormalityLevels(req.user.email),
    getStyles(req.user.email),
    getOccasions(req.user.email),
    getSeasons(req.user.email),
    getPatternOptions(req.user.email)
  ]);

  if (
    !isValidSingleSelection(formalityLevel, allowedFormalityLevels) ||
    !isValidOptionalSingleSelection(style, allowedStyles) ||
    !isValidSelection(occasions, allowedOccasions) ||
    !isValidSelection(season, allowedSeasons) ||
    !isValidSingleSelection(audience, getAudienceOptions()) ||
    !isValidOptionalSingleSelection(color, ACCENT_COLOR_OPTIONS) ||
    !isValidOptionalSingleSelection(pattern, allowedPatterns) ||
    !SUPPORTED_LOCALES.has(locale)
  ) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await updateProfile(req.user.email, {
      formalityLevel,
      style,
      occasions,
      season,
      audience,
      color,
      pattern,
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

app.patch("/profile/locale", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
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

app.delete("/profile/me", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
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

app.get("/health", (req, res) => {
  return res.json({ ok: true });
});

app.get("/healthall", async (req, res) => {
  try {
    await checkDatabaseConnection();
    return res.json({ ok: true });
  } catch (error) {
    console.error("[healthall]", error);
    return res.status(503).json({ ok: false });
  }
});

const startServer = async () => {
  await ensureTables();

  if (NODE_ENV === "development") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: CLIENT_ROOT,
      server: {
        middlewareMode: true,
        watch: {
          // 1Password env mounts can be FIFOs and emit frequent fs events.
          // Ignore client env files to avoid endless Vite restarts in dev middleware mode.
          ignored: ["**/.env", "**/.env.*"]
        }
      }
    });
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      if (isApiPath(req.path)) {
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
      if (isApiPath(req.path)) {
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
