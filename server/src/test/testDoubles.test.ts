import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPromptDebugImageCategory,
  buildPromptDebugImageResult,
  buildPromptDebugImageStitched,
  createBinaryResponse,
  createJsonResponse,
  createMockChildProcess,
  createTextResponse
} from "./testDoubles.js";

test("prompt image fixture builders apply defaults and overrides", () => {
  assert.deepEqual(buildPromptDebugImageStitched({ category: "all" }), {
    category: "all",
    mimeType: "image/jpeg",
    filename: "categories-stitched.jpg",
    totalItems: 1,
    categoryCount: 1,
    buffer: Buffer.from("stitched")
  });

  assert.deepEqual(buildPromptDebugImageCategory({ category: "bottom", buffer: Buffer.from("bottom") }), {
    category: "bottom",
    mimeType: "image/jpeg",
    filename: "category-top.jpg",
    totalItems: 1,
    cachedCount: 0,
    downloadedCount: 1,
    skippedCount: 0,
    items: [],
    buffer: Buffer.from("bottom")
  });

  const result = buildPromptDebugImageResult({ skippedCount: 3 });
  assert.equal(result.skippedCount, 3);
  assert.equal(result.categories.length, 1);
  assert.equal(result.timings?.networkFetchMs, 0);
});

test("response test doubles create json, text, and binary responses", async () => {
  const jsonResponse = createJsonResponse({ ok: true }, { status: 201 });
  assert.equal(jsonResponse.status, 201);
  assert.equal(jsonResponse.headers.get("content-type"), "application/json");
  assert.deepEqual(await jsonResponse.json(), { ok: true });

  const textResponse = createTextResponse("hello", {
    headers: {
      "x-test": "1"
    }
  });
  assert.equal(textResponse.status, 200);
  assert.equal(textResponse.headers.get("x-test"), "1");
  assert.equal(await textResponse.text(), "hello");

  const binaryResponse = createBinaryResponse(Buffer.from("bytes"), { status: 202 });
  assert.equal(binaryResponse.status, 202);
  assert.equal(Buffer.from(await binaryResponse.arrayBuffer()).toString("utf8"), "bytes");
});

test("createMockChildProcess exposes child process event and lifecycle helpers", async () => {
  const child = createMockChildProcess();
  let received: unknown = null;

  child.on("message", (message) => {
    received = message;
  });
  child.emit("message", { ok: true });

  assert.deepEqual(received, { ok: true });
  assert.equal(child.pid, 1234);
  assert.equal(child.connected, true);
  assert.equal(child.kill(), true);
  assert.equal(child.ref(), child);
  assert.equal(child.unref(), child);
  assert.equal(child.disconnect(), child);

  await new Promise<void>((resolve, reject) => {
    child.send?.({ ok: true }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});
