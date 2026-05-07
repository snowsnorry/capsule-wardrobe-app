import { test, expect } from "vitest";
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
  expect(buildPromptDebugImageStitched({ category: "all" })).toEqual({
    category: "all",
    mimeType: "image/jpeg",
    filename: "categories-stitched.jpg",
    totalItems: 1,
    categoryCount: 1,
    buffer: Buffer.from("stitched")
  });

  expect(buildPromptDebugImageCategory({ category: "bottom", buffer: Buffer.from("bottom") })).toEqual({
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
  expect(result.skippedCount).toBe(3);
  expect(result.categories.length).toBe(1);
  expect(result.timings?.networkFetchMs).toBe(0);
});

test("response test doubles create json, text, and binary responses", async () => {
  const jsonResponse = createJsonResponse({ ok: true }, { status: 201 });
  expect(jsonResponse.status).toBe(201);
  expect(jsonResponse.headers.get("content-type")).toBe("application/json");
  expect(await jsonResponse.json()).toEqual({ ok: true });

  const textResponse = createTextResponse("hello", {
    headers: {
      "x-test": "1"
    }
  });
  expect(textResponse.status).toBe(200);
  expect(textResponse.headers.get("x-test")).toBe("1");
  expect(await textResponse.text()).toBe("hello");

  const binaryResponse = createBinaryResponse(Buffer.from("bytes"), { status: 202 });
  expect(binaryResponse.status).toBe(202);
  expect(Buffer.from(await binaryResponse.arrayBuffer()).toString("utf8")).toBe("bytes");
});

test("createMockChildProcess exposes child process event and lifecycle helpers", async () => {
  const child = createMockChildProcess();
  let received: unknown = null;

  child.on("message", (message) => {
    received = message;
  });
  child.emit("message", { ok: true });

  expect(received).toEqual({ ok: true });
  expect(child.pid).toBe(1234);
  expect(child.connected).toBe(true);
  expect(child.kill()).toBe(true);
  expect(child.ref()).toBe(child);
  expect(child.unref()).toBe(child);
  expect(child.disconnect()).toBe(child);

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
