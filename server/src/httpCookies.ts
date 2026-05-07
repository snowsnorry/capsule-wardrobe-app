import { SESSION_TTL_MS } from "./authStore.js";
import {
  CLIENT_ORIGIN,
  NODE_ENV,
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_TTL_MS,
} from "./appConfig.js";

export type CookieMap = Record<string, string>;

export function parseCookies(cookieHeader = ""): CookieMap {
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

function appendCookie(res, parts: string[], secure: boolean) {
  if (secure) {
    parts.push("Secure");
  }
  res.append("Set-Cookie", parts.join("; "));
}

export function setSessionCookie(res, sessionId, nodeEnv = NODE_ENV) {
  const secure = nodeEnv === "production";
  appendCookie(
    res,
    [
      `session=${encodeURIComponent(sessionId)}`,
      "HttpOnly",
      "Path=/",
      `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
      `SameSite=${secure ? "None" : "Lax"}`,
    ],
    secure,
  );
}

export function setCsrfCookie(res, csrfToken, nodeEnv = NODE_ENV) {
  const secure = nodeEnv === "production";
  appendCookie(
    res,
    [
      `csrf=${encodeURIComponent(csrfToken)}`,
      "Path=/",
      `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
      `SameSite=${secure ? "None" : "Lax"}`,
    ],
    secure,
  );
}

export function setPasskeyChallengeCookie(
  res,
  challengeId,
  nodeEnv = NODE_ENV,
) {
  const secure = nodeEnv === "production";
  appendCookie(
    res,
    [
      `${PASSKEY_CHALLENGE_COOKIE}=${encodeURIComponent(challengeId)}`,
      "HttpOnly",
      "Path=/",
      `Max-Age=${Math.floor(PASSKEY_CHALLENGE_TTL_MS / 1000)}`,
      `SameSite=${secure ? "None" : "Lax"}`,
    ],
    secure,
  );
}

export function clearPasskeyChallengeCookie(res, nodeEnv = NODE_ENV) {
  const secure = nodeEnv === "production";
  appendCookie(
    res,
    [
      `${PASSKEY_CHALLENGE_COOKIE}=`,
      "HttpOnly",
      "Path=/",
      "Max-Age=0",
      `SameSite=${secure ? "None" : "Lax"}`,
    ],
    secure,
  );
}

export function clearSessionCookie(res, nodeEnv = NODE_ENV) {
  const secure = nodeEnv === "production";
  const sameSite = secure ? "None" : "Lax";
  appendCookie(
    res,
    ["session=", "HttpOnly", "Path=/", "Max-Age=0", `SameSite=${sameSite}`],
    secure,
  );
  appendCookie(
    res,
    ["csrf=", "Path=/", "Max-Age=0", `SameSite=${sameSite}`],
    secure,
  );
}

export function isTrustedOrigin(req, clientOrigin = CLIENT_ORIGIN) {
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

export function readCsrfHeader(req) {
  const raw = req.headers["x-csrf-token"];
  if (Array.isArray(raw)) {
    return String(raw[0] || "").trim();
  }
  return String(raw || "").trim();
}
