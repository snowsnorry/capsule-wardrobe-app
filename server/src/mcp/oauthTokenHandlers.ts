import { logError, logInfo } from "../logger.js";
import {
  createPkceS256Challenge,
  createRefreshToken,
  hashOAuthSecret,
  signAccessToken,
} from "./oauthCrypto.js";
import { readString } from "./oauthRequestHelpers.js";
import { isScopeSubset, parseScopes, scopesToKey } from "./oauthScopes.js";
import type {
  McpOAuthConfig,
  McpRefreshTokenRow,
  McpRegisteredClientRow,
} from "./types.js";

function buildTokenResponse({
  clientId,
  config,
  refreshToken,
  resource,
  scope,
  userEmail,
}: {
  clientId: string;
  config: McpOAuthConfig;
  refreshToken?: string;
  resource: string;
  scope: string;
  userEmail: string;
}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const accessToken = signAccessToken(
    {
      aud: resource,
      client_id: clientId,
      exp: issuedAt + config.accessTokenTtlSeconds,
      iat: issuedAt,
      iss: config.issuer,
      scope,
      sub: userEmail,
      token_use: "access",
    },
    config.jwtSecret,
  );

  return {
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    token_type: "Bearer",
    expires_in: config.accessTokenTtlSeconds,
    scope,
  };
}

function registeredClientAllowsRefreshToken(
  registeredClient: McpRegisteredClientRow | null,
): boolean {
  return (
    !registeredClient || registeredClient.grantTypes.includes("refresh_token")
  );
}

async function clientAllowsRefreshToken({
  clientId,
  context,
}: {
  clientId: string;
  context;
}): Promise<boolean> {
  const registeredClient = await context.getMcpRegisteredClientImpl?.(clientId);
  return registeredClientAllowsRefreshToken(registeredClient || null);
}

async function issueRefreshToken({
  clientId,
  config,
  context,
  resource,
  scopes,
  userEmail,
}: {
  clientId: string;
  config: McpOAuthConfig;
  context;
  resource: string;
  scopes: string;
  userEmail: string;
}): Promise<string> {
  const refreshToken = createRefreshToken();
  await context.insertMcpRefreshTokenImpl({
    clientId,
    expiresAt: new Date(Date.now() + config.refreshTokenTtlSeconds * 1000),
    resource,
    scopes,
    tokenHash: hashOAuthSecret(refreshToken),
    userEmail,
  });
  return refreshToken;
}

function hasUsableRefreshToken(
  refreshToken: McpRefreshTokenRow | null,
): refreshToken is McpRefreshTokenRow {
  if (!refreshToken || refreshToken.revokedAt || refreshToken.consumedAt) {
    return false;
  }

  return new Date(refreshToken.expiresAt).getTime() > Date.now();
}

function parseAuthorizationCodeTokenInput(req, config: McpOAuthConfig) {
  const input = {
    code: readString(req.body?.code),
    redirectUri: readString(req.body?.redirect_uri),
    clientId: readString(req.body?.client_id),
    verifier: readString(req.body?.code_verifier),
    resource: readString(req.body?.resource) || config.resourceUrl,
  };

  if (!input.code || !input.redirectUri || !input.clientId || !input.verifier) {
    return { error: "invalid_request" };
  }

  if (input.resource !== config.resourceUrl) {
    return { error: "invalid_target" };
  }

  return input;
}

