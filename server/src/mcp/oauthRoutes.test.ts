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
const SEARCH_DESCRIPTION =
  "Search the product catalog with wardrobe-relevant filters. `query` is optional. Use `get_search_options` to discover valid filter values before applying filters. Prefer exact option values from `get_search_options`; do not invent filter values.";
const EXPECTED_SEARCH_ENUMS = {
  category: ["top", "outerwear"],
  season: ["autumn", "winter"],
  formalityLevel: ["casual", "formal"],
  style: ["minimalistic"],
  occasions: ["office"],
  audience: ["woman", "man", "all"],
  color: ["black"],
  pattern: ["solid"],
  silhouette: ["straight"],
  fit: ["regular"],
  closureType: ["button"],
} as const;
type ExpectedSearchEnums = Record<
  keyof typeof EXPECTED_SEARCH_ENUMS,
  readonly string[]
>;
const FALLBACK_SEARCH_ENUMS = {
  category: [
    "bag",
    "belt",
    "bottom",
    "dress",
    "midlayer",
    "other",
    "outerwear",
    "shoes",
    "swimwear",
    "top",
  ],
  season: ["autumn", "spring", "summer", "winter"],
  formalityLevel: ["casual", "formal", "smart_casual"],
  style: [
    "minimalistic",
    "street_style",
    "romantic",
    "preppy",
    "retro",
    "boho",
    "nautical",
    "safari",
    "equestrian",
    "military",
    "grunge",
    "sporty",
  ],
  occasions: ["brunch_in_the_city", "date_night", "everyday_errands", "office"],
  audience: ["woman", "man", "all"],
  color: [
    "beige",
    "black",
    "blue",
    "brown",
    "burgundy",
    "denim",
    "green",
    "grey",
    "khaki",
    "light blue",
    "metallic",
    "multicolor",
    "navy",
    "orange",
    "pink",
    "purple",
    "red",
    "white",
    "yellow",
  ],
  pattern: [
    "abstract",
    "argyle",
    "cable",
    "camo",
    "check",
    "color_block",
    "corduroy",
    "crocodile",
    "floral",
    "graphic",
    "herringbone",
    "houndstooth",
    "jacquard",
    "lace",
    "leopard",
    "logo",
    "marble",
    "paisley",
    "polka_dot",
    "quilted",
    "ribbed",
    "snake",
    "solid",
    "stripe",
    "tie_dye",
    "waffle",
    "zebra",
  ],
  silhouette: [
    "a_line",
    "asymmetric",
    "balloon",
    "barrel",
    "belted",
    "boxy",
    "cocoon",
    "cropped",
    "draped",
    "fit_and_flare",
    "flare",
    "peplum",
    "straight",
    "tapered",
    "wide_leg",
    "wrap",
  ],
  fit: ["loose", "oversized", "regular", "relaxed", "skinny", "slim"],
  closureType: [
    "buckle",
    "button",
    "drawstring",
    "elastic",
    "hook_and_eye",
    "lace_up",
    "magnetic",
    "snap",
    "tie_belt",
    "toggle",
    "velcro",
    "zipper",
  ],
} as const;

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

