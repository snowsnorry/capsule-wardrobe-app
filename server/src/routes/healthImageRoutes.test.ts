import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { requestJson, requestText, startTestServer } from "../test/serverRouteTestUtils.js";

test("health routes expose basic and dependency checks", async (t) => {
  const { baseUrl } = await startTestServer(t);

  const health = await requestJson(baseUrl, "/health");
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.json, { ok: true });

  const healthAll = await requestJson(baseUrl, "/healthall");
  assert.equal(healthAll.response.status, 200);
  assert.deepEqual(healthAll.json, { ok: true });
});

test("healthall maps database dependency failures", async (t) => {
  t.mock.method(console, "error", () => {});
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      checkDatabaseConnectionImpl: async () => {
        throw new Error("db_down");
      }
    }
  });

  const failingHealth = await requestJson(baseUrl, "/healthall");
  assert.equal(failingHealth.response.status, 503);
  assert.deepEqual(failingHealth.json, { ok: false });
});

test("image cache route serves cached jpeg files and rejects invalid names", async (t) => {
  const imageStorageDir = await fs.mkdtemp(path.join(os.tmpdir(), "capsule-image-cache-test-"));
  t.after(async () => {
    await fs.rm(imageStorageDir, { recursive: true, force: true });
  });

  const filename = `${"a".repeat(64)}.jpg`;
  await fs.writeFile(path.join(imageStorageDir, filename), Buffer.from("cached-image"));

  const { baseUrl } = await startTestServer(t, {
    overrides: { imageStorageDir }
  });

  const found = await requestText(baseUrl, `/images/${filename}`);
  assert.equal(found.response.status, 200);
  assert.equal(found.response.headers.get("content-type"), "image/jpeg");
  assert.equal(found.response.headers.get("cache-control"), "public, max-age=3600");
  assert.equal(found.text, "cached-image");

  const missing = await requestJson(baseUrl, `/images/${"b".repeat(64)}.jpg`);
  assert.equal(missing.response.status, 404);
  assert.deepEqual(missing.json, { error: "not_found" });

  for (const invalidPath of [
    "/images/missing.jpg",
    `/images/${"g".repeat(64)}.jpg`,
    `/images/${"a".repeat(64)}.png`
  ]) {
    const invalid = await requestJson(baseUrl, invalidPath);
    assert.equal(invalid.response.status, 404);
    assert.deepEqual(invalid.json, { error: "not_found" });
  }

  const traversal = await requestText(baseUrl, "/images/%2e%2e/secret.jpg");
  assert.equal(traversal.response.status, 404);
});
