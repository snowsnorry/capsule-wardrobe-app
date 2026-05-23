import { expect, test, vi } from "vitest";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  SESSION_ID,
  TEST_CLIENT_ORIGIN,
  requestJson,
  startTestServer,
} from "../test/serverRouteTestUtils.js";
import {
  createConsentCsrfToken,
  createPkceS256Challenge,
  hashOAuthSecret,
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
  "Search the product catalog with wardrobe-relevant filters. Include optional natural-language `query` with filters for more precise matches when the desired item or style is easier to describe. Use `get_search_options` to discover valid filter values before applying filters. Prefer exact option values from `get_search_options`; do not invent filter values. The textual result includes markdown image links; clients that support OpenAI output templates may render the product grid directly.";
const STATS_DESCRIPTION =
  "Return product catalog result counts and facet statistics for wardrobe-relevant filters. Use `get_search_options` to discover valid filter values before applying filters. Prefer exact option values from `get_search_options`; do not invent filter values.";
const WARDROBE_ITEMS_DESCRIPTION =
  "Return the authenticated user's wardrobe items, including uploaded items and saved catalog items. Optionally filter by `source`: `uploaded` or `from_catalog`. When the user asks to display, show, render, view, or visualize the wardrobe, call `render_wardrobe_grid` immediately with the returned `items` before answering.";
const PRODUCT_GRID_WIDGET_URI = "ui://capsule/product-grid.v7.html";
const PRODUCT_DETAIL_WIDGET_URI = "ui://capsule/product-detail.v7.html";
const WARDROBE_GRID_WIDGET_URI = "ui://capsule/wardrobe-grid.v7.html";
const CARD_GRID_WIDGET_MIME_TYPE = "text/html;profile=mcp-app";
const BLACK_BLAZER_THUMBNAIL_URL =
  "https://assets.capsule-wardrobe.org/thumbnails/e8a4045eda747e670055011d0588e0cec8f1dc531cc81b55dcad75de337f0209_640.webp";
const SAVED_BLAZER_THUMBNAIL_URL =
  "https://assets.capsule-wardrobe.org/thumbnails/c09464120c85f978fc7a0f1e5481fb8402ed0905843ed4326324830fdd280196_640.webp";
const EXPECTED_READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
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
    refreshTokenTtlSeconds: 2592000,
    resourceUrl: RESOURCE,
    scopesSupported: [
      "mcp:read",
      "profile:read",
      "wardrobe:read",
      "capsules:read",
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
  expect(String(token.json.refresh_token || "")).toBeTruthy();
  return {
    code,
    refreshToken: String(token.json.refresh_token || ""),
    token: String(token.json.access_token || ""),
  };
}

async function refreshAccessToken(
  baseUrl: string,
  refreshToken: string,
  body: Record<string, unknown> = {},
) {
  return requestJson(baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      resource: RESOURCE,
      ...body,
    },
  });
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

async function listMcpResources(baseUrl: string, token: string) {
  return requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders(token),
    body: { jsonrpc: "2.0", id: 1, method: "resources/list" },
  });
}

async function readMcpResource(baseUrl: string, token: string, uri: string) {
  return requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders(token),
    body: {
      jsonrpc: "2.0",
      id: 1,
      method: "resources/read",
      params: { uri },
    },
  });
}

type McpResult = Record<string, unknown> & {
  _meta?: {
    cards?: Record<string, unknown>[];
    itemsById?: Record<string, Record<string, unknown>>;
    ui?: Record<string, unknown>;
  };
  content?: Array<Record<string, unknown>>;
  structuredContent?: Record<string, unknown> & {
    items?: Record<string, unknown>[];
    item?: Record<string, unknown>;
    stats?: Record<string, unknown>;
  };
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  }>;
  resources?: Array<{
    uri: string;
    name?: string;
    title?: string;
    description?: string;
    mimeType?: string;
    _meta?: Record<string, unknown>;
  }>;
  contents?: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    _meta?: Record<string, unknown>;
  }>;
};

function mcpResult(response): McpResult {
  return (response.json.result || {}) as McpResult;
}

function getMcpTool(response, name: string) {
  return mcpResult(response).tools?.find((tool) => tool.name === name);
}

function getMcpResource(response, uri: string) {
  return mcpResult(response).resources?.find(
    (resource) => resource.uri === uri,
  );
}

function expectMcpToolNames(response) {
  expect(mcpResult(response).tools?.map((tool) => tool.name)).toEqual([
    "ping",
    "get_search_options",
    "search",
    "render_product_grid",
    "stats",
    "fetch",
    "render_product_detail",
    "wardrobe_items",
    "render_wardrobe_grid",
  ]);
}

