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
  updateProfileLocale,
  updateProfileActiveCapsuleId
} from "./profileStore.js";
import {
  buildSnapshotFromProfile,
  createCapsule,
  deleteCapsule,
  duplicateCapsule,
  getCapsule,
  getEffectiveCapsuleSnapshot,
  listRecentCapsules,
  normalizeCapsuleSnapshot,
  renameCapsule,
  resolveActiveCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  setActiveCapsuleId,
  updateCapsuleSnapshot
} from "./capsuleStore.js";
import { getSearchOptions, getSavedSearch, runSavedSearch } from "./searchStore.js";
import { getWardrobeJob, regenerateCapsuleWardrobe } from "./ai/ai.js";
import { getPartialRegenerationJob, regenerateSelectedWardrobeItems } from "./ai/regenerateSelected.js";
import { buildCapsuleEventSnapshot, capsuleEventHub } from "./ai/capsuleEvents.js";
import { buildWardrobePdfInChild } from "./wardrobePdf.js";
import { checkDatabaseConnection, ensureTables, getProductsByUrlsInOrder } from "./db.js";
import { configureSharp } from "./ai/sharpConfig.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";

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
const sharpConfig = configureSharp();
console.info(
  "[sharp][configured]",
  JSON.stringify({
    cache: sharpConfig.cache,
    concurrency: sharpConfig.concurrency
  })
);

function isApiPath(pathname = "") {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/capsules") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/wardrobe") ||
    pathname.startsWith("/health") ||
    pathname === "/search/options" ||
    pathname === "/search/me" ||
    pathname === "/search/run"
  );
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

function setSessionCookie(res, sessionId, nodeEnv = NODE_ENV) {
  const secure = nodeEnv === "production";
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

function setCsrfCookie(res, csrfToken, nodeEnv = NODE_ENV) {
  const secure = nodeEnv === "production";
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

function clearSessionCookie(res, nodeEnv = NODE_ENV) {
  const secure = nodeEnv === "production";
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

function isTrustedOrigin(req, clientOrigin = CLIENT_ORIGIN) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    return origin === clientOrigin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === clientOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

function readCsrfHeader(req) {
  const raw = req.headers["x-csrf-token"];
  if (Array.isArray(raw)) {
    return String(raw[0] || "").trim();
  }
  return String(raw || "").trim();
}

function hasOwnProperty(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function isTruthyQueryFlag(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function hasUnexpectedCapsuleCreateFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const allowedKeys = new Set(["name", "filters"]);
  return Object.keys(payload).some((key) => !allowedKeys.has(key));
}

function hasUnexpectedCapsuleFiltersFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return Object.keys(payload).some((key) => key !== "filters");
}

function hasUnexpectedRejectedUrlsFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return Object.keys(payload).some((key) => key !== "rejectedUrls");
}

function buildCapsuleDraftFromFilters(profile, filters = null) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return buildSnapshotFromProfile(profile);
  }

  const normalizedFilters = normalizeCapsuleSnapshot({
    filters
  })?.filters;

  return {
    filters: normalizedFilters || buildSnapshotFromProfile(profile)?.filters,
    data: {
      wardrobe: null,
      rejectedUrls: []
    }
  };
}

function getValidatedRejectedUrls(capsule, rejectedUrls) {
  if (!Array.isArray(rejectedUrls)) {
    return null;
  }

  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const wardrobeItems = Array.isArray(effectiveSnapshot?.data?.wardrobe?.items)
    ? effectiveSnapshot.data.wardrobe.items
    : [];

  if (wardrobeItems.length === 0) {
    return { error: "not_found" };
  }

  const allowedUrls = new Set(
    wardrobeItems
      .map((item) => String(item?.url || "").trim())
      .filter(Boolean)
  );

  if (allowedUrls.size === 0) {
    return { error: "not_found" };
  }

  const normalizedRejectedUrls = [];
  for (const itemUrl of rejectedUrls) {
    if (typeof itemUrl !== "string") {
      return { error: "invalid_payload" };
    }

    const normalizedItemUrl = itemUrl.trim();
    if (!normalizedItemUrl || !allowedUrls.has(normalizedItemUrl)) {
      return { error: "invalid_payload" };
    }

    normalizedRejectedUrls.push(normalizedItemUrl);
  }

  return { rejectedUrls: [...new Set(normalizedRejectedUrls)] };
}

