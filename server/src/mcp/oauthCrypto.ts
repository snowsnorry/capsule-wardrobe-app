import crypto from "node:crypto";
import type { McpAccessTokenClaims } from "./types.js";

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlJson(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function signHmacSha256(input: string, secret: string): string {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(input).digest(),
  );
}

function parseJsonObject(input: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function createAuthorizationCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function createRegisteredClientId(): string {
  return `mcp-dcr_${crypto.randomBytes(24).toString("base64url")}`;
}

export function hashOAuthSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function createConsentCsrfToken(
  sessionId: string,
  csrfToken: string,
): string {
  return hashOAuthSecret(`${sessionId}:${csrfToken}:mcp-oauth-consent`);
}

export function createPkceS256Challenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function signAccessToken(
  claims: McpAccessTokenClaims,
  secret: string,
): string {
  const encodedHeader = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const encodedPayload = base64UrlJson(claims);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  return `${signingInput}.${signHmacSha256(signingInput, secret)}`;
}

export function verifyAccessTokenSignature(
  token: string,
  secret: string,
): McpAccessTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const header = parseJsonObject(
    Buffer.from(encodedHeader, "base64url").toString("utf8"),
  );
  if (header?.alg !== "HS256" || header?.typ !== "JWT") {
    return null;
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = signHmacSha256(signingInput, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  const claims = parseJsonObject(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  );
  if (!claims) {
    return null;
  }

  return claims as McpAccessTokenClaims;
}