function expectReadOnlyToolMetadata(response, name: string) {
  const tool = getMcpTool(response, name);
  expect(tool?.annotations).toMatchObject(EXPECTED_READ_ONLY_TOOL_ANNOTATIONS);
}

function expectOutputSchemaProperties(
  response,
  name: string,
  expectedProperties: readonly string[],
) {
  const outputSchema = getMcpTool(response, name)?.outputSchema || {};
  const properties = outputSchema.properties as Record<string, unknown>;
  expect(outputSchema.type).toBe("object");
  expect(Object.keys(properties || {})).toEqual(
    expect.arrayContaining([...expectedProperties]),
  );
  expect(outputSchema.required).toEqual(
    expect.arrayContaining([...expectedProperties]),
  );
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

function expectNoPrivateWardrobeFields(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("createdAt");
  expect(serialized).not.toContain("email");
  expect(serialized).not.toContain("embedding");
  expect(serialized).not.toContain("productId");
  expect(serialized).not.toContain("profileEmail");
  expect(serialized).not.toContain("rawImageUrl");
  expect(serialized).not.toContain("updatedAt");
}

function expectShortTextSummary(response, text: string) {
  const expectedContent = [{ type: "text", text }];
  expect(mcpResult(response).content).toEqual(expectedContent);
}

function expectedBlackBlazerProduct() {
  return {
    id: "product-1",
    name: "Black Blazer",
    brand: "Acme",
    url: "https://example.com/products/black-blazer",
    description: "A tailored black blazer.",
    price: {
      amount: 120,
      currency: "USD",
      display: "120 USD",
    },
    availability: "in_stock",
    image: BLACK_BLAZER_THUMBNAIL_URL,
    audience: "woman",
    category: "jacket",
    attributes: {
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
  };
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
    authorization_servers: [ISSUER],
    bearer_methods_supported: ["header"],
    scopes_supported: [
      "mcp:read",
      "profile:read",
      "wardrobe:read",
      "capsules:read",
    ],
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
    grant_types_supported: ["authorization_code", "refresh_token"],
  });

  const openid = await requestJson(
    baseUrl,
    "/.well-known/openid-configuration",
  );
  expect(openid.response.status).toBe(200);
  expect(openid.json.issuer).toBe(ISSUER);
  expect(openid.json.registration_endpoint).toBe(`${ISSUER}/oauth/register`);
  expect(openid.json.grant_types_supported).toEqual([
    "authorization_code",
    "refresh_token",
  ]);
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
  expect(registration.json.grant_types).toEqual([
    "authorization_code",
    "refresh_token",
  ]);
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
  for (const toolName of [
    "ping",
    "get_search_options",
    "search",
    "render_product_grid",
    "stats",
    "fetch",
    "render_product_detail",
    "wardrobe_items",
    "render_wardrobe_grid",
  ]) {
    expectReadOnlyToolMetadata(tools, toolName);
  }
  expectOutputSchemaProperties(tools, "ping", [
    "ok",
    "service",
    "authenticated",
    "subject",
    "scopes",
  ]);
  expectOutputSchemaProperties(tools, "get_search_options", [
    "ok",
    "brands",
    "categories",
    "seasons",
    "formalityLevels",
    "styles",
    "occasions",
    "audience",
    "colors",
    "patterns",
    "silhouettes",
    "fits",
    "closureTypes",
    "priceRange",
  ]);
  expectOutputSchemaProperties(tools, "search", [
    "resultType",
    "count",
    "items",
    "total",
    "offset",
    "limit",
  ]);
  expectOutputSchemaProperties(tools, "render_product_grid", [
    "resultType",
    "count",
    "items",
    "total",
    "offset",
    "limit",
  ]);
  expectOutputSchemaProperties(tools, "stats", ["ok", "total", "stats"]);
  expect(
    getMcpTool(tools, "stats")?.outputSchema?.properties,
  ).not.toHaveProperty("priceBuckets");
  expectOutputSchemaProperties(tools, "fetch", ["resultType", "item", "items"]);
  expectOutputSchemaProperties(tools, "render_product_detail", [
    "resultType",
    "item",
    "items",
  ]);
  expectOutputSchemaProperties(tools, "wardrobe_items", [
    "resultType",
    "count",
    "items",
  ]);
  expectOutputSchemaProperties(tools, "render_wardrobe_grid", [
    "resultType",
    "count",
    "items",
  ]);
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
  expect(searchTool?._meta).toMatchObject({
    ui: {
      resourceUri: PRODUCT_GRID_WIDGET_URI,
    },
    "openai/outputTemplate": PRODUCT_GRID_WIDGET_URI,
  });
  expect(getMcpTool(tools, "render_product_grid")?._meta).toMatchObject({
    ui: {
      resourceUri: PRODUCT_GRID_WIDGET_URI,
    },
    "openai/outputTemplate": PRODUCT_GRID_WIDGET_URI,
  });
  const searchInputSchema = searchTool?.inputSchema || {};
  expect(searchInputSchema.required || []).not.toContain("query");
  expectSearchSchemaEnums(searchInputSchema, EXPECTED_SEARCH_ENUMS);
  const searchProperties = searchInputSchema.properties as Record<
    string,
    Record<string, unknown>
  >;
  expect(searchProperties.query?.description).toBe(
    "Optional natural-language search phrase to combine with filters for more precise product matches.",
  );
  const brandItems = searchProperties.brand?.items as Record<string, unknown>;
  expect(searchProperties.brand?.type).toBe("array");
  expect(brandItems.type).toBe("string");
  expect(brandItems).not.toHaveProperty("enum");

  const statsTool = getMcpTool(tools, "stats");
  expect(statsTool?.description).toBe(STATS_DESCRIPTION);
  const statsInputSchema = statsTool?.inputSchema || {};
  expectSearchSchemaEnums(statsInputSchema, EXPECTED_SEARCH_ENUMS);
  const statsProperties = statsInputSchema.properties as Record<
    string,
    Record<string, unknown>
  >;
  expect(statsProperties).not.toHaveProperty("query");
  expect(statsProperties).not.toHaveProperty("offset");
  expect(statsProperties).not.toHaveProperty("limit");

  const fetchTool = getMcpTool(tools, "fetch");
  expect(fetchTool?._meta).toMatchObject({
    ui: {
      resourceUri: PRODUCT_DETAIL_WIDGET_URI,
    },
    "openai/outputTemplate": PRODUCT_DETAIL_WIDGET_URI,
  });
  expect(getMcpTool(tools, "render_product_detail")?._meta).toMatchObject({
    ui: {
      resourceUri: PRODUCT_DETAIL_WIDGET_URI,
    },
    "openai/outputTemplate": PRODUCT_DETAIL_WIDGET_URI,
  });

  const wardrobeItemsTool = getMcpTool(tools, "wardrobe_items");
  expect(wardrobeItemsTool?.description).toBe(WARDROBE_ITEMS_DESCRIPTION);
  expect(wardrobeItemsTool?._meta).toMatchObject({
    ui: {
      resourceUri: WARDROBE_GRID_WIDGET_URI,
    },
    "openai/outputTemplate": WARDROBE_GRID_WIDGET_URI,
  });
  expect(getMcpTool(tools, "render_wardrobe_grid")?._meta).toMatchObject({
    ui: {
      resourceUri: WARDROBE_GRID_WIDGET_URI,
    },
    "openai/outputTemplate": WARDROBE_GRID_WIDGET_URI,
  });
  const wardrobeProperties = wardrobeItemsTool?.inputSchema?.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  expect(wardrobeItemsTool?.inputSchema?.required || []).not.toContain(
    "source",
  );
  expect(wardrobeProperties?.source).toMatchObject({
    type: "string",
    enum: ["uploaded", "from_catalog"],
  });

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

test("mcp streamable http session supports GET SSE", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const initialize = await requestJson(baseUrl, "/mcp", {
    method: "POST",
    headers: mcpHeaders(token),
    body: {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "streamable-http-test-client",
          version: "0.1.0",
        },
      },
    },
  });
  const sessionId = initialize.response.headers.get("mcp-session-id") || "";

  expect(initialize.response.status).toBe(200);
  expect(sessionId).toMatch(/^[!-~]+$/);

  const stream = await fetch(`${baseUrl}/mcp`, {
    method: "GET",
    headers: {
      ...mcpHeaders(token),
      "mcp-protocol-version": "2025-03-26",
      "mcp-session-id": sessionId,
    },
  });

  expect(stream.status).toBe(200);
  expect(stream.headers.get("content-type")).toContain("text/event-stream");
  await stream.body?.cancel();

  const closed = await fetch(`${baseUrl}/mcp`, {
    method: "DELETE",
    headers: {
      ...mcpHeaders(token),
      "mcp-protocol-version": "2025-03-26",
      "mcp-session-id": sessionId,
    },
  });
  expect(closed.status).toBe(200);
});

