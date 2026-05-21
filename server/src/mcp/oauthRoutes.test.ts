import { expect, test } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  SESSION_ID,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";
import {
  createConsentCsrfToken,
  createPkceS256Challenge,
  signAccessToken,
} from "./oauthCrypto.js";
import type { McpOAuthConfig } from "./types.js";

const ISSUER = "https://app.example.test";
const RESOURCE = `${ISSUER}/mcp`;
const CLIENT_ID = "chatgpt-dev";
const REDIRECT_URI = "https://chatgpt.com/oauth/callback";
const DYNAMIC_REDIRECT_URI = "http://127.0.0.1:49387/callback";
const JWT_SECRET = "test-mcp-jwt-secret";
const MCP_ACCEPT = "application/json, text/event-stream";
const CODE_VERIFIER =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
const CODE_CHALLENGE = createPkceS256Challenge(CODE_VERIFIER);

function createTestMcpConfig(
  overrides: Partial<McpOAuthConfig> = {},
): McpOAuthConfig {
  return {
    accessTokenTtlSeconds: 3600,
    allowUnregisteredClients: false,
    allowedClientIds: new Set([CLIENT_ID]),
    allowedClientMetadataHosts: new Set(),
    allowedRedirectOrigins: new Set(),
    allowedRedirectUris: new Set([REDIRECT_URI]),
    authCodeTtlSeconds: 300,
    enabled: true,
    issuer: ISSUER,
    jwtSecret: JWT_SECRET,
    resourceUrl: RESOURCE,
    scopesSupported: [
      "profile:read",
      "wardrobe:read",
      "capsules:read",
      "mcp:read",
    ],
    ...overrides,
  };
}

function authorizePath(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: CODE_CHALLENGE,
    code_challenge_method: "S256",
    scope: "mcp:read wardrobe:read",
    state: "state-1",
    resource: RESOURCE,
    ...overrides,
  });
  return `/oauth/authorize?${params.toString()}`;
}

async function startMcpTestServer(t, overrides: Partial<McpOAuthConfig> = {}) {
  return startTestServer(t, {
    overrides: {
      mcpOAuthConfig: createTestMcpConfig(overrides),
    },
  });
}

async function fetchManual(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, redirect: "manual" });
}

async function registerDynamicClient(
  baseUrl: string,
  body: Record<string, unknown> = {},
) {
  return requestJson(baseUrl, "/oauth/register", {
    method: "POST",
    body: {
      client_name: "Codex",
      redirect_uris: [DYNAMIC_REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      scope: "mcp:read wardrobe:read",
      ...body,
    },
  });
}

function consentBody(
  decision: "allow" | "deny",
  overrides: Record<string, string> = {},
) {
  return new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: CODE_CHALLENGE,
    code_challenge_method: "S256",
    scope: "mcp:read wardrobe:read",
    state: "state-1",
    resource: RESOURCE,
    csrfToken: createConsentCsrfToken(SESSION_ID, CSRF_TOKEN),
    decision,
    ...overrides,
  });
}

async function approveAndExchangeCode(baseUrl: string) {
  const consent = await fetchManual(`${baseUrl}/oauth/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: AUTH_COOKIE,
    },
    body: consentBody("allow"),
  });
  expect(consent.status).toBe(302);
  const redirect = new URL(consent.headers.get("location") || "");
  const code = redirect.searchParams.get("code") || "";
  expect(code).toBeTruthy();
  expect(redirect.searchParams.get("state")).toBe("state-1");

  const token = await requestJson(baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: CODE_VERIFIER,
      resource: RESOURCE,
    },
  });
  expect(token.response.status).toBe(200);
  expect(token.json.token_type).toBe("Bearer");
  return { code, token: String(token.json.access_token || "") };
}

function bearerToken(claims: Record<string, unknown>) {
  const iat = Math.floor(Date.now() / 1000);
  return signAccessToken(
    {
      aud: RESOURCE,
      client_id: CLIENT_ID,
      exp: iat + 3600,
      iat,
      iss: ISSUER,
      scope: "mcp:read",
      sub: "person@example.com",
      token_use: "access",
      ...claims,
    },
    JWT_SECRET,
  );
}

test("mcp oauth metadata endpoints return discoverable JSON", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);

  const resource = await requestJson(
    baseUrl,
    "/.well-known/oauth-protected-resource",
  );
  expect(resource.response.status).toBe(200);
  expect(resource.json).toMatchObject({
    resource: RESOURCE,
    authorization_servers: [`${ISSUER}/.well-known/oauth-authorization-server`],
    bearer_methods_supported: ["header"],
  });

  const server = await requestJson(
    baseUrl,
    "/.well-known/oauth-authorization-server",
  );
  expect(server.response.status).toBe(200);
  expect(server.json).toMatchObject({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/oauth/token`,
    registration_endpoint: `${ISSUER}/oauth/register`,
    code_challenge_methods_supported: ["S256"],
  });

  const openid = await requestJson(
    baseUrl,
    "/.well-known/openid-configuration",
  );
  expect(openid.response.status).toBe(200);
  expect(openid.json.issuer).toBe(ISSUER);
  expect(openid.json.registration_endpoint).toBe(`${ISSUER}/oauth/register`);
});

