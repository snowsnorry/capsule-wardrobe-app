import { test, expect, vi } from "vitest";
import { createMcpOAuthConfig } from "./mcp/oauthConfig.js";
import {
  AUTH_COOKIE,
  requestJson,
  startTestServer,
} from "./test/serverRouteTestUtils.js";

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

test("observability access logs include request metadata without query or email", async (t) => {
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

  const accessLog = writes
    .map((line) => JSON.parse(line))
    .find((record) => record.message === "http_request");

  expect(accessLog).toMatchObject({
    level: "info",
    requestId: "client-req-2",
    values: [
      "http_request",
      {
        event: "http_request",
        method: "GET",
        path: "/auth/me",
        statusCode: 200,
      },
    ],
  });
  expect(accessLog.values[1].durationMs).toEqual(expect.any(Number));
  expect(JSON.stringify(accessLog)).not.toContain("person@example.com");
});

test("observability middleware suppresses successful health access logs", async (t) => {
  const writes: string[] = [];
  const stdout = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
  t.onTestFinished(() => stdout.mockRestore());

  const { baseUrl } = await startTestServer(t);
  const health = await requestJson(baseUrl, "/health");
  expect(health.response.status).toBe(200);

  const accessLogs = writes
    .map((line) => JSON.parse(line))
    .filter((record) => record.message === "http_request");
  expect(accessLogs).toEqual([]);
});
