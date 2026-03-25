import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  buildPromptDebugImages,
  GRID_HEIGHT,
  GRID_WIDTH,
  HEADER_HEIGHT,
  MAX_ITEMS_PER_CATEGORY,
  groupPromptImageItemsByCategory,
  downloadProductImageAssets,
  preparePdfImageAssets
} from "./ai/promptImages.js";

async function createFixtureBuffer(color) {
  return sharp({
    create: {
      width: 640,
      height: 320,
      channels: 3,
      background: color
    }
  })
    .png()
    .toBuffer();
}

async function withTempDir(testContext, prefix = "prompt-images-") {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  testContext.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });
  return tempDir;
}

function createItems(category, count, imageUrlFactory = (index) => `https://example.com/${category}-${index}.png`) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${category}-${index + 1}`,
    category,
    image_url: imageUrlFactory(index + 1)
  }));
}

test("groupPromptImageItemsByCategory preserves order and caps each category at 10 items", () => {
  const groups = groupPromptImageItemsByCategory([
    ...createItems("top", MAX_ITEMS_PER_CATEGORY + 2),
    ...createItems("bottom", 3)
  ]);

  assert.deepEqual([...groups.keys()], ["top", "bottom"]);
  assert.equal(groups.get("top").length, MAX_ITEMS_PER_CATEGORY);
  assert.equal(groups.get("top")[0].id, "top-1");
  assert.equal(groups.get("top")[9].id, "top-10");
  assert.equal(groups.get("bottom").length, 3);
});

test("buildPromptDebugImages writes category images with expected geometry and manifest", async (t) => {
  const outputDir = await withTempDir(t);
  const greenBuffer = await createFixtureBuffer("#00aa00");
  const blueBuffer = await createFixtureBuffer("#0044cc");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).includes("top-1")) {
      return new Response(greenBuffer, { status: 200 });
    }
    return new Response(blueBuffer, { status: 200 });
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

  assert.equal(result.downloadedCount, 3);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.categories.length, 2);

  const topCategory = result.categories.find((entry) => entry.category === "top");
  assert.ok(topCategory);
  assert.equal(topCategory.mimeType, "image/jpeg");
  assert.ok(Buffer.isBuffer(topCategory.buffer));

  const metadata = await sharp(topCategory.buffer).metadata();
  assert.equal(metadata.width, GRID_WIDTH);
  assert.equal(metadata.height, GRID_HEIGHT + HEADER_HEIGHT);

  const manifest = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"));
  assert.equal(manifest.downloadedCount, 3);
  assert.equal(manifest.categories.length, 2);
  assert.equal(manifest.categories[0].items[0].status, "downloaded");
  assert.equal(manifest.categories[0].items[0].tileFile, undefined);
});

test("buildPromptDebugImages keeps collages in memory when debug saving is disabled", async (t) => {
  const outputDir = await withTempDir(t);
  const redBuffer = await createFixtureBuffer("#cc0000");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response(redBuffer, { status: 200 });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: createItems("top", 2),
    saveDebugArtifacts: false,
    debugOutputDir: outputDir
  });

  assert.equal(result.categories.length, 1);
  assert.ok(Buffer.isBuffer(result.categories[0].buffer));
  await assert.rejects(access(path.join(outputDir, "manifest.json")));
  await assert.rejects(access(path.join(outputDir, "category-top.jpg")));
});

test("buildPromptDebugImages skips failed downloads and still produces outputs", async (t) => {
  const outputDir = await withTempDir(t);
  const redBuffer = await createFixtureBuffer("#cc0000");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).includes("bad")) {
      throw new Error("socket_hang_up");
    }
    return new Response(redBuffer, { status: 200 });
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
  assert.equal(result.skippedCount, 1);

  const manifest = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"));
  assert.equal(manifest.categories[0].items[1].status, "skipped");
  assert.equal(manifest.categories[0].items[1].reason, "socket_hang_up");

  const metadata = await sharp(result.categories[0].buffer).metadata();
  assert.equal(metadata.width, GRID_WIDTH);
  assert.equal(metadata.height, GRID_HEIGHT + HEADER_HEIGHT);
});

test("downloadProductImageAssets normalizes downloaded files to jpeg", async (t) => {
  const transparentBuffer = await sharp({
    create: {
      width: 300,
      height: 180,
      channels: 4,
      background: { r: 10, g: 120, b: 240, alpha: 0.3 }
    }
  }).png().toBuffer();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response(transparentBuffer, {
    status: 200,
    headers: {
      "content-type": "image/png"
    }
  });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const assets = await downloadProductImageAssets(createItems("top", 1));
  const asset = assets["top-1"];

  assert.ok(asset);
  assert.equal(asset.mimeType, "image/jpeg");
  assert.ok(Buffer.isBuffer(asset.buffer));
  const metadata = await sharp(asset.buffer).metadata();
  assert.equal(metadata.format, "jpeg");
});

test("preparePdfImageAssets resizes normalized images for pdf", async () => {
  const source = await sharp({
    create: {
      width: 2400,
      height: 1600,
      channels: 3,
      background: "#336699"
    }
  }).jpeg({ quality: 90 }).toBuffer();

  const prepared = await preparePdfImageAssets({
    "top-1": {
      buffer: source,
      mimeType: "image/jpeg",
      imageUrl: "https://example.com/top-1.jpg"
    }
  }, {
    width: 600,
    height: 400
  });

  assert.ok(prepared["top-1"]);
  assert.equal(prepared["top-1"].preparedForPdf, true);
  assert.equal(prepared["top-1"].kind, "jpg");
  const metadata = await sharp(prepared["top-1"].buffer).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.ok(metadata.width <= 600);
  assert.ok(metadata.height <= 400);
});