test("oauth dynamic client registration stores public clients", async (t) => {
  const { baseUrl } = await startMcpTestServer(t, {
    allowedRedirectOrigins: new Set(["http://127.0.0.1"]),
    allowedRedirectUris: new Set(),
  });

  const registration = await registerDynamicClient(baseUrl);

  expect(registration.response.status).toBe(201);
  expect(String(registration.json.client_id)).toMatch(/^mcp-dcr_/);
  expect(registration.json).toMatchObject({
    client_name: "Codex",
    redirect_uris: [DYNAMIC_REDIRECT_URI],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: "mcp:read wardrobe:read",
  });
  expect(typeof registration.json.client_id_issued_at).toBe("number");
});

test("oauth dynamic client registration accepts refresh token grant metadata", async (t) => {
  const { baseUrl } = await startMcpTestServer(t, {
    allowedRedirectOrigins: new Set(["http://127.0.0.1"]),
    allowedRedirectUris: new Set(),
  });

  const registration = await registerDynamicClient(baseUrl, {
    grant_types: ["authorization_code", "refresh_token"],
  });

  expect(registration.response.status).toBe(201);
  expect(String(registration.json.client_id)).toMatch(/^mcp-dcr_/);
  expect(registration.json.grant_types).toEqual(["authorization_code"]);
});

test("oauth dynamic client registration rejects invalid metadata", async (t) => {
  const { baseUrl } = await startMcpTestServer(t, {
    allowedRedirectOrigins: new Set(["http://127.0.0.1"]),
    allowedRedirectUris: new Set(),
  });

  const missingRedirect = await registerDynamicClient(baseUrl, {
    redirect_uris: [],
  });
  expect(missingRedirect.response.status).toBe(400);
  expect(missingRedirect.json.error).toBe("invalid_redirect_uri");

  const badRedirect = await registerDynamicClient(baseUrl, {
    redirect_uris: ["https://attacker.example/callback"],
  });
  expect(badRedirect.response.status).toBe(400);
  expect(badRedirect.json.error).toBe("invalid_redirect_uri");

  const unsupportedAuth = await registerDynamicClient(baseUrl, {
    token_endpoint_auth_method: "client_secret_basic",
  });
  expect(unsupportedAuth.response.status).toBe(400);
  expect(unsupportedAuth.json.error).toBe("invalid_client_metadata");

  const unsupportedGrant = await registerDynamicClient(baseUrl, {
    grant_types: ["client_credentials"],
  });
  expect(unsupportedGrant.response.status).toBe(400);
  expect(unsupportedGrant.json.error).toBe("invalid_client_metadata");

  const unsupportedResponse = await registerDynamicClient(baseUrl, {
    response_types: ["token"],
  });
  expect(unsupportedResponse.response.status).toBe(400);
  expect(unsupportedResponse.json.error).toBe("invalid_client_metadata");

  const unsupportedScope = await registerDynamicClient(baseUrl, {
    scope: "mcp:read wardrobe:write",
  });
  expect(unsupportedScope.response.status).toBe(400);
  expect(unsupportedScope.json.error).toBe("invalid_scope");
});

test("oauth authorize rejects invalid parameters and invalid redirect uri", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);

  const missing = await requestJson(baseUrl, "/oauth/authorize");
  expect(missing.response.status).toBe(400);
  expect(missing.json.error).toBe("invalid_request");

  const plainPkce = await requestJson(
    baseUrl,
    authorizePath({ code_challenge_method: "plain" }),
  );
  expect(plainPkce.response.status).toBe(400);
  expect(plainPkce.json.error).toBe("invalid_request");

  const invalidRedirect = await requestJson(
    baseUrl,
    authorizePath({ redirect_uri: "https://attacker.example/callback" }),
  );
  expect(invalidRedirect.response.status).toBe(400);
  expect(invalidRedirect.json.error).toBe("invalid_redirect_uri");
});

