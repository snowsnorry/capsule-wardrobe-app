import { test, expect, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  requestJson,
  requestText,
  startTestServer,
} from "../test/serverRouteTestUtils.js";

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

test("image cache route serves cached jpeg files and rejects invalid names", async (t) => {
  const imageStorageDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "capsule-image-cache-test-"),
  );
  t.onTestFinished(async () => {
    await fs.rm(imageStorageDir, { recursive: true, force: true });
  });

  const filename = `${"a".repeat(64)}.jpg`;
  await fs.writeFile(
    path.join(imageStorageDir, filename),
    Buffer.from("cached-image"),
  );

  const { baseUrl } = await startTestServer(t, {
    overrides: { imageStorageDir },
  });

  const found = await requestText(baseUrl, `/images/${filename}`);
  expect(found.response.status).toBe(200);
  expect(found.response.headers.get("content-type")).toBe("image/jpeg");
  expect(found.response.headers.get("cache-control")).toBe(
    "public, max-age=3600",
  );
  expect(found.text).toBe("cached-image");

  const missing = await requestJson(baseUrl, `/images/${"b".repeat(64)}.jpg`);
  expect(missing.response.status).toBe(404);
  expect(missing.json).toEqual({ error: "not_found" });

  for (const invalidPath of [
    "/images/missing.jpg",
    `/images/${"g".repeat(64)}.jpg`,
    `/images/${"a".repeat(64)}.png`,
  ]) {
    const invalid = await requestJson(baseUrl, invalidPath);
    expect(invalid.response.status).toBe(404);
    expect(invalid.json).toEqual({ error: "not_found" });
  }

  const traversal = await requestText(baseUrl, "/images/%2e%2e/secret.jpg");
  expect(traversal.response.status).toBe(404);
});