function createApp({
  nodeEnv = NODE_ENV,
  clientOrigin = CLIENT_ORIGIN,
  authTestMode = AUTH_TEST_MODE,
  googleClientId = GOOGLE_CLIENT_ID,
  googleAuthClient = googleClientId ? new OAuth2Client(googleClientId) : null,
  createPendingCodeImpl = createPendingCode,
  verifyCodeImpl = verifyCode,
  createSessionImpl = createSession,
  getSessionImpl = getSession,
  revokeSessionImpl = revokeSession,
  sendLoginCodeEmailImpl = sendLoginCodeEmail,
  createProfileImpl = createProfile,
  deleteProfileImpl = deleteProfile,
  getFormalityLevelsImpl = getFormalityLevels,
  getStylesImpl = getStyles,
  getOccasionsImpl = getOccasions,
  getSeasonsImpl = getSeasons,
  getAudienceOptionsImpl = getAudienceOptions,
  getPatternOptionsImpl = getPatternOptions,
  getProfileImpl = getProfile,
  hasProfileImpl = hasProfile,
  updateProfileImpl = updateProfile,
  updateProfileLocaleImpl = updateProfileLocale,
  updateProfileActiveCapsuleIdImpl = updateProfileActiveCapsuleId,
  resolveActiveCapsuleImpl = resolveActiveCapsule,
  listRecentCapsulesImpl = listRecentCapsules,
  searchCapsulesImpl = searchCapsules,
  getCapsuleImpl = getCapsule,
  createCapsuleImpl = createCapsule,
  updateCapsuleSnapshotImpl = updateCapsuleSnapshot,
  saveCapsuleImpl = saveCapsule,
  revertCapsuleImpl = revertCapsule,
  renameCapsuleImpl = renameCapsule,
  duplicateCapsuleImpl = duplicateCapsule,
  deleteCapsuleImpl = deleteCapsule,
  setActiveCapsuleIdImpl = setActiveCapsuleId,
  getSearchOptionsImpl = getSearchOptions,
  getSavedSearchImpl = getSavedSearch,
  runSavedSearchImpl = runSavedSearch,
  getWardrobeJobImpl = getWardrobeJob,
  getPartialRegenerationJobImpl = getPartialRegenerationJob,
  streamCapsuleEventsImpl = capsuleEventHub.subscribe,
  regenerateCapsuleWardrobeHandler = regenerateCapsuleWardrobe,
  regenerateSelectedCapsuleItemsHandler = regenerateSelectedWardrobeItems,
  buildWardrobePdfInChildImpl = buildWardrobePdfInChild,
  getProductsByUrlsInOrderImpl = getProductsByUrlsInOrder,
  checkDatabaseConnectionImpl = checkDatabaseConnection
} = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "100kb" }));

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
              "https://accounts.google.com"
            ],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https:"],
            frameSrc: ["'self'", "https://accounts.google.com"]
          }
        }
      })
    );
  } else {
    app.use(
      helmet({
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
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

  if (nodeEnv !== "development") {
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

  function requireTrustedOrigin(req, res, next) {
    if (nodeEnv === "development") {
      return next();
    }

    if (isTrustedOrigin(req, clientOrigin)) {
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

  function toCapsuleSummary(capsule) {
    const effective = getEffectiveCapsuleSnapshot(capsule);
    return {
      id: capsule.id,
      name: capsule.name,
      status: capsule.status,
      createdAt: capsule.createdAt,
      updatedAt: capsule.updatedAt,
      hasDraft: Boolean(capsule.draft),
      hasSaved: Boolean(capsule.saved),
      filters: effective?.filters || null
    };
  }

  function toCapsuleResponse(capsule) {
    return {
      ...toCapsuleSummary(capsule),
      draft: capsule.draft,
      saved: capsule.saved,
      effective: getEffectiveCapsuleSnapshot(capsule)
    };
  }

  function getCapsuleItems(capsule) {
    const effective = getEffectiveCapsuleSnapshot(capsule);
    const wardrobe = effective?.data?.wardrobe;
    return Array.isArray(wardrobe?.items) ? sortWardrobeItems(wardrobe.items) : [];
  }

  async function streamCapsuleEventsHandler(req, res) {
    try {
      const capsuleId = String(req.params?.id || "").trim();
      if (!capsuleId) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      const capsule = await getCapsuleImpl(req.user.email, capsuleId);
      if (!capsule) {
        return res.status(404).json({ error: "not_found" });
      }

      const snapshot = buildCapsuleEventSnapshot({
        capsule,
        activeJob: getWardrobeJobImpl(req.user.email, capsuleId),
        partialRegenerationJob: getPartialRegenerationJobImpl(req.user.email, capsuleId)
      });
      await streamCapsuleEventsImpl(req, res, {
        email: req.user.email,
        capsuleId,
        snapshot
      });
      return undefined;
    } catch (error) {
      console.error("[capsules/events]", error);
      if (!res.headersSent) {
        return res.status(503).json({ error: "service_unavailable" });
      }
      return undefined;
    }
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
    result = await createPendingCodeImpl(email);
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

  if (authTestMode) {
    const expiresInMinutes = Math.max(1, Math.ceil(CODE_TTL_MS / (60 * 1000)));
    console.log(
      `[auth/test-mode] Sign-in code for ${email}: ${result.code} (expires in ${expiresInMinutes} minute(s))`
    );
    return res.json({ ok: true, expiresInMs: CODE_TTL_MS });
  }

  try {
    await sendLoginCodeEmailImpl({
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
    result = await verifyCodeImpl(email, code);
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
    created = await createSessionImpl(email);
  } catch (error) {
    console.error("[auth/create-session]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }

  const { sessionId, session } = created;
  setSessionCookie(res, sessionId, nodeEnv);
  setCsrfCookie(res, session.csrfToken, nodeEnv);
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
    const { sessionId, session } = await createSessionImpl(email);
    setSessionCookie(res, sessionId, nodeEnv);
    setCsrfCookie(res, session.csrfToken, nodeEnv);
    return res.json({ ok: true, user: { email } });
  } catch (error) {
    console.error("[auth/google-create-session]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/auth/logout", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    await revokeSessionImpl(req.auth.sessionId);
  } catch (error) {
    console.error("[auth/logout]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
  clearSessionCookie(res, nodeEnv);
  return res.json({ ok: true });
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.get("/profile/status", requireAuth, async (req, res) => {
  try {
    const exists = await hasProfileImpl(req.user.email);
    return res.json({ ok: true, hasProfile: exists });
  } catch (error) {
    console.error("[profile/status]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/profile/me", requireAuth, async (req, res) => {
  try {
    const profile = await getProfileImpl(req.user.email);
    if (!profile) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, profile });
  } catch (error) {
    console.error("[profile/me]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/wardrobe/filters", requireAuth, async (req, res) => {
  try {
    const [formalityLevels, styles, occasions, seasons, patterns] = await Promise.all([
      getFormalityLevelsImpl(req.user.email),
      getStylesImpl(req.user.email),
      getOccasionsImpl(req.user.email),
      getSeasonsImpl(req.user.email),
      getPatternOptionsImpl(req.user.email)
    ]);
    return res.json({
      ok: true,
      formalityLevels,
      styles,
      occasions,
      seasons,
      audience: getAudienceOptionsImpl(),
      patterns
    });
  } catch (error) {
    console.error("[wardrobe/filters]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/capsules/bootstrap", requireAuth, async (req, res) => {
  try {
    const profile = await getProfileImpl(req.user.email);
    const activeCapsule = await resolveActiveCapsuleImpl(req.user.email);
    const recentCapsules = await listRecentCapsulesImpl(req.user.email, 10);
    return res.json({
      ok: true,
      profile: profile || null,
      activeCapsule: toCapsuleResponse(activeCapsule),
      capsules: recentCapsules.map(toCapsuleSummary)
    });
  } catch (error) {
    console.error("[capsules/bootstrap]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/capsules/recent", requireAuth, async (req, res) => {
  try {
    const items = await listRecentCapsulesImpl(req.user.email, 10);
    return res.json({ ok: true, capsules: items.map(toCapsuleSummary) });
  } catch (error) {
    console.error("[capsules/recent]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/capsules/search", requireAuth, async (req, res) => {
  try {
    const query = String(req.query?.q || "").trim();
    const items = query
      ? await searchCapsulesImpl(req.user.email, query, 25)
      : await listRecentCapsulesImpl(req.user.email, 25);
    return res.json({ ok: true, capsules: items.map(toCapsuleSummary) });
  } catch (error) {
    console.error("[capsules/search]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/capsules/:id", requireAuth, async (req, res) => {
  try {
    const capsule = await getCapsuleImpl(req.user.email, req.params.id);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }
    await setActiveCapsuleIdImpl(req.user.email, capsule.id);
    return res.json({ ok: true, capsule: toCapsuleResponse(capsule) });
  } catch (error) {
    console.error("[capsules/get]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/capsules/:id/events", requireAuth, streamCapsuleEventsHandler);

app.post("/capsules/:id/regenerate", requireTrustedOrigin, requireAuth, requireCsrf, regenerateCapsuleWardrobeHandler);

app.post(
  "/capsules/:id/regenerate-selected",
  requireTrustedOrigin,
  requireAuth,
  requireCsrf,
  regenerateSelectedCapsuleItemsHandler
);

app.post("/capsules", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  if (hasUnexpectedCapsuleCreateFields(req.body)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await getProfileImpl(req.user.email);
    const capsule = await createCapsuleImpl(req.user.email, {
      name: String(req.body?.name || "").trim() || undefined,
      draft: buildCapsuleDraftFromFilters(profile, req.body?.filters),
      saved: null,
      setActive: true
    });
    return res.status(201).json({ ok: true, capsule: toCapsuleResponse(capsule) });
  } catch (error) {
    console.error("[capsules/create]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.patch("/capsules/:id/filters", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  if (hasUnexpectedCapsuleFiltersFields(req.body)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  if (!hasOwnProperty(req.body, "filters")) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const nextDraft = {
      filters: normalizeCapsuleSnapshot({
        filters: req.body?.filters
      })?.filters,
      data: {
        wardrobe: null,
        rejectedUrls: []
      }
    };
    const capsule = await updateCapsuleSnapshotImpl(req.user.email, req.params.id, nextDraft);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }

    if (isTruthyQueryFlag(req.query?.regenerate)) {
      return regenerateCapsuleWardrobeHandler(req, res);
    }

    return res.json({ ok: true, capsule: toCapsuleResponse(capsule) });
  } catch (error) {
    console.error("[capsules/filters]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.patch("/capsules/:id/rejected-urls", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  if (hasUnexpectedRejectedUrlsFields(req.body)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  if (!hasOwnProperty(req.body, "rejectedUrls")) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const capsule = await getCapsuleImpl(req.user.email, req.params.id);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }

    const validationResult = getValidatedRejectedUrls(capsule, req.body?.rejectedUrls);
    if (validationResult?.error === "not_found") {
      return res.status(404).json({ error: "not_found" });
    }
    if (validationResult?.error) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
    const nextCapsule = await updateCapsuleSnapshotImpl(req.user.email, req.params.id, {
      filters: effectiveSnapshot?.filters,
      data: {
        wardrobe: effectiveSnapshot?.data?.wardrobe || null,
        rejectedUrls: validationResult.rejectedUrls
      }
    });

    if (!nextCapsule) {
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({ ok: true, capsule: toCapsuleResponse(nextCapsule) });
  } catch (error) {
    console.error("[capsules/rejected-urls]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/capsules/:id/save", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const capsule = await saveCapsuleImpl(req.user.email, req.params.id);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, capsule: toCapsuleResponse(capsule) });
  } catch (error) {
    console.error("[capsules/save]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/capsules/:id/revert", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const capsule = await revertCapsuleImpl(req.user.email, req.params.id);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, capsule: toCapsuleResponse(capsule) });
  } catch (error) {
    console.error("[capsules/revert]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.patch("/capsules/:id/rename", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    const capsule = await renameCapsuleImpl(req.user.email, req.params.id, name);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, capsule: toCapsuleResponse(capsule) });
  } catch (error) {
    console.error("[capsules/rename]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/capsules/:id/duplicate", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const capsule = await duplicateCapsuleImpl(req.user.email, req.params.id, String(req.body?.name || "").trim() || undefined);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.status(201).json({ ok: true, capsule: toCapsuleResponse(capsule) });
  } catch (error) {
    console.error("[capsules/duplicate]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/capsules/:id/select", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const capsule = await getCapsuleImpl(req.user.email, req.params.id);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }
    const profile = await updateProfileActiveCapsuleIdImpl(req.user.email, capsule.id);
    return res.json({ ok: true, activeCapsuleId: profile?.activeCapsuleId || capsule.id });
  } catch (error) {
    console.error("[capsules/select]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.delete("/capsules/:id", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const deleted = await deleteCapsuleImpl(req.user.email, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "not_found" });
    }
    const activeCapsule = await resolveActiveCapsuleImpl(req.user.email);
    return res.json({ ok: true, activeCapsule: toCapsuleResponse(activeCapsule) });
  } catch (error) {
    console.error("[capsules/delete]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/capsules/:id/pdf", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const capsule = await getCapsuleImpl(req.user.email, req.params.id);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }
    const profile = await getProfileImpl(req.user.email);
    const items = getCapsuleItems(capsule);
    if (items.length === 0) {
      return res.status(404).json({ error: "not_found" });
    }
    const productUrls = items.map((item) => String(item?.url || "").trim()).filter(Boolean);
    const products = await getProductsByUrlsInOrderImpl(productUrls);
    if (products.length === 0) {
      return res.status(404).json({ error: "not_found" });
    }
    const locale = profile?.locale || "en";
    const pdfBuffer = await buildWardrobePdfInChildImpl(products, locale);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="capsule-wardrobe.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("[capsules/pdf]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/search/options", requireAuth, async (req, res) => {
  try {
    const options = await getSearchOptionsImpl(req.user.email);
    return res.json({ ok: true, ...options });
  } catch (error) {
    console.error("[search/options]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/search/me", requireAuth, async (req, res) => {
  try {
    const search = await getSavedSearchImpl(req.user.email);
    return res.json({ ok: true, search });
  } catch (error) {
    console.error("[search/me]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/search/run", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const result = await runSavedSearchImpl(req.user.email, req.body || {});
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
  const locale = String(req.body?.locale || "").trim().toLowerCase();
  if (!SUPPORTED_LOCALES.has(locale)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await createProfileImpl(req.user.email, {
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
  const locale = String(req.body?.locale || "").trim().toLowerCase();
  if (!SUPPORTED_LOCALES.has(locale)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await updateProfileImpl(req.user.email, {
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
    const profile = await updateProfileLocaleImpl(req.user.email, locale);
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
    const deleted = await deleteProfileImpl(req.user.email);
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
    await checkDatabaseConnectionImpl();
    return res.json({ ok: true });
  } catch (error) {
    console.error("[healthall]", error);
    return res.status(503).json({ ok: false });
  }
});

  return app;
}

const app = createApp();

const startServer = async ({
  appInstance = app,
  nodeEnv = NODE_ENV,
  ensureTablesImpl = ensureTables,
  port = PORT
} = {}) => {
  await ensureTablesImpl();

  if (nodeEnv === "development") {
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
    appInstance.use(vite.middlewares);

    appInstance.use("*", async (req, res, next) => {
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
    appInstance.use(express.static(CLIENT_DIST_PATH));

    appInstance.get("*", (req, res) => {
      if (isApiPath(req.path)) {
        return res.status(404).json({ error: "not_found" });
      }
      return res.sendFile(path.join(CLIENT_DIST_PATH, "index.html"));
    });
  }

  return appInstance.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
};

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("[server/start]", error);
    process.exitCode = 1;
  });
}

export { app, createApp, startServer };