test("oauth authorize rejects unknown unregistered client ids when disabled", async (t) => {
  const { baseUrl } = await startMcpTestServer(t, {
    allowedClientIds: new Set(),
    allowUnregisteredClients: false,
  });

  const response = await requestJson(
    baseUrl,
    authorizePath({ client_id: "unregistered-client" }),
  );

  expect(response.response.status).toBe(400);
  expect(response.json.error).toBe("unauthorized_client");
});

test("oauth authorize can allow unregistered local clients only when explicitly enabled", async (t) => {
  const { baseUrl } = await startMcpTestServer(t, {
    allowedClientIds: new Set(),
    allowUnregisteredClients: true,
  });

  const response = await fetchManual(
    `${baseUrl}${authorizePath({ client_id: "local-dev-client" })}`,
  );

  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toMatch(/^\/\?oauthReturnTo=/);
});

test("oauth authorize redirects anonymous users back through existing app login", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);

  const response = await fetchManual(`${baseUrl}${authorizePath()}`);

  expect(response.status).toBe(302);
  const location = response.headers.get("location") || "";
  expect(location).toMatch(/^\/\?oauthReturnTo=/);
  const loginUrl = new URL(location, baseUrl);
  expect(loginUrl.searchParams.get("oauthReturnTo")).toBe(authorizePath());
});

test("oauth consent page renders and denial redirects to the client", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);

  const page = await fetch(`${baseUrl}${authorizePath()}`, {
    headers: { cookie: AUTH_COOKIE },
  });
  const html = await page.text();
  expect(page.status).toBe(200);
  expect(html).toContain("Capsule Wardrobe MCP");
  expect(html).toContain("person@example.com");
  expect(html).toContain("mcp:read wardrobe:read");

  const denied = await fetchManual(`${baseUrl}/oauth/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: AUTH_COOKIE,
    },
    body: consentBody("deny"),
  });
  expect(denied.status).toBe(302);
  const redirect = new URL(denied.headers.get("location") || "");
  expect(redirect.origin + redirect.pathname).toBe(REDIRECT_URI);
  expect(redirect.searchParams.get("error")).toBe("access_denied");
  expect(redirect.searchParams.get("state")).toBe("state-1");
});

test("oauth PKCE code flow issues an access token accepted by mcp", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);

  const { token } = await approveAndExchangeCode(baseUrl);
  const mcpHeaders = {
    accept: MCP_ACCEPT,
    authorization: `Bearer ${token}`,
  };

  const initialize = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders,
    body: {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "capsule-wardrobe-test-client",
          version: "0.1.0",
        },
      },
    },
  });
  expect(initialize.response.status).toBe(200);
  expect(initialize.json).toMatchObject({
    result: { serverInfo: { name: "capsule-wardrobe-mcp" } },
  });

  const initialized = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders,
    body: { jsonrpc: "2.0", method: "notifications/initialized" },
  });
  expect(initialized.response.status).toBe(202);

  const tools = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders,
    body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
  expect(tools.response.status).toBe(200);
  expect(tools.json.result).toMatchObject({
    tools: [
      {
        name: "ping",
        description:
          "Check that the Capsule Wardrobe MCP server is reachable and authenticated.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  });

  const ping = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders,
    body: {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "ping", arguments: {} },
    },
  });
  expect(ping.response.status).toBe(200);
  expect(ping.json).toMatchObject({
    result: {
      content: [
        {
          type: "text",
          text: expect.stringContaining('"ok":true'),
        },
      ],
      structuredContent: {
        ok: true,
        service: "capsule-wardrobe-mcp",
        authenticated: true,
        subject: "person@example.com",
        scopes: ["mcp:read", "wardrobe:read"],
      },
    },
  });

  const unknown = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders,
    body: { jsonrpc: "2.0", id: 3, method: "unknown/method" },
  });
  expect(unknown.response.status).toBe(200);
  expect(unknown.json).toMatchObject({ error: { code: -32601 } });
});

test("oauth dynamic registered public client completes PKCE flow without client secret", async (t) => {
  const { baseUrl } = await startMcpTestServer(t, {
    allowedRedirectOrigins: new Set(["http://127.0.0.1"]),
    allowedRedirectUris: new Set(),
  });
  const registration = await registerDynamicClient(baseUrl);
  const clientId = String(registration.json.client_id || "");
  expect(clientId).toBeTruthy();

  const consent = await fetchManual(`${baseUrl}/oauth/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: AUTH_COOKIE,
    },
    body: consentBody("allow", {
      client_id: clientId,
      redirect_uri: DYNAMIC_REDIRECT_URI,
    }),
  });
  expect(consent.status).toBe(302);
  const redirect = new URL(consent.headers.get("location") || "");
  const code = redirect.searchParams.get("code") || "";
  expect(redirect.origin + redirect.pathname).toBe(DYNAMIC_REDIRECT_URI);
  expect(code).toBeTruthy();

  const wrongVerifier = await requestJson(baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: DYNAMIC_REDIRECT_URI,
      client_id: clientId,
      code_verifier: "wrong-verifier",
      resource: RESOURCE,
    },
  });
  expect(wrongVerifier.response.status).toBe(400);
  expect(wrongVerifier.json.error).toBe("invalid_grant");

  const token = await requestJson(baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: DYNAMIC_REDIRECT_URI,
      client_id: clientId,
      code_verifier: CODE_VERIFIER,
      resource: RESOURCE,
    },
  });
  expect(token.response.status).toBe(200);
  expect(token.json.token_type).toBe("Bearer");

  const withSecret = await requestJson(baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: DYNAMIC_REDIRECT_URI,
      client_id: clientId,
      code_verifier: CODE_VERIFIER,
      client_secret: "not-supported",
      resource: RESOURCE,
    },
  });
  expect(withSecret.response.status).toBe(400);
  expect(withSecret.json.error).toBe("invalid_client");

  const tools = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: {
      accept: MCP_ACCEPT,
      authorization: `Bearer ${String(token.json.access_token)}`,
    },
    body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
  expect(tools.response.status).toBe(200);
  expect(tools.json).toMatchObject({
    result: {
      tools: [{ name: "ping" }],
    },
  });
});