test("oauth refresh token grant issues rotated tokens accepted by mcp", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const { refreshToken } = await approveAndExchangeCode(baseUrl);

  const refreshed = await refreshAccessToken(baseUrl, refreshToken);

  expect(refreshed.response.status).toBe(200);
  expect(refreshed.json.token_type).toBe("Bearer");
  expect(String(refreshed.json.access_token || "")).toBeTruthy();
  expect(String(refreshed.json.refresh_token || "")).toBeTruthy();
  expect(refreshed.json.refresh_token).not.toBe(refreshToken);
  expect(refreshed.json.scope).toBe("mcp:read wardrobe:read");

  const tools = await listMcpTools(
    baseUrl,
    String(refreshed.json.access_token),
  );
  expect(tools.response.status).toBe(200);
  expectMcpToolNames(tools);

  const reused = await refreshAccessToken(baseUrl, refreshToken);
  expect(reused.response.status).toBe(400);
  expect(reused.json.error).toBe("invalid_grant");
});

test("oauth refresh token grant rejects expired and revoked tokens", async (t) => {
  const expiredServer = await startMcpTestServer(t, {
    refreshTokenTtlSeconds: -1,
  });
  const expiredGrant = await approveAndExchangeCode(expiredServer.baseUrl);
  const expired = await refreshAccessToken(
    expiredServer.baseUrl,
    expiredGrant.refreshToken,
  );
  expect(expired.response.status).toBe(400);
  expect(expired.json.error).toBe("invalid_grant");

  const { baseUrl, deps } = await startMcpTestServer(t);
  const grant = await approveAndExchangeCode(baseUrl);
  await (deps.revokeMcpRefreshTokenImpl as (hash: string) => Promise<boolean>)(
    hashOAuthSecret(grant.refreshToken),
  );

  const revoked = await refreshAccessToken(baseUrl, grant.refreshToken);
  expect(revoked.response.status).toBe(400);
  expect(revoked.json.error).toBe("invalid_grant");
});

