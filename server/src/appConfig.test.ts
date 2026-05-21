import { test, expect, vi } from "vitest";

async function importAppConfig() {
  vi.resetModules();
  return import("./appConfig.js");
}

test("appConfig reads environment overrides and auth test mode variants", async () => {
  const original = {
    PORT: process.env.PORT,
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_TEST_MODE: process.env.AUTH_TEST_MODE,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    MCP_ACCESS_TOKEN_TTL_SECONDS: process.env.MCP_ACCESS_TOKEN_TTL_SECONDS,
    MCP_ALLOWED_CLIENT_IDS: process.env.MCP_ALLOWED_CLIENT_IDS,
    MCP_ALLOWED_CLIENT_METADATA_HOSTS:
      process.env.MCP_ALLOWED_CLIENT_METADATA_HOSTS,
    MCP_ALLOWED_REDIRECT_ORIGINS: process.env.MCP_ALLOWED_REDIRECT_ORIGINS,
    MCP_ALLOWED_REDIRECT_URIS: process.env.MCP_ALLOWED_REDIRECT_URIS,
    MCP_AUTH_CODE_TTL_SECONDS: process.env.MCP_AUTH_CODE_TTL_SECONDS,
    MCP_JWT_SECRET: process.env.MCP_JWT_SECRET,
    MCP_OAUTH_ENABLED: process.env.MCP_OAUTH_ENABLED,
    MCP_OAUTH_ISSUER: process.env.MCP_OAUTH_ISSUER,
    MCP_RESOURCE_URL: process.env.MCP_RESOURCE_URL,
    PASSKEY_RP_NAME: process.env.PASSKEY_RP_NAME,
    PASSKEY_RP_ID: process.env.PASSKEY_RP_ID,
    PASSKEY_ORIGIN: process.env.PASSKEY_ORIGIN,
  };

  try {
    process.env.PORT = "4444";
    process.env.CLIENT_ORIGIN = "https://client.example.test";
    process.env.NODE_ENV = "test";
    process.env.AUTH_TEST_MODE = "YES";
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.MCP_ACCESS_TOKEN_TTL_SECONDS = "900";
    process.env.MCP_ALLOWED_CLIENT_IDS = "chatgpt-dev";
    process.env.MCP_ALLOWED_CLIENT_METADATA_HOSTS = "client.example.test";
    process.env.MCP_ALLOWED_REDIRECT_ORIGINS = "https://chatgpt.com";
    process.env.MCP_ALLOWED_REDIRECT_URIS =
      "https://chatgpt.com/oauth/callback";
    process.env.MCP_AUTH_CODE_TTL_SECONDS = "120";
    process.env.MCP_JWT_SECRET = "mcp-secret";
    process.env.MCP_OAUTH_ENABLED = "true";
    process.env.MCP_OAUTH_ISSUER = "https://server.example.test";
    process.env.MCP_RESOURCE_URL = "https://server.example.test/mcp";
    process.env.PASSKEY_RP_NAME = "Wardrobe";
    process.env.PASSKEY_RP_ID = "example.test";
    process.env.PASSKEY_ORIGIN = "https://example.test";

    const overridden = await importAppConfig();
    expect(overridden.PORT).toBe("4444");
    expect(overridden.CLIENT_ORIGIN).toBe("https://client.example.test");
    expect(overridden.NODE_ENV).toBe("test");
    expect(overridden.AUTH_TEST_MODE).toBe(true);
    expect(overridden.GOOGLE_CLIENT_ID).toBe("google-client");
    expect(overridden.MCP_ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(overridden.MCP_ALLOWED_CLIENT_IDS).toBe("chatgpt-dev");
    expect(overridden.MCP_ALLOWED_CLIENT_METADATA_HOSTS).toBe(
      "client.example.test",
    );
    expect(overridden.MCP_ALLOWED_REDIRECT_ORIGINS).toBe("https://chatgpt.com");
    expect(overridden.MCP_ALLOWED_REDIRECT_URIS).toBe(
      "https://chatgpt.com/oauth/callback",
    );
    expect(overridden.MCP_AUTH_CODE_TTL_SECONDS).toBe(120);
    expect(overridden.MCP_JWT_SECRET).toBe("mcp-secret");
    expect(overridden.MCP_OAUTH_ENABLED).toBe(true);
    expect(overridden.MCP_OAUTH_ISSUER).toBe("https://server.example.test");
    expect(overridden.MCP_RESOURCE_URL).toBe("https://server.example.test/mcp");
    expect(overridden.PASSKEY_RP_NAME).toBe("Wardrobe");
    expect(overridden.PASSKEY_RP_ID).toBe("example.test");
    expect(overridden.PASSKEY_ORIGIN).toBe("https://example.test");

    process.env.NODE_ENV = "production";
    process.env.AUTH_TEST_MODE = "true";
    const production = await importAppConfig();
    expect(production.AUTH_TEST_MODE).toBe(false);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