test("token exchange fails for wrong verifier, reused code, and expired code", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const consent = await fetchManual(`${baseUrl}/oauth/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: AUTH_COOKIE,
    },
    body: consentBody("allow"),
  });
  const code = new URL(consent.headers.get("location") || "").searchParams.get(
    "code",
  );

  const wrongVerifier = await requestJson(baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: "wrong-verifier",
      resource: RESOURCE,
    },
  });
  expect(wrongVerifier.response.status).toBe(400);
  expect(wrongVerifier.json.error).toBe("invalid_grant");

  const success = await requestJson(baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: CODE_VERIFIER,
      resource: RESOURCE,
    },
  });
  expect(success.response.status).toBe(200);

  const reused = await requestJson(baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: CODE_VERIFIER,
      resource: RESOURCE,
    },
  });
  expect(reused.response.status).toBe(400);
  expect(reused.json.error).toBe("invalid_grant");

  const expiredServer = await startMcpTestServer(t, { authCodeTtlSeconds: -1 });
  const expiredConsent = await fetchManual(
    `${expiredServer.baseUrl}/oauth/authorize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        cookie: AUTH_COOKIE,
      },
      body: consentBody("allow"),
    },
  );
  const expiredCode = new URL(
    expiredConsent.headers.get("location") || "",
  ).searchParams.get("code");
  const expired = await requestJson(expiredServer.baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code: expiredCode,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: CODE_VERIFIER,
      resource: RESOURCE,
    },
  });
  expect(expired.response.status).toBe(400);
  expect(expired.json.error).toBe("invalid_grant");
});

test("mcp rejects missing, malformed, wrong audience, wrong scope, and expired tokens", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);

  const missing = await requestJson(baseUrl, "/mcp");
  expect(missing.response.status).toBe(401);
  expect(missing.response.headers.get("www-authenticate")).toContain(
    "/.well-known/oauth-protected-resource",
  );

  const malformed = await requestJson(baseUrl, "/mcp", {
    headers: { authorization: "Bearer not-a-jwt" },
  });
  expect(malformed.response.status).toBe(401);

  const wrongAudience = await requestJson(baseUrl, "/mcp", {
    headers: {
      authorization: `Bearer ${bearerToken({ aud: "https://other.example/mcp" })}`,
    },
  });
  expect(wrongAudience.response.status).toBe(401);

  const wrongScope = await requestJson(baseUrl, "/mcp", {
    headers: {
      authorization: `Bearer ${bearerToken({ scope: "wardrobe:read" })}`,
    },
  });
  expect(wrongScope.response.status).toBe(401);
  expect(wrongScope.json.error).toBe("insufficient_scope");

  const expired = await requestJson(baseUrl, "/mcp", {
    headers: {
      authorization: `Bearer ${bearerToken({
        exp: Math.floor(Date.now() / 1000) - 1,
      })}`,
    },
  });
  expect(expired.response.status).toBe(401);
});
