/* eslint-disable complexity */
import { logInfo } from "../logger.js";
import { buildIssuerUrl, createMcpOAuthConfig } from "./oauthConfig.js";
import { verifyAccessTokenSignature } from "./oauthCrypto.js";
import {
  MCP_READ_SCOPES,
  type McpAuthenticatedSubject,
  type McpReadScope,
} from "./types.js";

function quoteChallengeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildBearerChallenge({
  config,
  error,
  scope,
}: {
  config;
  error?: string;
  scope?: string;
}) {
  const params = [
    'realm="capsule-wardrobe-mcp"',
    `resource_metadata="${quoteChallengeValue(
      buildIssuerUrl(config, "/.well-known/oauth-protected-resource"),
    )}"`,
  ];
  if (error) {
    params.push(`error="${quoteChallengeValue(error)}"`);
  }
  if (scope) {
    params.push(`scope="${quoteChallengeValue(scope)}"`);
  }
  return `Bearer ${params.join(", ")}`;
}

function parseBearerToken(req): string {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function parseScopes(scope: string): string[] {
  return scope
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unauthorized(res, config, error = "invalid_token") {
  res.setHeader(
    "WWW-Authenticate",
    buildBearerChallenge({
      config,
      error,
      scope: "mcp:read",
    }),
  );
  return res.status(401).json({ error });
}

function missingToken(res, config) {
  res.setHeader("WWW-Authenticate", buildBearerChallenge({ config }));
  return res.status(401).json({ error: "missing_token" });
}

export function createMcpAuthMiddleware(context) {
  const config = context.mcpOAuthConfig ?? createMcpOAuthConfig();

  return function requireMcpBearerToken(req, res, next) {
    if (!config.enabled) {
      return res.status(404).json({ error: "not_found" });
    }

    const token = parseBearerToken(req);
    if (!token) {
      logInfo("[mcp/access/failure]", { error: "missing_token" });
      return missingToken(res, config);
    }

    const claims = verifyAccessTokenSignature(token, config.jwtSecret);
    const now = Math.floor(Date.now() / 1000);
    const scopes = claims ? parseScopes(String(claims.scope || "")) : [];
    const hasReadScope = scopes.includes("mcp:read");
    const scopeSet = new Set<string>(MCP_READ_SCOPES);
    const scopesAreSupported = scopes.every((scope) => scopeSet.has(scope));

    if (
      !claims ||
      claims.iss !== config.issuer ||
      claims.aud !== config.resourceUrl ||
      claims.token_use !== "access" ||
      !claims.sub ||
      !claims.client_id ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= now ||
      !hasReadScope ||
      !scopesAreSupported
    ) {
      logInfo("[mcp/access/failure]", {
        error: "invalid_token",
        reason: claims ? "claims" : "signature",
      });
      return unauthorized(
        res,
        config,
        hasReadScope ? "invalid_token" : "insufficient_scope",
      );
    }

    req.mcpAuth = {
      clientId: claims.client_id,
      scopes: scopes as McpReadScope[],
      subject: claims.sub,
    } satisfies McpAuthenticatedSubject;
    logInfo("[mcp/access/success]", {
      clientId: claims.client_id,
      subject: claims.sub,
    });
    return next();
  };
}
