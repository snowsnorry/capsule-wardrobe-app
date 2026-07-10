import { test, expect, vi } from "vitest";
import { createMcpOAuthConfig } from "./mcp/oauthConfig.js";
import {
  AUTH_COOKIE,
  requestJson,
  startTestServer,
} from "./test/serverRouteTestUtils.js";
import { getHttpRequestLogLevel } from "./appMiddleware.js";

test("production security headers allow local image previews and popup auth", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const { response } = await requestJson(baseUrl, "/health");
  const contentSecurityPolicy =
    response.headers.get("content-security-policy") || "";

  expect(response.headers.get("cross-origin-opener-policy")).toBe(
    "same-origin-allow-popups",
  );
  expect(contentSecurityPolicy).toContain("img-src 'self' data: https: blob:");
});

test("production security headers allow configured app and OAuth form actions", async (t) => {
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      mcpOAuthConfig: createMcpOAuthConfig({
        issuer: "https://www.capsule-wardrobe.org",
        resourceUrl: "https://www.capsule-wardrobe.org/mcp",
      }),
    },
  });

  const { response } = await requestJson(baseUrl, "/health");
  const contentSecurityPolicy =
    response.headers.get("content-security-policy") || "";

  expect(contentSecurityPolicy).toContain(
    "form-action 'self' https: https://client.example https://www.capsule-wardrobe.org",
  );
});

test("production CORS preflight allows browser MCP headers", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const { response } = await requestJson(baseUrl, "/mcp", {
    method: "OPTIONS",
    origin: "https://client.example",
    headers: {
      "Access-Control-Request-Headers":
        "Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
      "Access-Control-Request-Method": "POST",
    },
  });

  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    "https://client.example",
  );
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  expect(response.headers.get("access-control-allow-headers")).toBe(
    "Content-Type, X-CSRF-Token, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  );
  expect(response.headers.get("access-control-allow-methods")).toBe(
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
});

test("observability middleware generates and reuses request ids", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const generated = await requestJson(baseUrl, "/auth/me", {
    cookie: AUTH_COOKIE,
  });
  expect(generated.response.headers.get("x-request-id")).toMatch(
    /^[0-9a-f-]{36}$/i,
  );

  const reused = await requestJson(baseUrl, "/auth/me", {
    cookie: AUTH_COOKIE,
    headers: { "X-Request-Id": "client-req-1" },
  });
  expect(reused.response.headers.get("x-request-id")).toBe("client-req-1");

  const regenerated = await requestJson(baseUrl, "/auth/me", {
    cookie: AUTH_COOKIE,
    headers: { "X-Request-Id": "bad request id" },
  });
  expect(regenerated.response.headers.get("x-request-id")).toMatch(
    /^[0-9a-f-]{36}$/i,
  );
  expect(regenerated.response.headers.get("x-request-id")).not.toBe(
    "bad request id",
  );
});

test("observability middleware suppresses routine successful access logs", async (t) => {
  const writes: string[] = [];
  const stdout = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
  t.onTestFinished(() => stdout.mockRestore());

  const { baseUrl } = await startTestServer(t);
  const response = await requestJson(
    baseUrl,
    "/auth/me?email=person@example.com",
    {
      cookie: AUTH_COOKIE,
      headers: { "X-Request-Id": "client-req-2" },
    },
  );
  expect(response.response.status).toBe(200);

  expect(writes).toEqual([]);
});

test("observability middleware logs failures as readable warnings without query data", async (t) => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  t.onTestFinished(() => warn.mockRestore());

  const { baseUrl } = await startTestServer(t);
  const response = await requestJson(
    baseUrl,
    "/auth/me?email=person@example.com",
    {
      headers: { "X-Request-Id": "client-req-3" },
    },
  );
  expect(response.response.status).toBe(401);

  const line = String(warn.mock.calls.at(-1)?.[0]);
  expect(line).toContain(
    "WARN event=http.request.failed requestId=client-req-3",
  );
  expect(line).toContain("path=/auth/me");
  expect(line).not.toContain("person@example.com");
});

test("access log policy records failures and successful requests over one second", () => {
  expect(
    getHttpRequestLogLevel({ durationMs: 12, statusCode: 200 }),
  ).toBeNull();
  expect(getHttpRequestLogLevel({ durationMs: 1_000, statusCode: 200 })).toBe(
    "warn",
  );
  expect(getHttpRequestLogLevel({ durationMs: 12, statusCode: 404 })).toBe(
    "warn",
  );
  expect(getHttpRequestLogLevel({ durationMs: 12, statusCode: 500 })).toBe(
    "error",
  );
});
