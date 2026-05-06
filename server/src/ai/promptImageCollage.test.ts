import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  buildPromptDebugImages
} from "./promptImageCollage.js";
import { GRID_HEIGHT, GRID_WIDTH, HEADER_HEIGHT } from "./promptImagesShared.js";
import { createBinaryResponse } from "../test/testDoubles.js";
import {
  assertCategoryHasBufferProperty,
  createFixtureBuffer,
  createItems,
  withCachedImage,
  withTempDir
} from "../test/promptImageFixtures.js";

test("buildPromptDebugImages writes category images with expected geometry and manifest", async (t) => {
  const outputDir = await withTempDir(t);
  const greenBuffer = await createFixtureBuffer("#00aa00");
  const blueBuffer = await createFixtureBuffer("#0044cc");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).includes("top-1")) {
      return createBinaryResponse(greenBuffer, { status: 200 });
    }
    return createBinaryResponse(blueBuffer, { status: 200 });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: [
      ...createItems("top", 2),
      ...createItems("bottom", 1)
    ],
    saveDebugArtifacts: true,
    debugOutputDir: outputDir
  });

  assert.equal(result.cachedCount, 0);
  assert.equal(result.downloadedCount, 3);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.categories.length, 2);
  assert.ok(Buffer.isBuffer(result.stitched.buffer));

  const topCategory = result.categories.find((entry) => entry.category === "top");
  assert.ok(topCategory);
  assertCategoryHasBufferProperty(topCategory);
  assert.equal(topCategory.mimeType, "image/jpeg");
  assert.equal(topCategory.buffer, undefined);

  const metadata = await sharp(path.join(outputDir, "category-top.jpg")).metadata();
  assert.equal(metadata.width, GRID_WIDTH);
  assert.equal(metadata.height, GRID_HEIGHT + HEADER_HEIGHT);
  const stitchedMetadata = await sharp(result.stitched.buffer).metadata();
  assert.equal(stitchedMetadata.width, GRID_WIDTH);
  assert.equal(stitchedMetadata.height, (GRID_HEIGHT + HEADER_HEIGHT) * 2);

  const manifest = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"));
  assert.equal(manifest.cachedCount, 0);
  assert.equal(manifest.downloadedCount, 3);
  assert.equal(manifest.stitched.file, path.join(outputDir, "categories-stitched.jpg"));
  assert.equal(manifest.categories.length, 2);
  assert.equal(manifest.categories[0].cachedCount, 0);
  assert.equal(manifest.categories[0].items[0].status, "downloaded");
  assert.equal(manifest.categories[0].items[0].source, "download");
  assert.equal(manifest.categories[0].items[0].tileFile, undefined);
});

test("buildPromptDebugImages keeps collages in memory when debug saving is disabled", async (t) => {
  const outputDir = await withTempDir(t);
  const redBuffer = await createFixtureBuffer("#cc0000");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => createBinaryResponse(redBuffer, { status: 200 });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: createItems("top", 2),
    saveDebugArtifacts: false,
    debugOutputDir: outputDir
  });

  assert.equal(result.categories.length, 1);
  assert.ok(Buffer.isBuffer(result.stitched.buffer));
  assertCategoryHasBufferProperty(result.categories[0]);
  assert.equal(result.categories[0].buffer, undefined);
  await assert.rejects(access(path.join(outputDir, "manifest.json")));
  await assert.rejects(access(path.join(outputDir, "category-top.jpg")));
  await assert.rejects(access(path.join(outputDir, "categories-stitched.jpg")));
});

test("buildPromptDebugImages skips failed downloads and still produces outputs", async (t) => {
  const outputDir = await withTempDir(t);
  const redBuffer = await createFixtureBuffer("#cc0000");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).includes("bad")) {
      throw new Error("socket_hang_up");
    }
    return createBinaryResponse(redBuffer, { status: 200 });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: [
      { id: "top-1", category: "top", image_url: "https://example.com/good-top.png" },
      { id: "top-2", category: "top", image_url: "https://example.com/bad-top.png" }
    ],
    saveDebugArtifacts: true,
    debugOutputDir: outputDir
  });

  assert.equal(result.downloadedCount, 1);
  assert.equal(result.cachedCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.ok(Buffer.isBuffer(result.stitched.buffer));

  const manifest = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"));
  assert.equal(manifest.categories[0].items[1].status, "skipped");
  assert.equal(manifest.categories[0].items[1].reason, "socket_hang_up");

  const metadata = await sharp(path.join(outputDir, "category-top.jpg")).metadata();
  assert.equal(metadata.width, GRID_WIDTH);
  assert.equal(metadata.height, GRID_HEIGHT + HEADER_HEIGHT);
});

test("buildPromptDebugImages uses local cached image before remote fetch", async (t) => {
  const outputDir = await withTempDir(t);
  const cachedJpeg = await sharp({
    create: {
      width: 900,
      height: 600,
      channels: 3,
      background: "#d97706"
    }
  }).jpeg({ quality: 80 }).toBuffer();
  const imageUrl = "https://static.zara.net/image.jpg?ts=1773310573314&w={width}";
  await withCachedImage(t, imageUrl, cachedJpeg);
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("fetch_should_not_be_called");
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: [{
      id: "top-1",
      category: "top",
      image_url: imageUrl
    }],
    saveDebugArtifacts: true,
    debugOutputDir: outputDir
  });

  assert.equal(result.cachedCount, 1);
  assert.equal(result.downloadedCount, 0);
  assert.equal(result.skippedCount, 0);

  const manifest = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"));
  assert.equal(manifest.categories[0].items[0].source, "cache");
});

test("buildPromptDebugImages does not return a normalized image map", async (t) => {
  const redBuffer = await createFixtureBuffer("#cc0000");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => createBinaryResponse(redBuffer, { status: 200 });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: createItems("top", 1)
  });

  assert.equal("downloadedImagesById" in result, false);
});
