import { test, expect, vi } from "vitest";
import { requestJson, startTestServer } from "../test/serverRouteTestUtils.js";

test("health routes expose basic and dependency checks", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const health = await requestJson(baseUrl, "/health");
  expect(health.response.status).toBe(200);
  expect(health.json).toEqual({ ok: true });

  const healthAll = await requestJson(baseUrl, "/healthall");
  expect(healthAll.response.status).toBe(200);
  expect(healthAll.json).toEqual({ ok: true });
});

test("healthall maps database dependency failures", async (t) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      checkDatabaseConnectionImpl: async () => {
        throw new Error("db_down");
      },
    },
  });

  const failingHealth = await requestJson(baseUrl, "/healthall");
  expect(failingHealth.response.status).toBe(503);
  expect(failingHealth.json).toEqual({ ok: false });
});