test("oauth refresh token grant rejects wrong client and scope expansion", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const { refreshToken } = await approveAndExchangeCode(baseUrl);

  const wrongClient = await refreshAccessToken(baseUrl, refreshToken, {
    client_id: "other-client",
  });
  expect(wrongClient.response.status).toBe(400);
  expect(wrongClient.json.error).toBe("invalid_grant");

  const expandedScope = await refreshAccessToken(baseUrl, refreshToken, {
    scope: "mcp:read wardrobe:read capsules:read",
  });
  expect(expandedScope.response.status).toBe(400);
  expect(expandedScope.json.error).toBe("invalid_scope");

  const narrowed = await refreshAccessToken(baseUrl, refreshToken, {
    scope: "mcp:read",
  });
  expect(narrowed.response.status).toBe(200);
  expect(narrowed.json.scope).toBe("mcp:read");
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

test("mcp tools expose Apps widget resources", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const resources = await listMcpResources(baseUrl, token);
  const productGridWidget = await readMcpResource(
    baseUrl,
    token,
    PRODUCT_GRID_WIDGET_URI,
  );
  const productDetailWidget = await readMcpResource(
    baseUrl,
    token,
    PRODUCT_DETAIL_WIDGET_URI,
  );
  const wardrobeGridWidget = await readMcpResource(
    baseUrl,
    token,
    WARDROBE_GRID_WIDGET_URI,
  );

  expect(resources.response.status).toBe(200);
  expect(getMcpResource(resources, PRODUCT_GRID_WIDGET_URI)).toMatchObject({
    uri: PRODUCT_GRID_WIDGET_URI,
    name: "product_grid_widget",
    title: "Product grid",
    mimeType: CARD_GRID_WIDGET_MIME_TYPE,
    _meta: {
      ui: {
        prefersBorder: true,
        csp: {
          resourceDomains: expect.arrayContaining([
            "https://assets.capsule-wardrobe.org",
          ]),
        },
      },
      "openai/widgetCSP": {
        resource_domains: ["https://assets.capsule-wardrobe.org"],
        redirect_domains: expect.arrayContaining([
          "https://www.stories.com",
          "https://example.com",
        ]),
      },
    },
  });
  expect(
    getMcpResource(resources, PRODUCT_GRID_WIDGET_URI)?._meta?.ui,
  ).not.toHaveProperty("domain");
  expect(
    getMcpResource(resources, PRODUCT_GRID_WIDGET_URI)?._meta,
  ).not.toHaveProperty("openai/widgetDomain");
  expect(getMcpResource(resources, PRODUCT_DETAIL_WIDGET_URI)).toMatchObject({
    uri: PRODUCT_DETAIL_WIDGET_URI,
    name: "product_detail_widget",
    title: "Product detail",
    mimeType: CARD_GRID_WIDGET_MIME_TYPE,
  });
  expect(getMcpResource(resources, WARDROBE_GRID_WIDGET_URI)).toMatchObject({
    uri: WARDROBE_GRID_WIDGET_URI,
    name: "wardrobe_grid_widget",
    title: "Wardrobe grid",
    mimeType: CARD_GRID_WIDGET_MIME_TYPE,
  });

  expect(productGridWidget.response.status).toBe(200);
  expect(productDetailWidget.response.status).toBe(200);
  expect(wardrobeGridWidget.response.status).toBe(200);
  const content = mcpResult(productGridWidget).contents?.[0];
  expect(content).toMatchObject({
    uri: PRODUCT_GRID_WIDGET_URI,
    mimeType: CARD_GRID_WIDGET_MIME_TYPE,
    _meta: {
      ui: {
        prefersBorder: true,
        csp: {
          resourceDomains: expect.arrayContaining([
            "https://assets.capsule-wardrobe.org",
          ]),
        },
      },
      "openai/widgetCSP": {
        resource_domains: ["https://assets.capsule-wardrobe.org"],
        redirect_domains: expect.arrayContaining([
          "https://www.stories.com",
          "https://example.com",
        ]),
      },
    },
  });
  expect(content?._meta?.ui).not.toHaveProperty("domain");
  expect(content?._meta).not.toHaveProperty("openai/widgetDomain");
  expect(content?.text).toContain("window.openai");
  expect(content?.text).toContain("toolOutput");
  expect(content?.text).toContain("toolResponseMetadata");
  expect(content?.text).toContain("openai:set_globals");
  expect(content?.text).toContain("ui/notifications/tool-result");
  expect(content?.text).toContain('document.createElement("img")');
  expect(mcpResult(productDetailWidget).contents?.[0]).toMatchObject({
    uri: PRODUCT_DETAIL_WIDGET_URI,
    mimeType: CARD_GRID_WIDGET_MIME_TYPE,
  });
  expect(mcpResult(wardrobeGridWidget).contents?.[0]).toMatchObject({
    uri: WARDROBE_GRID_WIDGET_URI,
    mimeType: CARD_GRID_WIDGET_MIME_TYPE,
  });
});

