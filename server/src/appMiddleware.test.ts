import { test, expect } from "vitest";
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
