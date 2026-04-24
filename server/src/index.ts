import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OAuth2Client } from "google-auth-library";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  WebAuthnCredential
} from "@simplewebauthn/server";
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
  buildCapsuleSnapshotWithRegeneration,
  buildSnapshotFromProfile,
  createCapsule,
  deleteCapsule,
  duplicateCapsule,
  getCapsule,
  getEffectiveCapsuleSnapshot,
  getCapsuleSnapshotRegeneration,
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
import { getSearchOptions, getSavedSearch, getSearchStats, runSavedSearch } from "./searchStore.js";
import { getWardrobeJob, regenerateCapsuleWardrobe } from "./ai/ai.js";
import { getPartialRegenerationJob, regenerateSelectedWardrobeItems } from "./ai/regenerateSelected.js";
import { deleteOutfitSetImage, generateOutfitSetImage, getOutfitSetImageJob } from "./ai/outfitSetImages.js";
import { buildCapsuleEventSnapshot, capsuleEventHub } from "./ai/capsuleEvents.js";
import { buildWardrobePdfInChild } from "./wardrobePdf.js";
import {
  checkDatabaseConnection,
  consumePasskeyChallenge,
  deletePasskeyByIdForEmail,
  ensureTables,
  getPasskeyByCredentialId,
  getProductsByUrlsInOrder,
  insertPasskey,
  insertPasskeyChallenge,
  listPasskeysByEmail,
  pruneExpiredPasskeyChallenges,
  updatePasskeyAuthentication
} from "./db.js";
import { configureSharp } from "./ai/sharpConfig.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";
import {
  DEFAULT_PROFILE_LLM,
  DEFAULT_PROFILE_IMAGE_LLM,
  DEFAULT_PROFILE_THEME,
  PROFILE_IMAGE_LLM_VALUES,
  PROFILE_LLM_VALUES,
  PROFILE_THEME_VALUES
} from "../../shared/profileSettings.js";
import type { ErrorWithCode, WardrobeUiItemLike } from "./ai/types.js";

type CookieMap = Record<string, string>;
type PasskeyChallengeKind = "registration" | "authentication";
type PasskeyRecord = {
  id: string;
  profileEmail: string;
  credentialId: string;
  credentialPublicKey: string;
  counter: number | string;
  deviceType?: string | null;
  backedUp?: boolean | null;
  transports?: string[] | null;
  name?: string | null;
  lastUsedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};
type PasskeyChallengeRecord = {
  id: string;
  kind: string;
  challenge: string;
  profileEmail?: string | null;
  expiresAt?: string | Date;
  consumedAt?: string | Date | null;
  createdAt?: string | Date;
};
type ProfileSettingsPayload = {
  locale: string;
  theme: string;
  llm: string;
  imageLlm: string;
  fullname: string | null;
};
type RejectedUrlsValidationResult =
  | { error: "invalid_payload" | "not_found" }
  | { rejectedUrls: string[] };

function isProfileThemeValue(value: string): value is (typeof PROFILE_THEME_VALUES)[number] {
  return (PROFILE_THEME_VALUES as readonly string[]).includes(value);
}

function isProfileLlmValue(value: string): value is (typeof PROFILE_LLM_VALUES)[number] {
  return (PROFILE_LLM_VALUES as readonly string[]).includes(value);
}

function isProfileImageLlmValue(value: string): value is (typeof PROFILE_IMAGE_LLM_VALUES)[number] {
  return (PROFILE_IMAGE_LLM_VALUES as readonly string[]).includes(value);
}

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";
const AUTH_TEST_MODE =
  NODE_ENV !== "production" && ["1", "true", "yes"].includes(String(process.env.AUTH_TEST_MODE || "").toLowerCase());
const SUPPORTED_LOCALES = new Set(["en", "ru"]);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_CANDIDATES = [
  path.resolve(__dirname, "../../client/dist"),
  path.resolve(__dirname, "../../../../client/dist"),
  path.resolve(process.cwd(), "../client/dist")
];
const CLIENT_ROOT_CANDIDATES = [
  path.resolve(__dirname, "../../client"),
  path.resolve(__dirname, "../../../../client"),
  path.resolve(process.cwd(), "../client")
];
const CLIENT_DIST_PATH = CLIENT_DIST_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || CLIENT_DIST_CANDIDATES[0];
const CLIENT_ROOT = CLIENT_ROOT_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || CLIENT_ROOT_CANDIDATES[0];
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const PASSKEY_RP_NAME = process.env.PASSKEY_RP_NAME || "Capsule Wardrobe";
const PASSKEY_RP_ID = process.env.PASSKEY_RP_ID || "localhost";
const PASSKEY_ORIGIN = process.env.PASSKEY_ORIGIN || "http://localhost:3000";
const PASSKEY_CHALLENGE_COOKIE = "passkey_challenge";
const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const sharpConfig = configureSharp();
console.info(
  "[sharp][configured]",
  JSON.stringify({
    cache: sharpConfig.cache,
    concurrency: sharpConfig.concurrency
  })
);