test("mcp stats matches search stats endpoint without price buckets", async (t) => {
  const { baseUrl } = await startMcpTestServer(t);
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });
  const payload = { category: ["top"] };

  const httpStats = await requestJson(baseUrl, "/search/stats", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: payload,
  });
  const mcpStats = await callMcpTool(baseUrl, token, "stats", payload);

  expect(httpStats.response.status).toBe(200);
  expect(mcpStats.response.status).toBe(200);
  expect(httpStats.json).toMatchObject({
    ok: true,
    total: 3,
    stats: { category: [{ value: "top", count: 3 }] },
    priceBuckets: [],
  });
  expect(mcpResult(mcpStats).structuredContent).toEqual({
    ok: true,
    total: httpStats.json.total,
    stats: httpStats.json.stats,
  });
  expect(mcpResult(mcpStats).structuredContent).not.toHaveProperty(
    "priceBuckets",
  );
  expect(mcpResult(mcpStats).content).toEqual([
    {
      type: "text",
      text: JSON.stringify({
        ok: true,
        total: httpStats.json.total,
        stats: httpStats.json.stats,
      }),
    },
  ]);
});

test("mcp stats returns tool error on invalid payload", async (t) => {
  const { baseUrl } = await startMcpTestServerWithDependencyOverrides(t, {
    getSearchStatsImpl: async (_email, payload) => {
      expect(payload).toEqual({ brand: ["not-allowed"] });
      const error = new Error("invalid_payload");
      (error as Error & { code?: string }).code = "invalid_payload";
      throw error;
    },
  });
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const result = await callMcpTool(baseUrl, token, "stats", {
    brand: ["not-allowed"],
  });

  expect(result.response.status).toBe(200);
  expect(mcpResult(result)).toMatchObject({
    isError: true,
    structuredContent: { ok: false, error: "invalid_payload" },
  });
});

test("mcp stats returns tool error on service failure", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { baseUrl } = await startMcpTestServerWithDependencyOverrides(t, {
    getSearchStatsImpl: async () => {
      throw new Error("stats_down");
    },
  });
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const result = await callMcpTool(baseUrl, token, "stats", {});

  expect(result.response.status).toBe(200);
  expect(mcpResult(result)).toMatchObject({
    isError: true,
    structuredContent: { ok: false, error: "service_unavailable" },
  });
});

