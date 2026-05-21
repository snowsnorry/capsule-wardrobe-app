/* eslint-disable complexity, max-lines, max-lines-per-function */
import { parseCookies } from "../httpCookies.js";
import { logError, logInfo } from "../logger.js";
import { buildIssuerUrl, createMcpOAuthConfig } from "./oauthConfig.js";
import {
  createAuthorizationCode,
  createConsentCsrfToken,
  createPkceS256Challenge,
  createRefreshToken,
  createRegisteredClientId,
  hashOAuthSecret,
  signAccessToken,
} from "./oauthCrypto.js";
import {
  type McpAuthorizationRequest,
  type McpOAuthGrantTypes,
  type McpOAuthClientMetadata,
  type McpOAuthConfig,
  type McpReadScope,
  type McpRefreshTokenRow,
  type McpRegisteredClientRow,
} from "./types.js";

const CONSENT_APP_NAME = "Capsule Wardrobe MCP";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scopesToKey(scopes: readonly string[]): string {
  return [...scopes].sort().join(" ");
}

function scopesFromKey(scopes: string): string[] {
  return scopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function isScopeSubset(
  requestedScopes: string,
  grantedScopes: string,
): boolean {
  const granted = new Set(scopesFromKey(grantedScopes));
  return scopesFromKey(requestedScopes).every((scope) => granted.has(scope));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => readString(entry)).filter(Boolean)
    : [];
}

function redirectWithOAuthError(
  redirectUri: string,
  state: string,
  error: string,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) {
    url.searchParams.set("state", state);
  }
  return url.toString();
}

function hasValidRedirect(
  config: McpOAuthConfig,
  redirectUri: string,
): boolean {
  if (config.allowedRedirectUris.has(redirectUri)) {
    return true;
  }

  try {
    const redirectUrl = new URL(redirectUri);
    if (config.allowedRedirectOrigins.has(redirectUrl.origin)) {
      return true;
    }

    return [...config.allowedRedirectOrigins].some((allowedOrigin) =>
      allowsLoopbackRedirectOrigin(allowedOrigin, redirectUrl),
    );
  } catch {
    return false;
  }
}

function normalizeLoopbackHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isLoopbackHost(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(
    normalizeLoopbackHost(hostname),
  );
}

function allowsLoopbackRedirectOrigin(
  allowedOrigin: string,
  redirectUrl: URL,
): boolean {
  let allowedUrl: URL;
  try {
    allowedUrl = new URL(allowedOrigin);
  } catch {
    return false;
  }

  return (
    isLoopbackHost(allowedUrl.hostname) &&
    isLoopbackHost(redirectUrl.hostname) &&
    normalizeLoopbackHost(allowedUrl.hostname) ===
      normalizeLoopbackHost(redirectUrl.hostname) &&
    allowedUrl.protocol === redirectUrl.protocol
  );
}

function isConfiguredClientId(
  config: McpOAuthConfig,
  clientId: string,
): boolean {
  if (config.allowedClientIds.has(clientId)) {
    return true;
  }

  return config.allowUnregisteredClients && !clientId.startsWith("https://");
}

type ResolvedOAuthClient = {
  kind: "configured" | "registered" | "metadata";
  metadata?: McpOAuthClientMetadata;
  registeredClient?: McpRegisteredClientRow;
};

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

function parseScopes(
  config: McpOAuthConfig,
  rawScope: string,
): McpReadScope[] | null {
  const requested = rawScope
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (requested.length === 0) {
    return null;
  }

  const supported = new Set(config.scopesSupported);
  if (requested.some((scope) => !supported.has(scope as McpReadScope))) {
    return null;
  }

  return requested as McpReadScope[];
}

async function validateAuthorizationRequest(
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

  const scopes = parseScopes(config, request.scope);
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

async function readAppSession(req, context) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.session;
  if (!sessionId) {
    return null;
  }

  const session = await context.getSessionImpl(sessionId);
  if (!session) {
    return null;
  }

  return { session, sessionId };
}

function buildLoginRedirect(req): string {
  return `/?oauthReturnTo=${encodeURIComponent(req.originalUrl)}`;
}