function buildPdfDownloadFilename(capsuleName) {
  const normalizedName = String(capsuleName || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/:"*?<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const baseName = normalizedName || "capsule-wardrobe";
  const asciiFallback = baseName
    .replace(/[^\x20-\x7e]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    || "capsule-wardrobe";
  const encodedUtf8Name = encodeURIComponent(`${baseName}.pdf`);
  return `attachment; filename="${asciiFallback}.pdf"; filename*=UTF-8''${encodedUtf8Name}`;
}

function isApiPath(pathname = "") {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/capsules") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/wardrobe") ||
    pathname.startsWith("/health") ||
    pathname === "/search/options" ||
    pathname === "/search/me" ||
    pathname === "/search/run" ||
    pathname === "/search/stats"
  );
}

function parseCookies(cookieHeader = ""): CookieMap {
  return cookieHeader.split(";").reduce<CookieMap>((acc, part) => {
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

function setPasskeyChallengeCookie(res, challengeId, nodeEnv = NODE_ENV) {
  const secure = nodeEnv === "production";
  const sameSite = secure ? "None" : "Lax";
  const parts = [
    `${PASSKEY_CHALLENGE_COOKIE}=${encodeURIComponent(challengeId)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${Math.floor(PASSKEY_CHALLENGE_TTL_MS / 1000)}`,
    `SameSite=${sameSite}`
  ];
  if (secure) {
    parts.push("Secure");
  }
  res.append("Set-Cookie", parts.join("; "));
}

function clearPasskeyChallengeCookie(res, nodeEnv = NODE_ENV) {
  const secure = nodeEnv === "production";
  const sameSite = secure ? "None" : "Lax";
  const parts = [
    `${PASSKEY_CHALLENGE_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
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

function generatePasskeyChallengeId() {
  return crypto.randomBytes(32).toString("base64url");
}

function publicKeyToBase64Url(publicKey: Uint8Array): string {
  return Buffer.from(publicKey).toString("base64url");
}

function publicKeyFromBase64Url(publicKey: string): Uint8Array<ArrayBuffer> {
  const buffer = Buffer.from(publicKey, "base64url");
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
}

function getPasskeyChallengeId(req): string {
  return String(parseCookies(req.headers.cookie)[PASSKEY_CHALLENGE_COOKIE] || "").trim();
}

function toPasskeyMetadata(passkey: PasskeyRecord) {
  return {
    id: passkey.id,
    name: passkey.name || "",
    deviceType: passkey.deviceType || null,
    backedUp: passkey.backedUp ?? null,
    transports: Array.isArray(passkey.transports) ? passkey.transports : [],
    createdAt: passkey.createdAt || null,
    lastUsedAt: passkey.lastUsedAt || null
  };
}

function toWebAuthnCredential(passkey: PasskeyRecord): WebAuthnCredential {
  return {
    id: passkey.credentialId,
    publicKey: publicKeyFromBase64Url(passkey.credentialPublicKey),
    counter: Number(passkey.counter || 0),
    transports: Array.isArray(passkey.transports)
      ? passkey.transports as AuthenticatorTransportFuture[]
      : []
  };
}

function isRegistrationResponse(payload: unknown): payload is RegistrationResponseJSON {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && typeof (payload as { id?: unknown }).id === "string");
}

function isAuthenticationResponse(payload: unknown): payload is AuthenticationResponseJSON {
  return isRegistrationResponse(payload);
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

function normalizeProfileSettingsPayload(payload: unknown): ProfileSettingsPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;

  const locale = String(record.locale || "").trim().toLowerCase();
  const theme = String(record.theme || "").trim().toLowerCase();
  const llm = String(record.llm || "").trim();
  const imageLlm = String(record.image_llm || "").trim();

  if (!SUPPORTED_LOCALES.has(locale)) {
    return null;
  }
  if (!isProfileThemeValue(theme)) {
    return null;
  }
  if (!isProfileLlmValue(llm)) {
    return null;
  }
  if (imageLlm && !isProfileImageLlmValue(imageLlm)) {
    return null;
  }

  const rawFullname = record.fullname;
  if (rawFullname !== null && rawFullname !== undefined && typeof rawFullname !== "string") {
    return null;
  }

  return {
    locale,
    theme: theme || DEFAULT_PROFILE_THEME,
    llm: llm || DEFAULT_PROFILE_LLM,
    imageLlm: imageLlm || DEFAULT_PROFILE_IMAGE_LLM,
    fullname: typeof rawFullname === "string" && rawFullname.trim()
      ? rawFullname.trim()
      : null
  };
}

function toProfileResponse(profile) {
  if (!profile || typeof profile !== "object") {
    return profile || null;
  }

  const { imageLlm, ...rest } = profile;
  return {
    ...rest,
    image_llm: typeof imageLlm === "string" && imageLlm.trim()
      ? imageLlm.trim()
      : DEFAULT_PROFILE_IMAGE_LLM
  };
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

function getValidatedRejectedUrls(capsule, rejectedUrls): RejectedUrlsValidationResult | null {
  if (!Array.isArray(rejectedUrls)) {
    return null;
  }

  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const wardrobeItems: WardrobeUiItemLike[] = Array.isArray(effectiveSnapshot?.data?.wardrobe?.items)
    ? effectiveSnapshot.data.wardrobe.items as WardrobeUiItemLike[]
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
  passkeyRpName = PASSKEY_RP_NAME,
  passkeyRpId = PASSKEY_RP_ID,
  passkeyOrigin = PASSKEY_ORIGIN,
  createPendingCodeImpl = createPendingCode,
  verifyCodeImpl = verifyCode,
  createSessionImpl = createSession,
  getSessionImpl = getSession,
  revokeSessionImpl = revokeSession,
  listPasskeysImpl = listPasskeysByEmail,
  insertPasskeyImpl = insertPasskey,
  getPasskeyByCredentialIdImpl = getPasskeyByCredentialId,
  updatePasskeyAuthenticationImpl = updatePasskeyAuthentication,
  deletePasskeyByIdForEmailImpl = deletePasskeyByIdForEmail,
  insertPasskeyChallengeImpl = insertPasskeyChallenge,
  consumePasskeyChallengeImpl = consumePasskeyChallenge,
  pruneExpiredPasskeyChallengesImpl = pruneExpiredPasskeyChallenges,
  generateRegistrationOptionsImpl = generateRegistrationOptions,
  verifyRegistrationResponseImpl = verifyRegistrationResponse,
  generateAuthenticationOptionsImpl = generateAuthenticationOptions,
  verifyAuthenticationResponseImpl = verifyAuthenticationResponse,
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
  getSearchStatsImpl = getSearchStats,
  runSavedSearchImpl = runSavedSearch,
  getWardrobeJobImpl = getWardrobeJob,
  getPartialRegenerationJobImpl = getPartialRegenerationJob,
  getOutfitSetImageJobImpl = getOutfitSetImageJob,
  streamCapsuleEventsImpl = capsuleEventHub.subscribe,
  regenerateCapsuleWardrobeHandler = regenerateCapsuleWardrobe,
  regenerateSelectedCapsuleItemsHandler = regenerateSelectedWardrobeItems,
  deleteOutfitSetImageHandler = deleteOutfitSetImage,
  generateOutfitSetImageHandler = generateOutfitSetImage,
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

  async function getCapsuleEventSnapshot(email, capsule) {
    const capsuleId = String(capsule?.id || "").trim();
    const activeJob = capsuleId ? getWardrobeJobImpl(email, capsuleId) : null;
    let snapshotCapsule = capsule;

    if (capsuleId && getCapsuleSnapshotRegeneration(getEffectiveCapsuleSnapshot(capsule)) && activeJob?.status !== "pending") {
      const clearedSnapshot = buildCapsuleSnapshotWithRegeneration(getEffectiveCapsuleSnapshot(capsule), null);
      snapshotCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, clearedSnapshot) || capsule;
      return buildCapsuleEventSnapshot({
        capsule: snapshotCapsule,
        activeJob: {
          status: "failed",
          phase: "failed",
          error: new Error("stale_regeneration")
        },
        partialRegenerationJob: null,
        outfitSetImageJob: capsuleId ? getOutfitSetImageJobImpl(email, capsuleId) : null
      });
    }

    return buildCapsuleEventSnapshot({
      capsule: snapshotCapsule,
      activeJob,
      partialRegenerationJob: capsuleId ? getPartialRegenerationJobImpl(email, capsuleId) : null,
      outfitSetImageJob: capsuleId ? getOutfitSetImageJobImpl(email, capsuleId) : null
    });
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

      const snapshot = await getCapsuleEventSnapshot(req.user.email, capsule);
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

app.get("/auth/passkeys", requireAuth, async (req, res) => {
  try {
    const passkeys = await listPasskeysImpl(req.user.email);
    return res.json({ ok: true, passkeys: passkeys.map(toPasskeyMetadata) });
  } catch (error) {
    console.error("[auth/passkeys/list]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/auth/passkeys/register/options", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    await pruneExpiredPasskeyChallengesImpl();
    const existingPasskeys = await listPasskeysImpl(req.user.email);
    const options = await generateRegistrationOptionsImpl({
      rpName: passkeyRpName,
      rpID: passkeyRpId,
      userName: req.user.email,
      userDisplayName: req.user.email,
      userID: new TextEncoder().encode(req.user.email),
      attestationType: "none",
      supportedAlgorithmIDs: [-7, -257],
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: Array.isArray(passkey.transports)
          ? passkey.transports as AuthenticatorTransportFuture[]
          : []
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred"
      }
    });
    const challengeId = generatePasskeyChallengeId();
    await insertPasskeyChallengeImpl({
      id: challengeId,
      kind: "registration",
      challenge: options.challenge,
      profileEmail: req.user.email,
      expiresAt: new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS)
    });
    setPasskeyChallengeCookie(res, challengeId, nodeEnv);
    return res.json({ ok: true, options });
  } catch (error) {
    console.error("[auth/passkeys/register/options]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/auth/passkeys/register/verify", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  const response = req.body?.response;
  if (!isRegistrationResponse(response)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const challengeId = getPasskeyChallengeId(req);
  if (!challengeId) {
    return res.status(400).json({ error: "passkey_registration_failed" });
  }

  let challenge: PasskeyChallengeRecord | null;
  try {
    challenge = await consumePasskeyChallengeImpl({ id: challengeId, kind: "registration" as PasskeyChallengeKind });
  } catch (error) {
    console.error("[auth/passkeys/register/challenge]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
  clearPasskeyChallengeCookie(res, nodeEnv);

  if (!challenge || challenge.profileEmail !== req.user.email) {
    return res.status(400).json({ error: "passkey_registration_failed" });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponseImpl({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: passkeyOrigin,
      expectedRPID: passkeyRpId,
      requireUserVerification: false,
      supportedAlgorithmIDs: [-7, -257]
    });
  } catch (error) {
    console.error("[auth/passkeys/register/verify]", error);
    return res.status(400).json({ error: "passkey_registration_failed" });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: "passkey_registration_failed" });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  try {
    const passkey = await insertPasskeyImpl({
      profileEmail: req.user.email,
      credentialId: credential.id,
      credentialPublicKey: publicKeyToBase64Url(credential.publicKey),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: Array.isArray(credential.transports) ? credential.transports : [],
      name: "Passkey"
    });
    return res.json({ ok: true, passkey: passkey ? toPasskeyMetadata(passkey) : null });
  } catch (error) {
    console.error("[auth/passkeys/register/store]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/auth/passkeys/authenticate/options", requireTrustedOrigin, async (_req, res) => {
  try {
    await pruneExpiredPasskeyChallengesImpl();
    const options = await generateAuthenticationOptionsImpl({
      rpID: passkeyRpId,
      userVerification: "preferred"
    });
    const challengeId = generatePasskeyChallengeId();
    await insertPasskeyChallengeImpl({
      id: challengeId,
      kind: "authentication",
      challenge: options.challenge,
      profileEmail: null,
      expiresAt: new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS)
    });
    setPasskeyChallengeCookie(res, challengeId, nodeEnv);
    return res.json({ ok: true, options });
  } catch (error) {
    console.error("[auth/passkeys/authenticate/options]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/auth/passkeys/authenticate/verify", requireTrustedOrigin, async (req, res) => {
  const response = req.body?.response;
  if (!isAuthenticationResponse(response)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const challengeId = getPasskeyChallengeId(req);
  if (!challengeId) {
    return res.status(400).json({ error: "passkey_login_failed" });
  }

  let challenge: PasskeyChallengeRecord | null;
  try {
    challenge = await consumePasskeyChallengeImpl({ id: challengeId, kind: "authentication" as PasskeyChallengeKind });
  } catch (error) {
    console.error("[auth/passkeys/authenticate/challenge]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
  clearPasskeyChallengeCookie(res, nodeEnv);

  if (!challenge) {
    return res.status(400).json({ error: "passkey_login_failed" });
  }

  let passkey: PasskeyRecord | null;
  try {
    passkey = await getPasskeyByCredentialIdImpl(response.id);
  } catch (error) {
    console.error("[auth/passkeys/authenticate/lookup]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
  if (!passkey) {
    return res.status(400).json({ error: "passkey_login_failed" });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponseImpl({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: passkeyOrigin,
      expectedRPID: passkeyRpId,
      credential: toWebAuthnCredential(passkey),
      requireUserVerification: false
    });
  } catch (error) {
    console.error("[auth/passkeys/authenticate/verify]", error);
    return res.status(400).json({ error: "passkey_login_failed" });
  }

  if (!verification.verified) {
    return res.status(400).json({ error: "passkey_login_failed" });
  }

  try {
    await updatePasskeyAuthenticationImpl({
      credentialId: passkey.credentialId,
      counter: verification.authenticationInfo.newCounter,
      deviceType: verification.authenticationInfo.credentialDeviceType,
      backedUp: verification.authenticationInfo.credentialBackedUp
    });
    const { sessionId, session } = await createSessionImpl(passkey.profileEmail);
    setSessionCookie(res, sessionId, nodeEnv);
    setCsrfCookie(res, session.csrfToken, nodeEnv);
    return res.json({ ok: true, user: { email: passkey.profileEmail } });
  } catch (error) {
    console.error("[auth/passkeys/authenticate/session]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.delete("/auth/passkeys/:id", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  const passkeyId = String(req.params?.id || "").trim();
  if (!passkeyId) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const deleted = await deletePasskeyByIdForEmailImpl({ email: req.user.email, passkeyId });
    if (!deleted) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("[auth/passkeys/delete]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
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
    return res.json({ ok: true, profile: toProfileResponse(profile) });
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
      profile: toProfileResponse(profile),
      activeCapsule: toCapsuleResponse(activeCapsule),
      activeSnapshot: await getCapsuleEventSnapshot(req.user.email, activeCapsule),
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
    return res.json({
      ok: true,
      capsule: toCapsuleResponse(capsule),
      snapshot: getCapsuleEventSnapshot(req.user.email, capsule)
    });
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

app.post(
  "/capsules/:id/outfit-sets/:setIndex/image",
  requireTrustedOrigin,
  requireAuth,
  requireCsrf,
  generateOutfitSetImageHandler
);

app.delete(
  "/capsules/:id/outfit-sets/:setIndex/image",
  requireTrustedOrigin,
  requireAuth,
  requireCsrf,
  deleteOutfitSetImageHandler
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
    if (validationResult && "error" in validationResult && validationResult.error === "not_found") {
      return res.status(404).json({ error: "not_found" });
    }
    if (validationResult && "error" in validationResult) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    const normalizedRejectedUrls =
      validationResult && "rejectedUrls" in validationResult
        ? validationResult.rejectedUrls
        : [];

    const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
    const nextCapsule = await updateCapsuleSnapshotImpl(req.user.email, req.params.id, {
      filters: effectiveSnapshot?.filters,
      data: {
        wardrobe: effectiveSnapshot?.data?.wardrobe || null,
        rejectedUrls: normalizedRejectedUrls
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
    const pdfBuffer = await buildWardrobePdfInChildImpl(products, String(locale));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", buildPdfDownloadFilename(capsule?.name));
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
    return res.json({ ok: true, ...(result && typeof result === "object" ? result : {}) });
  } catch (error) {
    if (error?.code === "invalid_payload" || error?.message === "invalid_payload") {
      return res.status(400).json({ error: "invalid_payload" });
    }
    console.error("[search/run]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/search/stats", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const result = await getSearchStatsImpl(req.user.email, req.body || {});
    return res.json({ ok: true, ...(result && typeof result === "object" ? result : {}) });
  } catch (error) {
    if (error?.code === "invalid_payload" || error?.message === "invalid_payload") {
      return res.status(400).json({ error: "invalid_payload" });
    }
    console.error("[search/stats]", error);
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
    return res.json({ ok: true, profile: toProfileResponse(profile) });
  } catch (error) {
    console.error("[profile/initialize]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.patch("/profile/me", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  const payload = normalizeProfileSettingsPayload(req.body);
  if (!payload) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await updateProfileImpl(req.user.email, payload);
    if (!profile) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, profile: toProfileResponse(profile) });
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
    return res.json({ ok: true, profile: toProfileResponse(profile) });
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