async function startMcpTestServerWithDependencyOverrides(
  t,
  dependencyOverrides: Record<string, unknown>,
) {
  return startTestServer(t, {
    overrides: {
      mcpOAuthConfig: createTestMcpConfig(),
      ...dependencyOverrides,
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

function mcpHeaders(token: string) {
  return {
    accept: MCP_ACCEPT,
    authorization: `Bearer ${token}`,
  };
}

async function callMcpTool(
  baseUrl: string,
  token: string,
  name: string,
  args: Record<string, unknown>,
) {
  return requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders(token),
    body: {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });
}

async function listMcpTools(baseUrl: string, token: string) {
  return requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders(token),
    body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
}

type McpResult = Record<string, unknown> & {
  structuredContent?: Record<string, unknown> & {
    items?: Record<string, unknown>[];
    item?: Record<string, unknown>;
  };
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
};

function mcpResult(response): McpResult {
  return (response.json.result || {}) as McpResult;
}

function getMcpTool(response, name: string) {
  return mcpResult(response).tools?.find((tool) => tool.name === name);
}

function expectMcpToolNames(response) {
  expect(mcpResult(response).tools?.map((tool) => tool.name)).toEqual([
    "ping",
    "get_search_options",
    "search",
    "fetch",
  ]);
}

function expectSearchFacetEnum(
  inputSchema: Record<string, unknown>,
  field: keyof typeof EXPECTED_SEARCH_ENUMS,
  expectedEnums: ExpectedSearchEnums,
) {
  const properties = inputSchema.properties as Record<
    string,
    Record<string, unknown>
  >;
  const property = properties[field] || {};
  const items = property.items as Record<string, unknown>;
  expect(property.type).toBe("array");
  expect(items.type).toBe("string");
  expect(items.enum).toEqual([...expectedEnums[field]]);
}

function expectSearchSchemaEnums(
  inputSchema: Record<string, unknown>,
  expectedEnums: ExpectedSearchEnums,
) {
  for (const field of Object.keys(expectedEnums) as Array<
    keyof typeof EXPECTED_SEARCH_ENUMS
  >) {
    expectSearchFacetEnum(inputSchema, field, expectedEnums);
  }
}

function expectNoInternalSearchFields(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("distance");
  expect(serialized).not.toContain("savedSearch");
  expect(serialized).not.toContain("pageSize");
  expect(serialized).not.toContain('"page"');
  expect(serialized).not.toContain("embedding");
}

function minimalSearchOptions(overrides: Record<string, unknown> = {}) {
  return {
    brands: [{ value: "zara", label: "Zara" }],
    categories: ["top"],
    seasons: ["autumn"],
    formalityLevels: ["casual"],
    styles: ["minimalistic"],
    occasions: ["office"],
    audience: ["woman"],
    colors: ["black"],
    patterns: ["solid"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["button"],
    priceRange: { min: 10, max: 250 },
    ...overrides,
  };
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
  const headers = mcpHeaders(token);

  const initialize = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers,
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
    headers,
    body: { jsonrpc: "2.0", method: "notifications/initialized" },
  });
  expect(initialized.response.status).toBe(202);

  const tools = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers,
    body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
  expect(tools.response.status).toBe(200);
  expectMcpToolNames(tools);
  expect(mcpResult(tools).tools?.[0]).toMatchObject({
    name: "ping",
    description:
      "Check that the Capsule Wardrobe MCP server is reachable and authenticated.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  });
  expect(getMcpTool(tools, "get_search_options")).toMatchObject({
    name: "get_search_options",
    description: "Return allowed filter values for product catalog search.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  });

  const searchTool = getMcpTool(tools, "search");
  expect(searchTool?.description).toBe(SEARCH_DESCRIPTION);
  const searchInputSchema = searchTool?.inputSchema || {};
  expect(searchInputSchema.required || []).not.toContain("query");
  expectSearchSchemaEnums(searchInputSchema, EXPECTED_SEARCH_ENUMS);
  const searchProperties = searchInputSchema.properties as Record<
    string,
    Record<string, unknown>
  >;
  const brandItems = searchProperties.brand?.items as Record<string, unknown>;
  expect(searchProperties.brand?.type).toBe("array");
  expect(brandItems.type).toBe("string");
  expect(brandItems).not.toHaveProperty("enum");

  const ping = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers,
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
    headers,
    body: { jsonrpc: "2.0", id: 3, method: "unknown/method" },
  });
  expect(unknown.response.status).toBe(200);
  expect(unknown.json).toMatchObject({ error: { code: -32601 } });
});

test("mcp get_search_options matches search options endpoint", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const httpOptions = await requestJson(baseUrl, "/search/options", {
    cookie: AUTH_COOKIE,
  });
  expect(httpOptions.response.status).toBe(200);

  const mcpOptions = await callMcpTool(
    baseUrl,
    token,
    "get_search_options",
    {},
  );
  expect(mcpOptions.response.status).toBe(200);
  expect(mcpResult(mcpOptions).structuredContent).toEqual(httpOptions.json);
});

test("mcp search schema uses cached dynamic search options", async (t) => {
  let optionsCalls = 0;
  const { baseUrl } = await startMcpTestServerWithDependencyOverrides(t, {
    getSearchOptionsImpl: async () => {
      optionsCalls += 1;
      return minimalSearchOptions({
        categories: ["dress"],
        colors: ["red"],
        fits: ["slim"],
      });
    },
  });
  const token = bearerToken({
    scope: "mcp:read wardrobe:read",
    sub: "schema-cache@example.com",
  });

  const firstTools = await listMcpTools(baseUrl, token);
  const secondTools = await listMcpTools(baseUrl, token);

  expect(firstTools.response.status).toBe(200);
  expect(secondTools.response.status).toBe(200);
  expect(optionsCalls).toBe(1);
  const searchInputSchema = getMcpTool(firstTools, "search")?.inputSchema || {};
  expectSearchSchemaEnums(searchInputSchema, {
    category: ["dress"],
    season: ["autumn"],
    formalityLevel: ["casual"],
    style: ["minimalistic"],
    occasions: ["office"],
    audience: ["woman"],
    color: ["red"],
    pattern: ["solid"],
    silhouette: ["straight"],
    fit: ["slim"],
    closureType: ["button"],
  });
});

test("mcp search schema falls back when search options are unavailable", async (t) => {
  const { baseUrl } = await startMcpTestServerWithDependencyOverrides(t, {
    getSearchOptionsImpl: async () => {
      throw new Error("search_options_down");
    },
  });
  const token = bearerToken({
    scope: "mcp:read wardrobe:read",
    sub: "schema-fallback@example.com",
  });

  const tools = await listMcpTools(baseUrl, token);

  expect(tools.response.status).toBe(200);
  const searchInputSchema = getMcpTool(tools, "search")?.inputSchema || {};
  expectSearchSchemaEnums(searchInputSchema, FALLBACK_SEARCH_ENUMS);
});

test("mcp product search accepts empty, query, filters, and pagination inputs", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const empty = await callMcpTool(baseUrl, token, "search", {});
  expect(empty.response.status).toBe(200);
  expect(mcpResult(empty).structuredContent).toMatchObject({
    ok: true,
    total: 1,
    offset: 0,
    limit: 20,
  });

  const queryOnly = await callMcpTool(baseUrl, token, "search", {
    query: "black blazer",
  });
  expect(queryOnly.response.status).toBe(200);
  expect(mcpResult(queryOnly).structuredContent?.ok).toBe(true);

  const filtersOnly = await callMcpTool(baseUrl, token, "search", {
    brand: ["acme"],
    category: ["outerwear"],
  });
  expect(filtersOnly.response.status).toBe(200);
  expect(mcpResult(filtersOnly).structuredContent?.ok).toBe(true);

  const queryWithFilters = await callMcpTool(baseUrl, token, "search", {
    query: "black blazer",
    color: ["black"],
    offset: 5,
    limit: 75,
  });
  expect(queryWithFilters.response.status).toBe(200);
  expect(mcpResult(queryWithFilters).structuredContent).toMatchObject({
    ok: true,
    offset: 5,
    limit: 50,
  });
});

test("mcp product search returns sanitized preview items", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const search = await callMcpTool(baseUrl, token, "search", {
    query: "black blazer",
  });

  expect(search.response.status).toBe(200);
  const output = mcpResult(search).structuredContent;
  expect(output?.items?.[0]).toEqual({
    id: "product-1",
    name: "Black Blazer",
    url: "https://example.com/products/black-blazer",
    brand: "Acme",
    price: 120,
    currency: "USD",
    imageUrl: "https://example.com/products/black-blazer.jpg",
    category: "jacket",
    colorBase: ["black"],
    season: ["autumn", "winter"],
    style: ["minimalistic"],
    formalityLevel: ["formal"],
    isSavedToWardrobe: true,
  });
  expectNoInternalSearchFields(mcpResult(search));
});

