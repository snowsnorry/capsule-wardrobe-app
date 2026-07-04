import { test, expect, vi } from "vitest";
import { requestJson, startTestServer } from "../test/serverRouteTestUtils.js";

test("health routes expose basic and dependency checks", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const health = await requestJson(baseUrl, "/health");
  expect(health.response.status).toBe(200);
  expect(health.json).toEqual({
    ok: true,
    release: {
      service: "capsule-wardrobe-server",
      commit: expect.any(String),
    },
  });

  const healthAll = await requestJson(baseUrl, "/healthall");
  expect(healthAll.response.status).toBe(200);
  expect(healthAll.json).toEqual({
    ok: true,
    release: {
      service: "capsule-wardrobe-server",
      commit: expect.any(String),
    },
    dependencies: { database: "ok" },
  });
});

test("internal metrics endpoint is reserved and forbidden", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const metrics = await requestJson(baseUrl, "/internal/metrics");
  expect(metrics.response.status).toBe(403);
  expect(metrics.json).toEqual({ error: "forbidden" });

  const apiMetrics = await requestJson(baseUrl, "/api/internal/metrics");
  expect(apiMetrics.response.status).toBe(403);
  expect(apiMetrics.json).toEqual({ error: "forbidden" });
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
  expect(failingHealth.json).toEqual({
    ok: false,
    release: {
      service: "capsule-wardrobe-server",
      commit: expect.any(String),
    },
    dependencies: { database: "error" },
  });
});