export async function handleAuthorizationCodeTokenRequest({
  config,
  context,
  req,
  res,
}) {
  const input = parseAuthorizationCodeTokenInput(req, config);
  if ("error" in input) {
    logInfo("[mcp/oauth/token/failure]", { error: input.error });
    return res.status(400).json({ error: input.error });
  }

  try {
    const authCode = await context.consumeMcpAuthorizationCodeImpl({
      clientId: input.clientId,
      codeChallenge: createPkceS256Challenge(input.verifier),
      codeHash: hashOAuthSecret(input.code),
      redirectUri: input.redirectUri,
      resource: input.resource,
    });

    if (!authCode) {
      logInfo("[mcp/oauth/token/failure]", { error: "invalid_grant" });
      return res.status(400).json({ error: "invalid_grant" });
    }

    const refreshToken = (await clientAllowsRefreshToken({
      clientId: authCode.clientId,
      context,
    }))
      ? await issueRefreshToken({
          clientId: authCode.clientId,
          config,
          context,
          resource: authCode.resource,
          scopes: authCode.scopes,
          userEmail: authCode.userEmail,
        })
      : undefined;

    logInfo("[mcp/oauth/token/success]", {
      clientId: input.clientId,
      subject: authCode.userEmail,
    });
    return res.json(
      buildTokenResponse({
        clientId: authCode.clientId,
        config,
        refreshToken,
        resource: authCode.resource,
        scope: authCode.scopes,
        userEmail: authCode.userEmail,
      }),
    );
  } catch (error) {
    logError("[mcp/oauth/token]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
}

function parseRefreshTokenInput(req, config: McpOAuthConfig) {
  const input = {
    clientId: readString(req.body?.client_id),
    refreshToken: readString(req.body?.refresh_token),
    resource: readString(req.body?.resource) || config.resourceUrl,
    requestedScope: readString(req.body?.scope),
  };

  if (!input.clientId || !input.refreshToken) {
    return { error: "invalid_request" };
  }

  if (input.resource !== config.resourceUrl) {
    return { error: "invalid_target" };
  }

  return input;
}

function resolveMatchingRefreshToken({
  clientId,
  existing,
  resource,
}: {
  clientId: string;
  existing: McpRefreshTokenRow | null;
  resource: string;
}): McpRefreshTokenRow | null {
  return hasUsableRefreshToken(existing) &&
    existing.clientId === clientId &&
    existing.resource === resource
    ? existing
    : null;
}

export async function handleRefreshTokenGrantRequest({
  config,
  context,
  req,
  res,
}) {
  const input = parseRefreshTokenInput(req, config);
  if ("error" in input) {
    logInfo("[mcp/oauth/token/failure]", { error: input.error });
    return res.status(400).json({ error: input.error });
  }

  try {
    const tokenHash = hashOAuthSecret(input.refreshToken);
    const existing = await context.getMcpRefreshTokenImpl(tokenHash);
    const matchingRefreshToken = resolveMatchingRefreshToken({
      clientId: input.clientId,
      existing,
      resource: input.resource,
    });
    if (!matchingRefreshToken) {
      logInfo("[mcp/oauth/token/failure]", { error: "invalid_grant" });
      return res.status(400).json({ error: "invalid_grant" });
    }

    if (
      !(await clientAllowsRefreshToken({ clientId: input.clientId, context }))
    ) {
      logInfo("[mcp/oauth/token/failure]", { error: "invalid_grant" });
      return res.status(400).json({ error: "invalid_grant" });
    }

    const effectiveScopes = resolveRefreshTokenScopes({
      config,
      existingScopes: matchingRefreshToken.scopes,
      requestedScope: input.requestedScope,
    });
    if (!effectiveScopes) {
      return res.status(400).json({ error: "invalid_scope" });
    }

    const nextRefreshToken = createRefreshToken();
    const rotated = await context.rotateMcpRefreshTokenImpl({
      clientId: input.clientId,
      expiresAt: new Date(Date.now() + config.refreshTokenTtlSeconds * 1000),
      newTokenHash: hashOAuthSecret(nextRefreshToken),
      resource: input.resource,
      scopes: effectiveScopes,
      tokenHash,
    });

    if (!rotated) {
      logInfo("[mcp/oauth/token/failure]", { error: "invalid_grant" });
      return res.status(400).json({ error: "invalid_grant" });
    }

    logInfo("[mcp/oauth/token/refresh-success]", {
      clientId: input.clientId,
      subject: rotated.userEmail,
    });
    return res.json(
      buildTokenResponse({
        clientId: rotated.clientId,
        config,
        refreshToken: nextRefreshToken,
        resource: rotated.resource,
        scope: rotated.scopes,
        userEmail: rotated.userEmail,
      }),
    );
  } catch (error) {
    logError("[mcp/oauth/token]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
}

function resolveRefreshTokenScopes({
  config,
  existingScopes,
  requestedScope,
}: {
  config: McpOAuthConfig;
  existingScopes: string;
  requestedScope: string;
}): string | null {
  if (!requestedScope) {
    return existingScopes;
  }

  const scopes = parseScopes(config, requestedScope);
  if (!scopes) {
    logInfo("[mcp/oauth/token/failure]", { error: "invalid_scope" });
    return null;
  }

  const requestedScopes = scopesToKey(scopes);
  if (!isScopeSubset(requestedScopes, existingScopes)) {
    logInfo("[mcp/oauth/token/failure]", { error: "invalid_scope" });
    return null;
  }

  return requestedScopes;
}
