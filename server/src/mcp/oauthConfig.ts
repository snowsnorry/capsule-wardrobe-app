/* eslint-disable complexity */
import {
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  MCP_ALLOWED_CLIENT_IDS,
  MCP_ALLOWED_CLIENT_METADATA_HOSTS,
  MCP_ALLOWED_REDIRECT_ORIGINS,
  MCP_ALLOWED_REDIRECT_URIS,
  MCP_AUTH_CODE_TTL_SECONDS,
  MCP_JWT_SECRET,
  MCP_OAUTH_ENABLED,
  MCP_OAUTH_ISSUER,
  MCP_RESOURCE_URL,
  NODE_ENV,
} from "../appConfig.js";
import { MCP_READ_SCOPES, type McpOAuthConfig } from "./types.js";

function parseCsvSet(value: string | undefined): Set<string> {
  return new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeIssuer(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function createMcpOAuthConfig(
  overrides: Partial<McpOAuthConfig> = {},
): McpOAuthConfig {
  const enabled = overrides.enabled ?? MCP_OAUTH_ENABLED;
  const issuer = normalizeIssuer(overrides.issuer ?? MCP_OAUTH_ISSUER);
  const resourceUrl = String(overrides.resourceUrl ?? MCP_RESOURCE_URL).trim();
  const allowedClientIds =
    overrides.allowedClientIds ?? parseCsvSet(MCP_ALLOWED_CLIENT_IDS);
  const allowedClientMetadataHosts =
    overrides.allowedClientMetadataHosts ??
    parseCsvSet(MCP_ALLOWED_CLIENT_METADATA_HOSTS);
  const allowedRedirectOrigins =
    overrides.allowedRedirectOrigins ??
    parseCsvSet(MCP_ALLOWED_REDIRECT_ORIGINS);

  if (NODE_ENV !== "production" && allowedRedirectOrigins.size === 0) {
    allowedRedirectOrigins.add("https://chatgpt.com");
    allowedRedirectOrigins.add("https://chat.openai.com");
  }

  const config: McpOAuthConfig = {
    accessTokenTtlSeconds: parsePositiveInteger(
      overrides.accessTokenTtlSeconds,
      MCP_ACCESS_TOKEN_TTL_SECONDS,
    ),
    allowUnregisteredClients:
      NODE_ENV === "production"
        ? false
        : (overrides.allowUnregisteredClients ??
          (allowedClientIds.size === 0 &&
            allowedClientMetadataHosts.size === 0)),
    allowedClientIds,
    allowedClientMetadataHosts,
    allowedRedirectOrigins,
    allowedRedirectUris:
      overrides.allowedRedirectUris ?? parseCsvSet(MCP_ALLOWED_REDIRECT_URIS),
    authCodeTtlSeconds: parsePositiveInteger(
      overrides.authCodeTtlSeconds,
      MCP_AUTH_CODE_TTL_SECONDS,
    ),
    enabled,
    issuer,
    jwtSecret: overrides.jwtSecret ?? MCP_JWT_SECRET,
    resourceUrl,
    scopesSupported: overrides.scopesSupported ?? MCP_READ_SCOPES,
  };

  if (enabled && NODE_ENV === "production") {
    const hasRedirectAllowlist =
      config.allowedRedirectUris.size > 0 ||
      config.allowedRedirectOrigins.size > 0;
    if (!issuer || !resourceUrl || !config.jwtSecret || !hasRedirectAllowlist) {
      throw new Error("mcp_oauth_production_config_incomplete");
    }
  }

  return config;
}

export function buildIssuerUrl(
  config: McpOAuthConfig,
  pathname: string,
): string {
  return `${config.issuer}${pathname}`;
}
