import { test, expect } from "vitest";
import { createMcpOAuthConfig } from "./mcp/oauthConfig.js";
import { requestJson, startTestServer } from "./test/serverRouteTestUtils.js";

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
