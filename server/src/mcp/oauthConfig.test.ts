import { expect, test, vi } from "vitest";

const ORIGINAL_ENV = {
  MCP_ALLOWED_CLIENT_IDS: process.env.MCP_ALLOWED_CLIENT_IDS,
  MCP_ALLOWED_CLIENT_METADATA_HOSTS:
    process.env.MCP_ALLOWED_CLIENT_METADATA_HOSTS,
  MCP_ALLOWED_REDIRECT_ORIGINS: process.env.MCP_ALLOWED_REDIRECT_ORIGINS,
  MCP_ALLOWED_REDIRECT_URIS: process.env.MCP_ALLOWED_REDIRECT_URIS,
  MCP_JWT_SECRET: process.env.MCP_JWT_SECRET,
  MCP_OAUTH_ENABLED: process.env.MCP_OAUTH_ENABLED,
  MCP_OAUTH_ISSUER: process.env.MCP_OAUTH_ISSUER,
  MCP_RESOURCE_URL: process.env.MCP_RESOURCE_URL,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function importConfig() {
  vi.resetModules();
  return import("./oauthConfig.js");
}

test("mcp oauth config permits unregistered clients only outside production by default", async () => {
  try {
    process.env.NODE_ENV = "test";
    delete process.env.MCP_ALLOWED_CLIENT_IDS;
    delete process.env.MCP_ALLOWED_CLIENT_METADATA_HOSTS;

    const { createMcpOAuthConfig } = await importConfig();
    expect(
      createMcpOAuthConfig({
        enabled: true,
        issuer: "https://app.example.test",
        jwtSecret: "secret",
        resourceUrl: "https://app.example.test/mcp",
      }).allowUnregisteredClients,
    ).toBe(true);
  } finally {
    restoreEnv();
  }
});

test("mcp oauth production config allows dynamic registration without static clients", async () => {
  try {
    process.env.NODE_ENV = "production";
    process.env.MCP_OAUTH_ENABLED = "true";
    process.env.MCP_OAUTH_ISSUER = "https://app.example.test";
    process.env.MCP_RESOURCE_URL = "https://app.example.test/mcp";
    process.env.MCP_JWT_SECRET = "secret";
    process.env.MCP_ALLOWED_REDIRECT_URIS =
      "https://chatgpt.com/oauth/callback";
    delete process.env.MCP_ALLOWED_CLIENT_IDS;
    delete process.env.MCP_ALLOWED_CLIENT_METADATA_HOSTS;

    const { createMcpOAuthConfig } = await importConfig();
    const config = createMcpOAuthConfig();
    expect(config.allowedClientIds.size).toBe(0);
    expect(config.allowUnregisteredClients).toBe(false);
  } finally {
    restoreEnv();
  }
});