test("mcp wardrobe_items returns thumbnail image urls and filters by source", async (t) => {
  const calls: unknown[] = [];
  const { baseUrl } = await startMcpTestServerWithDependencyOverrides(t, {
    listWardrobeItemsImpl: async (payload) => {
      calls.push(payload);
      return [
        {
          id: "wardrobe-1",
          profileEmail: payload.email,
          email: payload.email,
          productId: "product-1",
          name: "Saved blazer",
          url: "https://example.com/products/saved-blazer",
          description: "A saved blazer.",
          brand: "Acme",
          price: 120,
          currency: "USD",
          availability: "in_stock",
          imageUrl: "https://example.com/products/saved-blazer.jpg",
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
          source: payload.source || "from_catalog",
          rawImageUrl: null,
          processingStatus: "ready",
          embedding: [0.1, 0.2],
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-02T00:00:00.000Z",
        },
      ];
    },
  });
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const httpItems = await requestJson(baseUrl, "/wardrobe/items", {
    cookie: AUTH_COOKIE,
  });
  const mcpItems = await callMcpTool(baseUrl, token, "wardrobe_items", {});
  const renderItems = await callMcpTool(
    baseUrl,
    token,
    "render_wardrobe_grid",
    {
      items: mcpResult(mcpItems).structuredContent?.items,
    },
  );
  const uploadedItems = await callMcpTool(baseUrl, token, "wardrobe_items", {
    source: "uploaded",
  });

  expect(httpItems.response.status).toBe(200);
  expect(mcpItems.response.status).toBe(200);
  expect(renderItems.response.status).toBe(200);
  expect(uploadedItems.response.status).toBe(200);
  expect(httpItems.json.items?.[0]?.imageUrl).toBe(
    "https://example.com/products/saved-blazer.jpg",
  );
  expect(mcpResult(mcpItems).structuredContent).toEqual({
    resultType: "wardrobe_items",
    count: 1,
    items: [
      {
        id: "wardrobe-1",
        name: "Saved blazer",
        brand: "Acme",
        url: "https://example.com/products/saved-blazer",
        description: "A saved blazer.",
        price: {
          amount: 120,
          currency: "USD",
          display: "120 USD",
        },
        availability: "in_stock",
        image: SAVED_BLAZER_THUMBNAIL_URL,
        audience: "woman",
        category: "jacket",
        attributes: {
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
          isSavedToWardrobe: null,
        },
        source: "from_catalog",
        processingStatus: "ready",
      },
    ],
  });
  expectShortTextSummary(
    mcpItems,
    [
      "Found 1 wardrobe items:",
      "1. Saved blazer - Acme - 120 USD - from_catalog - ready",
      `   ![Saved blazer](${SAVED_BLAZER_THUMBNAIL_URL})`,
      "   https://example.com/products/saved-blazer",
    ].join("\n"),
  );
  expect(mcpResult(mcpItems)._meta).toMatchObject({
    ui: {
      component: "wardrobe_grid",
      version: "1.0",
      layout: "responsive_grid",
      itemOrder: ["wardrobe-1"],
    },
    cards: [
      {
        type: "wardrobe_item_card",
        itemId: "wardrobe-1",
        title: "Saved blazer",
        subtitle: "Acme · 120 USD",
        image: SAVED_BLAZER_THUMBNAIL_URL,
        badges: ["jacket", "autumn", "winter"],
        primaryAction: {
          type: "open_external",
          label: "Open product",
          url: "https://example.com/products/saved-blazer",
        },
      },
    ],
  });
  expectShortTextSummary(
    renderItems,
    [
      "Found 1 wardrobe items:",
      "1. Saved blazer - Acme - 120 USD - from_catalog - ready",
      `   ![Saved blazer](${SAVED_BLAZER_THUMBNAIL_URL})`,
      "   https://example.com/products/saved-blazer",
    ].join("\n"),
  );
  expect(mcpResult(renderItems)).toMatchObject({
    structuredContent: {
      resultType: "wardrobe_items",
      count: 1,
      items: mcpResult(mcpItems).structuredContent?.items,
    },
    _meta: {
      ui: {
        component: "wardrobe_grid",
        version: "1.0",
        layout: "responsive_grid",
        itemOrder: ["wardrobe-1"],
      },
      cards: [
        {
          type: "wardrobe_item_card",
          itemId: "wardrobe-1",
          image: SAVED_BLAZER_THUMBNAIL_URL,
        },
      ],
    },
  });
  expectNoPrivateWardrobeFields(mcpResult(mcpItems));
  expect(mcpResult(uploadedItems).structuredContent).toMatchObject({
    resultType: "wardrobe_items",
    count: 1,
    items: [
      {
        image: "https://example.com/products/saved-blazer_640.webp",
        source: "uploaded",
      },
    ],
  });
  expect(mcpResult(uploadedItems)._meta?.cards?.[0]).not.toHaveProperty(
    "primaryAction",
  );
  expect(calls).toEqual([
    { email: "person@example.com", source: null },
    { email: "person@example.com", source: null },
    { email: "person@example.com", source: "uploaded" },
  ]);
});

