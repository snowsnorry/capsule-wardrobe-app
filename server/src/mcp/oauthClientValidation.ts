import { readString } from "./oauthRequestHelpers.js";
import { hasValidRedirect } from "./oauthRedirects.js";
import { isScopeSubset, parseScopes, scopesToKey } from "./oauthScopes.js";
import type {
  McpAuthorizationRequest,
  McpOAuthClientMetadata,
  McpOAuthConfig,
  McpReadScope,
  McpRegisteredClientRow,
} from "./types.js";

type ResolvedOAuthClient = {
  kind: "configured" | "registered" | "metadata";
  metadata?: McpOAuthClientMetadata;
  registeredClient?: McpRegisteredClientRow;
};

function isConfiguredClientId(
  config: McpOAuthConfig,
  clientId: string,
): boolean {
  if (config.allowedClientIds.has(clientId)) {
    return true;
  }

  return config.allowUnregisteredClients && !clientId.startsWith("https://");
}

async function resolveOAuthClient({
  clientId,
  config,
  context,
}: {
  clientId: string;
  config: McpOAuthConfig;
  context;
}): Promise<ResolvedOAuthClient | null> {
  if (isConfiguredClientId(config, clientId)) {
    return { kind: "configured" };
  }

  const registeredClient = await context.getMcpRegisteredClientImpl?.(clientId);
  if (registeredClient) {
    return { kind: "registered", registeredClient };
  }

  const metadata = await fetchClientMetadata(config, clientId);
  if (metadata) {
    return { kind: "metadata", metadata };
  }

  return null;
}

function isAllowedMetadataClientId(
  config: McpOAuthConfig,
  clientId: string,
): boolean {
  try {
    const url = new URL(clientId);
    return (
      url.protocol === "https:" &&
      config.allowedClientMetadataHosts.has(url.hostname)
    );
  } catch {
    return false;
  }
}

function registeredClientAllowsScopes(
  resolvedClient: ResolvedOAuthClient,
  requestedScopes: string,
): boolean {
  return (
    resolvedClient.kind !== "registered" ||
    !resolvedClient.registeredClient?.scope ||
    isScopeSubset(requestedScopes, resolvedClient.registeredClient.scope)
  );
}

function validateRequestedScopes({
  config,
  rawScope,
  resolvedClient,
}: {
  config: McpOAuthConfig;
  rawScope: string;
  resolvedClient: ResolvedOAuthClient;
}): McpReadScope[] | null {
  const scopes = parseScopes(config, rawScope);
  if (!scopes) {
    return null;
  }

  return registeredClientAllowsScopes(resolvedClient, scopesToKey(scopes))
    ? scopes
    : null;
}

async function fetchClientMetadata(
  config: McpOAuthConfig,
  clientId: string,
): Promise<McpOAuthClientMetadata | null> {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }

  if (!isAllowedMetadataClientId(config, clientId)) {
    return null;
  }

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const metadata = (await response.json()) as Record<string, unknown>;
  const redirectUris = Array.isArray(metadata.redirect_uris)
    ? metadata.redirect_uris.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  if (redirectUris.length === 0) {
    return null;
  }

  return {
    clientName: readString(metadata.client_name),
    redirectUris,
  };
}

async function validateRedirectForClient({
  config,
  redirectUri,
  resolvedClient,
}: {
  config: McpOAuthConfig;
  redirectUri: string;
  resolvedClient: ResolvedOAuthClient;
}): Promise<boolean> {
  if (!hasValidRedirect(config, redirectUri)) {
    return false;
  }

  if (resolvedClient.kind === "registered") {
    return Boolean(
      resolvedClient.registeredClient?.redirectUris.includes(redirectUri),
    );
  }

  if (resolvedClient.kind === "metadata") {
    return Boolean(resolvedClient.metadata?.redirectUris.includes(redirectUri));
  }

  return true;
}

export async function validateAuthorizationRequest(
  query: Record<string, unknown>,
  config: McpOAuthConfig,
  context,
): Promise<McpAuthorizationRequest | { error: string }> {
  const request = {
    clientId: readString(query.client_id),
    codeChallenge: readString(query.code_challenge),
    codeChallengeMethod: readString(query.code_challenge_method),
    redirectUri: readString(query.redirect_uri),
    resource: readString(query.resource) || config.resourceUrl,
    responseType: readString(query.response_type),
    scope: readString(query.scope),
    state: readString(query.state),
  };

  if (
    request.responseType !== "code" ||
    !request.clientId ||
    !request.redirectUri ||
    !request.codeChallenge ||
    request.codeChallengeMethod !== "S256" ||
    !request.state
  ) {
    return { error: "invalid_request" };
  }

  if (request.resource !== config.resourceUrl) {
    return { error: "invalid_target" };
  }

  const resolvedClient = await resolveOAuthClient({
    clientId: request.clientId,
    config,
    context,
  });
  if (!resolvedClient) {
    return { error: "unauthorized_client" };
  }

  if (
    !(await validateRedirectForClient({
      config,
      redirectUri: request.redirectUri,
      resolvedClient,
    }))
  ) {
    return { error: "invalid_redirect_uri" };
  }

  const scopes = validateRequestedScopes({
    config,
    rawScope: request.scope,
    resolvedClient,
  });
  if (!scopes) {
    return { error: "invalid_scope" };
  }

  return {
    clientId: request.clientId,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: "S256",
    redirectUri: request.redirectUri,
    resource: request.resource,
    responseType: "code",
    scopes,
    state: request.state,
  };
}
