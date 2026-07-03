import { expect, test, vi } from "vitest";
import { runProductionStartupPreflight } from "./startupPreflight.js";

const VALID_PRODUCTION_ENV: NodeJS.ProcessEnv = {
  AUTH_CODE_SECRET: "auth-code-secret",
  CLIENT_ORIGIN: "https://app.example.test",
  DATABASE_URL: "postgresql://user:pass@db.example.test/app",
  PASSKEY_ORIGIN: "https://app.example.test",
  PASSKEY_RP_ID: "app.example.test",
  RESEND_API_KEY: "resend-key",
  RESEND_FROM_EMAIL: "Capsule Wardrobe <auth@example.test>",
};

function expectPreflightFailure(
  env: NodeJS.ProcessEnv,
  expectedPatterns: RegExp[],
  createMcpOAuthConfigImpl: () => unknown = vi.fn(),
) {
  expect(() =>
    runProductionStartupPreflight({
      createMcpOAuthConfigImpl,
      env,
      nodeEnv: "production",
    }),
  ).toThrow(/production_startup_preflight_failed/);

  for (const pattern of expectedPatterns) {
    expect(() =>
      runProductionStartupPreflight({
        createMcpOAuthConfigImpl,
        env,
        nodeEnv: "production",
      }),
    ).toThrow(pattern);
  }
}

test("production startup preflight accepts valid required env and validates mcp oauth config", () => {
  const createMcpOAuthConfigImpl = vi.fn();

  runProductionStartupPreflight({
    createMcpOAuthConfigImpl,
    env: VALID_PRODUCTION_ENV,
    nodeEnv: "production",
  });

  expect(createMcpOAuthConfigImpl).toHaveBeenCalledTimes(1);
});

test("production startup preflight aggregates missing required env values", () => {
  const createMcpOAuthConfigImpl = vi.fn();

  expectPreflightFailure(
    {},
    [
      /CLIENT_ORIGIN is not set/,
      /PASSKEY_ORIGIN is not set/,
      /PASSKEY_RP_ID is not set/,
      /DATABASE_URL is not set/,
      /AUTH_CODE_SECRET is not set/,
      /RESEND_API_KEY is not set/,
      /RESEND_FROM_EMAIL is not set/,
    ],
    createMcpOAuthConfigImpl,
  );
});

test("production startup preflight rejects localhost and loopback defaults", () => {
  expectPreflightFailure(
    {
      ...VALID_PRODUCTION_ENV,
      CLIENT_ORIGIN: "http://localhost:5173",
      PASSKEY_ORIGIN: "http://127.0.0.1:3000",
      PASSKEY_RP_ID: "localhost",
    },
    [
      /CLIENT_ORIGIN must use https/,
      /CLIENT_ORIGIN must not use localhost or loopback/,
      /PASSKEY_ORIGIN must use https/,
      /PASSKEY_ORIGIN must not use localhost or loopback/,
      /PASSKEY_RP_ID must not use localhost or loopback/,
    ],
  );
});

test("production startup preflight rejects mismatched origins and relying party host", () => {
  expectPreflightFailure(
    {
      ...VALID_PRODUCTION_ENV,
      CLIENT_ORIGIN: "https://app.example.test",
      PASSKEY_ORIGIN: "https://auth.example.test",
      PASSKEY_RP_ID: "login.example.test",
    },
    [
      /CLIENT_ORIGIN must match PASSKEY_ORIGIN/,
      /PASSKEY_RP_ID must match PASSKEY_ORIGIN hostname/,
    ],
  );
});

test("production startup preflight rejects non-origin URLs and non-hostname relying party values", () => {
  expectPreflightFailure(
    {
      ...VALID_PRODUCTION_ENV,
      CLIENT_ORIGIN: "https://app.example.test/callback",
      PASSKEY_RP_ID: "app.example.test:443",
    },
    [
      /CLIENT_ORIGIN must be an origin without path, query, or hash/,
      /PASSKEY_RP_ID must be a hostname only/,
    ],
  );
});

test("production startup preflight surfaces mcp oauth validation failures", () => {
  expectPreflightFailure(
    VALID_PRODUCTION_ENV,
    [/MCP OAuth config invalid/],
    () => {
      throw new Error("mcp_oauth_production_config_incomplete");
    },
  );
});

test("startup preflight skips non-production environments", () => {
  const createMcpOAuthConfigImpl = vi.fn(() => {
    throw new Error("should_not_run");
  });

  runProductionStartupPreflight({
    createMcpOAuthConfigImpl,
    env: {},
    nodeEnv: "development",
  });

  expect(createMcpOAuthConfigImpl).not.toHaveBeenCalled();
});
