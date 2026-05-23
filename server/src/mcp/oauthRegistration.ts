import {
  hasOnlyAllowedValues,
  isJsonObject,
  readOptionalStringArray,
  readString,
  readStringArray,
} from "./oauthRequestHelpers.js";
import { hasValidRedirect } from "./oauthRedirects.js";
import { parseScopes, scopesToKey } from "./oauthScopes.js";
import type {
  McpOAuthConfig,
  McpOAuthGrantTypes,
  McpRegisteredClientRow,
} from "./types.js";

type RegistrationBody = Record<string, unknown>;

function grantTypesToKey(grantTypes: readonly string[]): McpOAuthGrantTypes {
  return grantTypes.includes("refresh_token")
    ? "authorization_code refresh_token"
    : "authorization_code";
}

function grantTypesFromKey(grantTypes: string): string[] {
  return grantTypes.includes("refresh_token")
    ? ["authorization_code", "refresh_token"]
    : ["authorization_code"];
}

function parseRegistrationScope(
  config: McpOAuthConfig,
  scope: unknown,
): string | null | { error: string } {
  if (scope === undefined) {
    return null;
  }

  const rawScope = readString(scope);
  if (!rawScope) {
    return { error: "invalid_scope" };
  }

  const scopes = parseScopes(config, rawScope);
  if (!scopes) {
    return { error: "invalid_scope" };
  }

  return scopesToKey(scopes);
}

function validateRegistrationRedirectUris(
  body: RegistrationBody,
  config: McpOAuthConfig,
): string[] | { error: string } {
  const redirectUris = readStringArray(body.redirect_uris);
  if (
    redirectUris.length === 0 ||
    redirectUris.length !== (body.redirect_uris as unknown[])?.length ||
    redirectUris.some((redirectUri) => !hasValidRedirect(config, redirectUri))
  ) {
    return { error: "invalid_redirect_uri" };
  }

  return [...new Set(redirectUris)];
}

function validateTokenEndpointAuth(
  body: RegistrationBody,
): { error: string } | null {
  const tokenEndpointAuthMethod = readString(
    body.token_endpoint_auth_method ?? "none",
  );
  return tokenEndpointAuthMethod !== "none" || "client_secret" in body
    ? { error: "invalid_client_metadata" }
    : null;
}

function validateGrantTypes(
  body: RegistrationBody,
): string[] | { error: string } {
  const grantTypes = readOptionalStringArray(body.grant_types, [
    "authorization_code",
  ]);
  if (
    !grantTypes ||
    !grantTypes.includes("authorization_code") ||
    !hasOnlyAllowedValues(grantTypes, ["authorization_code", "refresh_token"])
  ) {
    return { error: "invalid_client_metadata" };
  }

  return grantTypes;
}

function validateResponseTypes(
  body: RegistrationBody,
): { error: string } | null {
  const responseTypes = readOptionalStringArray(body.response_types, ["code"]);
  return !responseTypes ||
    responseTypes.length !== 1 ||
    responseTypes[0] !== "code"
    ? { error: "invalid_client_metadata" }
    : null;
}

export function validateRegistrationRequest(
  body: unknown,
  config: McpOAuthConfig,
):
  | {
      clientName: string | null;
      grantTypes: McpOAuthGrantTypes;
      redirectUris: string[];
      scope: string | null;
    }
  | { error: string } {
  if (!isJsonObject(body)) {
    return { error: "invalid_client_metadata" };
  }

  const redirectUris = validateRegistrationRedirectUris(body, config);
  if ("error" in redirectUris) {
    return redirectUris;
  }

  const tokenEndpointAuth = validateTokenEndpointAuth(body);
  if (tokenEndpointAuth) {
    return tokenEndpointAuth;
  }

  const grantTypes = validateGrantTypes(body);
  if ("error" in grantTypes) {
    return grantTypes;
  }

  const responseTypes = validateResponseTypes(body);
  if (responseTypes) {
    return responseTypes;
  }

  const scope = parseRegistrationScope(config, body.scope);
  if (typeof scope === "object" && scope !== null) {
    return scope;
  }

  return {
    clientName: readString(body.client_name) || null,
    grantTypes: grantTypesToKey(grantTypes),
    redirectUris,
    scope: typeof scope === "string" ? scope : null,
  };
}

function clientIssuedAt(createdAt: string | Date): number {
  const millis = new Date(createdAt).getTime();
  return Number.isFinite(millis)
    ? Math.floor(millis / 1000)
    : Math.floor(Date.now() / 1000);
}

export function buildRegistrationResponse(client: McpRegisteredClientRow) {
  return {
    client_id: client.clientId,
    client_id_issued_at: clientIssuedAt(client.createdAt),
    client_name: client.clientName || undefined,
    redirect_uris: client.redirectUris,
    response_types: ["code"],
    grant_types: grantTypesFromKey(client.grantTypes),
    token_endpoint_auth_method: "none",
    scope: client.scope || undefined,
  };
}