test("mcp product fetch returns sanitized detail by id and url", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const byId = await callMcpTool(baseUrl, token, "fetch", {
    id: "product-1",
  });
  expect(byId.response.status).toBe(200);
  expect(mcpResult(byId).structuredContent).toEqual({
    ok: true,
    item: {
      id: "product-1",
      name: "Black Blazer",
      url: "https://example.com/products/black-blazer",
      description: "A tailored black blazer.",
      brand: "Acme",
      price: 120,
      currency: "USD",
      availability: "in_stock",
      imageUrl: "https://example.com/products/black-blazer.jpg",
      audience: "woman",
      category: "jacket",
      season: ["autumn", "winter"],
      formalityLevel: ["formal"],
      style: ["minimalistic"],
      occasions: ["office"],
      colorBase: ["black"],
      pattern: "solid",
      finish: "matte",
      isNeutral: true,
      composition: "wool",
      silhouette: "tailored",
      fit: "regular",
      closureType: ["button"],
      isSavedToWardrobe: true,
    },
  });
  expectNoInternalSearchFields(mcpResult(byId));

  const byUrl = await callMcpTool(baseUrl, token, "fetch", {
    url: "https://example.com/products/black-blazer",
  });
  expect(byUrl.response.status).toBe(200);
  expect(mcpResult(byUrl).structuredContent?.item?.id).toBe("product-1");
  expectNoInternalSearchFields(mcpResult(byUrl));
});

test("mcp product fetch rejects missing or conflicting identifiers", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const neither = await callMcpTool(baseUrl, token, "fetch", {});
  expect(neither.response.status).toBe(200);
  expect(mcpResult(neither)).toMatchObject({
    isError: true,
    structuredContent: { ok: false, error: "invalid_payload" },
  });

  const both = await callMcpTool(baseUrl, token, "fetch", {
    id: "product-1",
    url: "https://example.com/products/black-blazer",
  });
  expect(both.response.status).toBe(200);
  expect(mcpResult(both)).toMatchObject({
    isError: true,
    structuredContent: { ok: false, error: "invalid_payload" },
  });
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
  expectMcpToolNames(tools);
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