function renderConsentPage({
  authRequest,
  csrfToken,
  signedInUser,
}: {
  authRequest: McpAuthorizationRequest;
  csrfToken: string;
  signedInUser: string;
}): string {
  const hiddenInputs = [
    ["response_type", authRequest.responseType],
    ["client_id", authRequest.clientId],
    ["redirect_uri", authRequest.redirectUri],
    ["code_challenge", authRequest.codeChallenge],
    ["code_challenge_method", authRequest.codeChallengeMethod],
    ["scope", scopesToKey(authRequest.scopes)],
    ["state", authRequest.state],
    ["resource", authRequest.resource],
    ["csrfToken", csrfToken],
  ]
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${CONSENT_APP_NAME}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #17202a; }
    main { max-width: 560px; margin: 12vh auto; padding: 28px; background: #fff; border: 1px solid #dce1e7; border-radius: 8px; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 10px 16px; }
    dt { color: #5d6978; }
    dd { margin: 0; word-break: break-word; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    button { border: 1px solid #0f172a; border-radius: 6px; padding: 10px 14px; background: #fff; color: #0f172a; cursor: pointer; }
    button[value="allow"] { background: #0f172a; color: #fff; }
  </style>
</head>
<body>
  <main>
    <h1>${CONSENT_APP_NAME}</h1>
    <p>Allow ChatGPT to connect to your Capsule Wardrobe account with read-only MCP access.</p>
    <dl>
      <dt>Client</dt><dd>${escapeHtml(authRequest.clientId)}</dd>
      <dt>Scopes</dt><dd>${escapeHtml(scopesToKey(authRequest.scopes))}</dd>
      <dt>Signed in as</dt><dd>${escapeHtml(signedInUser)}</dd>
    </dl>
    <form method="post" action="/oauth/authorize">
      ${hiddenInputs}
      <div class="actions">
        <button type="submit" name="decision" value="allow">Allow</button>
        <button type="submit" name="decision" value="deny">Deny</button>
      </div>
    </form>
  </main>
</body>
</html>`;
}

async function issueAuthorizationCode({
  authRequest,
  context,
  userEmail,
}: {
  authRequest: McpAuthorizationRequest;
  context;
  userEmail: string;
}): Promise<string> {
  const code = createAuthorizationCode();
  await context.insertMcpAuthorizationCodeImpl({
    clientId: authRequest.clientId,
    codeChallenge: authRequest.codeChallenge,
    codeChallengeMethod: authRequest.codeChallengeMethod,
    codeHash: hashOAuthSecret(code),
    expiresAt: new Date(
      Date.now() + context.mcpOAuthConfig.authCodeTtlSeconds * 1000,
    ),
    redirectUri: authRequest.redirectUri,
    resource: authRequest.resource,
    scopes: scopesToKey(authRequest.scopes),
    userEmail,
  });
  return code;
}

async function redirectWithAuthorizationCode({
  authRequest,
  context,
  res,
  userEmail,
}: {
  authRequest: McpAuthorizationRequest;
  context;
  res;
  userEmail: string;
}) {
  const code = await issueAuthorizationCode({
    authRequest,
    context,
    userEmail,
  });
  const redirectUrl = new URL(authRequest.redirectUri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", authRequest.state);
  logInfo("[mcp/oauth/authorize/success]", {
    clientId: authRequest.clientId,
    scopes: scopesToKey(authRequest.scopes),
    subject: userEmail,
  });
  return res.redirect(302, redirectUrl.toString());
}

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

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readOptionalStringArray(
  value: unknown,
  fallback: string[],
): string[] | null {
  if (value === undefined) {
    return fallback;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const values = value.map((entry) => readString(entry));
  return values.length > 0 && values.every(Boolean) ? values : null;
}

function hasOnlyAllowedValues(
  values: readonly string[],
  allowedValues: readonly string[],
): boolean {
  const allowed = new Set(allowedValues);
  return values.every((value) => allowed.has(value));
}

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

function validateRegistrationRequest(
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

  const redirectUris = readStringArray(body.redirect_uris);
  if (
    redirectUris.length === 0 ||
    redirectUris.length !== (body.redirect_uris as unknown[])?.length ||
    redirectUris.some((redirectUri) => !hasValidRedirect(config, redirectUri))
  ) {
    return { error: "invalid_redirect_uri" };
  }

  const tokenEndpointAuthMethod = readString(
    body.token_endpoint_auth_method ?? "none",
  );
  if (tokenEndpointAuthMethod !== "none" || "client_secret" in body) {
    return { error: "invalid_client_metadata" };
  }

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

  const responseTypes = readOptionalStringArray(body.response_types, ["code"]);
  if (
    !responseTypes ||
    responseTypes.length !== 1 ||
    responseTypes[0] !== "code"
  ) {
    return { error: "invalid_client_metadata" };
  }

  const scope = parseRegistrationScope(config, body.scope);
  if (typeof scope === "object" && scope !== null) {
    return scope;
  }

  return {
    clientName: readString(body.client_name) || null,
    grantTypes: grantTypesToKey(grantTypes),
    redirectUris: [...new Set(redirectUris)],
    scope: typeof scope === "string" ? scope : null,
  };
}

function clientIssuedAt(createdAt: string | Date): number {
  const millis = new Date(createdAt).getTime();
  return Number.isFinite(millis)
    ? Math.floor(millis / 1000)
    : Math.floor(Date.now() / 1000);
}

function buildRegistrationResponse(client: McpRegisteredClientRow) {
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

async function handleAuthorizationCodeTokenRequest({
  config,
  context,
  req,
  res,
}) {
  const code = readString(req.body?.code);
  const redirectUri = readString(req.body?.redirect_uri);
  const clientId = readString(req.body?.client_id);
  const verifier = readString(req.body?.code_verifier);
  const resource = readString(req.body?.resource) || config.resourceUrl;

  if (!code || !redirectUri || !clientId || !verifier) {
    logInfo("[mcp/oauth/token/failure]", { error: "invalid_request" });
    return res.status(400).json({ error: "invalid_request" });
  }

  if (resource !== config.resourceUrl) {
    logInfo("[mcp/oauth/token/failure]", { error: "invalid_target" });
    return res.status(400).json({ error: "invalid_target" });
  }

  try {
    const authCode = await context.consumeMcpAuthorizationCodeImpl({
      clientId,
      codeChallenge: createPkceS256Challenge(verifier),
      codeHash: hashOAuthSecret(code),
      redirectUri,
      resource,
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
      clientId,
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

async function handleRefreshTokenGrantRequest({ config, context, req, res }) {
  const clientId = readString(req.body?.client_id);
  const refreshToken = readString(req.body?.refresh_token);
  const resource = readString(req.body?.resource) || config.resourceUrl;
  const requestedScope = readString(req.body?.scope);

  if (!clientId || !refreshToken) {
    logInfo("[mcp/oauth/token/failure]", { error: "invalid_request" });
    return res.status(400).json({ error: "invalid_request" });
  }

  if (resource !== config.resourceUrl) {
    logInfo("[mcp/oauth/token/failure]", { error: "invalid_target" });
    return res.status(400).json({ error: "invalid_target" });
  }

  try {
    const tokenHash = hashOAuthSecret(refreshToken);
    const existing = await context.getMcpRefreshTokenImpl(tokenHash);
    if (
      !hasUsableRefreshToken(existing) ||
      existing.clientId !== clientId ||
      existing.resource !== resource
    ) {
      logInfo("[mcp/oauth/token/failure]", { error: "invalid_grant" });
      return res.status(400).json({ error: "invalid_grant" });
    }

    if (!(await clientAllowsRefreshToken({ clientId, context }))) {
      logInfo("[mcp/oauth/token/failure]", { error: "invalid_grant" });
      return res.status(400).json({ error: "invalid_grant" });
    }

    let effectiveScopes = existing.scopes;
    if (requestedScope) {
      const scopes = parseScopes(config, requestedScope);
      if (!scopes) {
        logInfo("[mcp/oauth/token/failure]", { error: "invalid_scope" });
        return res.status(400).json({ error: "invalid_scope" });
      }

      const requestedScopes = scopesToKey(scopes);
      if (!isScopeSubset(requestedScopes, existing.scopes)) {
        logInfo("[mcp/oauth/token/failure]", { error: "invalid_scope" });
        return res.status(400).json({ error: "invalid_scope" });
      }
      effectiveScopes = requestedScopes;
    }

    const nextRefreshToken = createRefreshToken();
    const rotated = await context.rotateMcpRefreshTokenImpl({
      clientId,
      expiresAt: new Date(Date.now() + config.refreshTokenTtlSeconds * 1000),
      newTokenHash: hashOAuthSecret(nextRefreshToken),
      resource,
      scopes: effectiveScopes,
      tokenHash,
    });

    if (!rotated) {
      logInfo("[mcp/oauth/token/failure]", { error: "invalid_grant" });
      return res.status(400).json({ error: "invalid_grant" });
    }

    logInfo("[mcp/oauth/token/refresh-success]", {
      clientId,
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

export function registerMcpOAuthRoutes(app, context) {
  const config = context.mcpOAuthConfig ?? createMcpOAuthConfig();
  if (!config.enabled) {
    return;
  }

  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json({
      resource: config.resourceUrl,
      resource_name: CONSENT_APP_NAME,
      authorization_servers: [
        buildIssuerUrl(config, "/.well-known/oauth-authorization-server"),
      ],
      bearer_methods_supported: ["header"],
      scopes_supported: config.scopesSupported,
    });
  });

  const authorizationServerMetadata = {
    issuer: config.issuer,
    authorization_endpoint: buildIssuerUrl(config, "/oauth/authorize"),
    token_endpoint: buildIssuerUrl(config, "/oauth/token"),
    registration_endpoint: buildIssuerUrl(config, "/oauth/register"),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: config.scopesSupported,
    resource_parameter_supported: true,
  };

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json(authorizationServerMetadata);
  });

  app.get("/.well-known/openid-configuration", (_req, res) => {
    res.json(authorizationServerMetadata);
  });

  app.post(
    "/oauth/register",
    context.oauthRegisterLimiter,
    async (req, res) => {
      const registration = validateRegistrationRequest(req.body, config);
      if ("error" in registration) {
        logInfo("[mcp/oauth/register/failure]", { error: registration.error });
        return res.status(400).json({ error: registration.error });
      }

      try {
        const client = await context.insertMcpRegisteredClientImpl({
          clientId: createRegisteredClientId(),
          clientName: registration.clientName,
          grantTypes: registration.grantTypes,
          redirectUris: registration.redirectUris,
          scope: registration.scope,
        });
        logInfo("[mcp/oauth/register/success]", {
          clientId: client.clientId,
          redirectUriCount: client.redirectUris.length,
        });
        return res.status(201).json(buildRegistrationResponse(client));
      } catch (error) {
        logError("[mcp/oauth/register]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.get("/oauth/authorize", async (req, res) => {
    const authRequest = await validateAuthorizationRequest(
      req.query,
      config,
      context,
    );
    if ("error" in authRequest) {
      logInfo("[mcp/oauth/authorize/failure]", { error: authRequest.error });
      return res.status(400).json({ error: authRequest.error });
    }

    let sessionInfo;
    try {
      sessionInfo = await readAppSession(req, context);
    } catch (error) {
      logError("[mcp/oauth/authorize/session]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }

    if (!sessionInfo) {
      return res.redirect(302, buildLoginRedirect(req));
    }

    const scopes = scopesToKey(authRequest.scopes);
    if (
      await context.hasActiveMcpGrantImpl({
        clientId: authRequest.clientId,
        resource: authRequest.resource,
        scopes,
        userEmail: sessionInfo.session.email,
      })
    ) {
      return redirectWithAuthorizationCode({
        authRequest,
        context,
        res,
        userEmail: sessionInfo.session.email,
      });
    }

    return res
      .status(200)
      .type("html")
      .send(
        renderConsentPage({
          authRequest,
          csrfToken: createConsentCsrfToken(
            sessionInfo.sessionId,
            sessionInfo.session.csrfToken,
          ),
          signedInUser: sessionInfo.session.email,
        }),
      );
  });

  app.post("/oauth/authorize", async (req, res) => {
    const authRequest = await validateAuthorizationRequest(
      req.body,
      config,
      context,
    );
    if ("error" in authRequest) {
      logInfo("[mcp/oauth/authorize/consent-failure]", {
        error: authRequest.error,
      });
      return res.status(400).json({ error: authRequest.error });
    }

    let sessionInfo;
    try {
      sessionInfo = await readAppSession(req, context);
    } catch (error) {
      logError("[mcp/oauth/authorize/consent-session]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }

    if (!sessionInfo) {
      return res.redirect(302, buildLoginRedirect(req));
    }

    const cookies = parseCookies(req.headers.cookie);
    const expectedCsrf = createConsentCsrfToken(
      sessionInfo.sessionId,
      sessionInfo.session.csrfToken,
    );
    if (
      readString(req.body?.csrfToken) !== expectedCsrf ||
      cookies.csrf !== sessionInfo.session.csrfToken
    ) {
      return res.status(403).json({ error: "csrf_invalid" });
    }

    if (readString(req.body?.decision) !== "allow") {
      logInfo("[mcp/oauth/authorize/denied]", {
        clientId: authRequest.clientId,
        subject: sessionInfo.session.email,
      });
      return res.redirect(
        302,
        redirectWithOAuthError(
          authRequest.redirectUri,
          authRequest.state,
          "access_denied",
        ),
      );
    }

    const scopes = scopesToKey(authRequest.scopes);
    await context.upsertMcpGrantImpl({
      clientId: authRequest.clientId,
      resource: authRequest.resource,
      scopes,
      userEmail: sessionInfo.session.email,
    });

    return redirectWithAuthorizationCode({
      authRequest,
      context,
      res,
      userEmail: sessionInfo.session.email,
    });
  });

  app.post("/oauth/token", async (req, res) => {
    if (req.headers.authorization || readString(req.body?.client_secret)) {
      logInfo("[mcp/oauth/token/failure]", { error: "invalid_client" });
      return res.status(400).json({ error: "invalid_client" });
    }

    const grantType = readString(req.body?.grant_type);
    if (grantType === "authorization_code") {
      return handleAuthorizationCodeTokenRequest({ config, context, req, res });
    }

    if (grantType === "refresh_token") {
      return handleRefreshTokenGrantRequest({ config, context, req, res });
    }

    logInfo("[mcp/oauth/token/failure]", { error: "invalid_request" });
    return res.status(400).json({ error: "invalid_request" });
  });
}