test("mcp wardrobe_items returns tool error on service failure", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { baseUrl } = await startMcpTestServerWithDependencyOverrides(t, {
    listWardrobeItemsImpl: async () => {
      throw new Error("wardrobe_down");
    },
  });
  const token = bearerToken({ scope: "mcp:read wardrobe:read" });

  const result = await callMcpTool(baseUrl, token, "wardrobe_items", {});

  expect(result.response.status).toBe(200);
  expect(mcpResult(result)).toMatchObject({
    isError: true,
    structuredContent: { ok: false, error: "service_unavailable" },
  });
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
    resultType: "product_search",
    count: 1,
    total: 1,
    offset: 0,
    limit: 20,
  });
  expectShortTextSummary(
    empty,
    [
      "Found 1 products:",
      "1. Black Blazer - Acme - 120 USD",
      `   ![Black Blazer](${BLACK_BLAZER_THUMBNAIL_URL})`,
      "   https://example.com/products/black-blazer",
    ].join("\n"),
  );

  const queryOnly = await callMcpTool(baseUrl, token, "search", {
    query: "black blazer",
  });
  expect(queryOnly.response.status).toBe(200);
  expect(mcpResult(queryOnly).structuredContent?.resultType).toBe(
    "product_search",
  );

  const filtersOnly = await callMcpTool(baseUrl, token, "search", {
    brand: ["acme"],
    category: ["outerwear"],
  });
  expect(filtersOnly.response.status).toBe(200);
  expect(mcpResult(filtersOnly).structuredContent?.resultType).toBe(
    "product_search",
  );

  const queryWithFilters = await callMcpTool(baseUrl, token, "search", {
    query: "black blazer",
    color: ["black"],
    offset: 5,
    limit: 75,
  });
  expect(queryWithFilters.response.status).toBe(200);
  expect(mcpResult(queryWithFilters).structuredContent).toMatchObject({
    resultType: "product_search",
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
  const expectedProduct = expectedBlackBlazerProduct();
  expect(output).toMatchObject({
    resultType: "product_search",
    count: 1,
    total: 1,
    offset: 0,
    limit: 20,
  });
  expect(output?.items?.[0]).toEqual(expectedProduct);
  expectShortTextSummary(
    search,
    [
      "Found 1 products:",
      "1. Black Blazer - Acme - 120 USD",
      `   ![Black Blazer](${BLACK_BLAZER_THUMBNAIL_URL})`,
      "   https://example.com/products/black-blazer",
    ].join("\n"),
  );
  expect(mcpResult(search)._meta).toMatchObject({
    ui: {
      component: "product_grid",
      version: "1.0",
      layout: "responsive_grid",
      itemOrder: ["product-1"],
    },
    cards: [
      {
        type: "product_card",
        itemId: "product-1",
        title: "Black Blazer",
        subtitle: "Acme · 120 USD",
        image: BLACK_BLAZER_THUMBNAIL_URL,
        badges: ["jacket", "autumn", "winter"],
        primaryAction: {
          type: "open_external",
          label: "Open product",
          url: "https://example.com/products/black-blazer",
        },
      },
    ],
    itemsById: {
      "product-1": expectedProduct,
    },
  });
  const render = await callMcpTool(baseUrl, token, "render_product_grid", {
    items: output?.items,
    total: output?.total,
    offset: output?.offset,
    limit: output?.limit,
  });
  expect(render.response.status).toBe(200);
  expectShortTextSummary(
    render,
    [
      "Found 1 products:",
      "1. Black Blazer - Acme - 120 USD",
      `   ![Black Blazer](${BLACK_BLAZER_THUMBNAIL_URL})`,
      "   https://example.com/products/black-blazer",
    ].join("\n"),
  );
  expect(mcpResult(render)).toMatchObject({
    structuredContent: {
      resultType: "product_search",
      count: 1,
      items: [expectedProduct],
      total: 1,
      offset: 0,
      limit: 20,
    },
    _meta: {
      ui: {
        component: "product_grid",
        version: "1.0",
        layout: "responsive_grid",
        itemOrder: ["product-1"],
      },
      cards: [
        {
          type: "product_card",
          itemId: "product-1",
          image: BLACK_BLAZER_THUMBNAIL_URL,
        },
      ],
      itemsById: {
        "product-1": expectedProduct,
      },
    },
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
  const expectedProduct = expectedBlackBlazerProduct();
  expect(mcpResult(byId).structuredContent).toEqual({
    resultType: "product_fetch",
    item: expectedProduct,
    items: [expectedProduct],
  });
  expectShortTextSummary(
    byId,
    [
      "Fetched product:",
      "Black Blazer - Acme - 120 USD",
      `![Black Blazer](${BLACK_BLAZER_THUMBNAIL_URL})`,
      "https://example.com/products/black-blazer",
    ].join("\n"),
  );
  expect(mcpResult(byId)._meta).toMatchObject({
    ui: {
      component: "product_detail",
      version: "1.0",
    },
    cards: [
      {
        type: "product_card",
        itemId: "product-1",
        title: "Black Blazer",
        subtitle: "Acme · 120 USD",
        image: BLACK_BLAZER_THUMBNAIL_URL,
        badges: ["jacket", "autumn", "winter"],
        primaryAction: {
          type: "open_external",
          label: "Open product",
          url: "https://example.com/products/black-blazer",
        },
      },
    ],
    itemsById: {
      "product-1": expectedProduct,
    },
  });
  const render = await callMcpTool(baseUrl, token, "render_product_detail", {
    item: expectedProduct,
  });
  expect(render.response.status).toBe(200);
  expectShortTextSummary(
    render,
    [
      "Fetched product:",
      "Black Blazer - Acme - 120 USD",
      `![Black Blazer](${BLACK_BLAZER_THUMBNAIL_URL})`,
      "https://example.com/products/black-blazer",
    ].join("\n"),
  );
  expect(mcpResult(render)).toMatchObject({
    structuredContent: {
      resultType: "product_fetch",
      item: expectedProduct,
      items: [expectedProduct],
    },
    _meta: {
      ui: {
        component: "product_detail",
        version: "1.0",
      },
      cards: [
        {
          type: "product_card",
          itemId: "product-1",
          image: BLACK_BLAZER_THUMBNAIL_URL,
        },
      ],
      itemsById: {
        "product-1": expectedProduct,
      },
    },
  });
  expectNoInternalSearchFields(mcpResult(byId));

  const byUrl = await callMcpTool(baseUrl, token, "fetch", {
    url: "https://example.com/products/black-blazer",
  });
  expect(byUrl.response.status).toBe(200);
  expect(mcpResult(byUrl).structuredContent?.item?.id).toBe("product-1");
  expect(mcpResult(byUrl).structuredContent?.items?.[0]?.id).toBe("product-1");
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

test("oauth dynamic client without refresh grant does not receive or use refresh tokens", async (t) => {
  let registeredClientId = "";
  let rotateCalls = 0;
  const legacyRefreshToken = "legacy-refresh-token";
  const { baseUrl } = await startMcpTestServerWithDependencyOverrides(t, {
    mcpOAuthConfig: createTestMcpConfig({
      allowedRedirectOrigins: new Set(["http://127.0.0.1"]),
      allowedRedirectUris: new Set(),
    }),
    getMcpRefreshTokenImpl: async (tokenHash) =>
      tokenHash === hashOAuthSecret(legacyRefreshToken)
        ? {
            tokenHash,
            userEmail: "person@example.com",
            clientId: registeredClientId,
            scopes: "mcp:read wardrobe:read",
            resource: RESOURCE,
            expiresAt: "2099-01-01T00:00:00.000Z",
            revokedAt: null,
            createdAt: "2026-05-21T00:00:00.000Z",
            consumedAt: null,
          }
        : null,
    rotateMcpRefreshTokenImpl: async () => {
      rotateCalls += 1;
      return null;
    },
  });
  const registration = await registerDynamicClient(baseUrl, {
    grant_types: ["authorization_code"],
  });
  registeredClientId = String(registration.json.client_id || "");
  expect(registeredClientId).toBeTruthy();

  const consent = await fetchManual(`${baseUrl}/oauth/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: AUTH_COOKIE,
    },
    body: consentBody("allow", {
      client_id: registeredClientId,
      redirect_uri: DYNAMIC_REDIRECT_URI,
    }),
  });
  expect(consent.status).toBe(302);
  const code = new URL(consent.headers.get("location") || "").searchParams.get(
    "code",
  );
  expect(code).toBeTruthy();

  const token = await requestJson(baseUrl, "/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: DYNAMIC_REDIRECT_URI,
      client_id: registeredClientId,
      code_verifier: CODE_VERIFIER,
      resource: RESOURCE,
    },
  });
  expect(token.response.status).toBe(200);
  expect(token.json.token_type).toBe("Bearer");
  expect(String(token.json.access_token || "")).toBeTruthy();
  expect(token.json).not.toHaveProperty("refresh_token");

  const refresh = await refreshAccessToken(baseUrl, legacyRefreshToken, {
    client_id: registeredClientId,
  });
  expect(refresh.response.status).toBe(400);
  expect(refresh.json.error).toBe("invalid_grant");
  expect(rotateCalls).toBe(0);
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
  expect(missing.json).toEqual({ error: "missing_token" });
  const missingChallenge = missing.response.headers.get("www-authenticate");
  expect(missingChallenge).toContain('Bearer realm="capsule-wardrobe-mcp"');
  expect(missingChallenge).toContain("resource_metadata=");
  expect(missingChallenge).toContain(
    `resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`,
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
