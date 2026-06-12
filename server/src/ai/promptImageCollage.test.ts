import { test, expect, vi } from "vitest";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  buildPromptDebugImages,
  buildPromptDebugImagesForCategory,
} from "./promptImageCollage.js";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  HEADER_HEIGHT,
  TILE_SIZE,
} from "./promptImagesShared.js";
import { createBinaryResponse } from "../test/testDoubles.js";
import {
  assertCategoryHasBufferProperty,
  createFixtureBuffer,
  createItems,
  withCachedImage,
  withTempDir,
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

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: [...createItems("top", 2), ...createItems("bottom", 1)],
    saveDebugArtifacts: true,
    debugOutputDir: outputDir,
  });

  expect(result.cachedCount).toBe(0);
  expect(result.downloadedCount).toBe(3);
  expect(result.skippedCount).toBe(0);
  expect(result.categories.length).toBe(2);
  expect(Buffer.isBuffer(result.stitched.buffer)).toBeTruthy();

  const topCategory = result.categories.find(
    (entry) => entry.category === "top",
  );
  expect(topCategory).toBeTruthy();
  assertCategoryHasBufferProperty(topCategory);
  expect(topCategory.mimeType).toBe("image/jpeg");
  expect(topCategory.buffer).toBe(undefined);

  const metadata = await sharp(
    path.join(outputDir, "category-top.jpg"),
  ).metadata();
  expect(metadata.width).toBe(GRID_WIDTH);
  expect(metadata.height).toBe(GRID_HEIGHT + HEADER_HEIGHT);
  const stitchedMetadata = await sharp(result.stitched.buffer).metadata();
  expect(stitchedMetadata.width).toBe(GRID_WIDTH);
  expect(stitchedMetadata.height).toBe((GRID_HEIGHT + HEADER_HEIGHT) * 2);

  const manifest = JSON.parse(
    await readFile(path.join(outputDir, "manifest.json"), "utf8"),
  );
  expect(manifest.cachedCount).toBe(0);
  expect(manifest.downloadedCount).toBe(3);
  expect(manifest.stitched.file).toBe(
    path.join(outputDir, "categories-stitched.jpg"),
  );
  expect(manifest.categories.length).toBe(2);
  expect(manifest.categories[0].cachedCount).toBe(0);
  expect(manifest.categories[0].items[0].status).toBe("downloaded");
  expect(manifest.categories[0].items[0].source).toBe("download");
  expect(manifest.categories[0].items[0].tileFile).toBe(undefined);
});

test("buildPromptDebugImagesForCategory can compact category height to populated rows", async (t) => {
  const greenBuffer = await createFixtureBuffer("#00aa00");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    createBinaryResponse(greenBuffer, { status: 200 });

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const defaultResult = await buildPromptDebugImagesForCategory({
    category: "Current Outfit",
    items: createItems("current-outfit", 5),
  });
  const compactFiveResult = await buildPromptDebugImagesForCategory({
    category: "Current Outfit",
    compactRows: true,
    items: createItems("current-outfit", 5),
  });
  const compactSixResult = await buildPromptDebugImagesForCategory({
    category: "Current Outfit",
    compactRows: true,
    items: createItems("current-outfit", 6),
  });

  await expect(
    sharp(defaultResult.category.buffer).metadata(),
  ).resolves.toMatchObject({
    width: GRID_WIDTH,
    height: HEADER_HEIGHT + GRID_HEIGHT,
  });
  await expect(
    sharp(compactFiveResult.category.buffer).metadata(),
  ).resolves.toMatchObject({
    width: GRID_WIDTH,
    height: HEADER_HEIGHT + TILE_SIZE,
  });
  await expect(
    sharp(compactSixResult.category.buffer).metadata(),
  ).resolves.toMatchObject({
    width: GRID_WIDTH,
    height: HEADER_HEIGHT + TILE_SIZE * 2,
  });
});

test("buildPromptDebugImages keeps collages in memory when debug saving is disabled", async (t) => {
  const outputDir = await withTempDir(t);
  const redBuffer = await createFixtureBuffer("#cc0000");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    createBinaryResponse(redBuffer, { status: 200 });

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: createItems("top", 2),
    saveDebugArtifacts: false,
    debugOutputDir: outputDir,
  });

  expect(result.categories.length).toBe(1);
  expect(Buffer.isBuffer(result.stitched.buffer)).toBeTruthy();
  assertCategoryHasBufferProperty(result.categories[0]);
  expect(result.categories[0].buffer).toBe(undefined);
  await expect(access(path.join(outputDir, "manifest.json"))).rejects.toThrow();
  await expect(
    access(path.join(outputDir, "category-top.jpg")),
  ).rejects.toThrow();
  await expect(
    access(path.join(outputDir, "categories-stitched.jpg")),
  ).rejects.toThrow();
});

test("buildPromptDebugImages skips failed downloads and still produces outputs", async (t) => {
  const outputDir = await withTempDir(t);
  const redBuffer = await createFixtureBuffer("#cc0000");
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  vi.spyOn(console, "warn").mockImplementation((...args) => {
    if (args[0] === "[prompt-images][asset-download-failed]") {
      return;
    }
    originalWarn(...args);
  });

  globalThis.fetch = async (url) => {
    if (String(url).includes("bad")) {
      throw new Error("socket_hang_up");
    }
    return createBinaryResponse(redBuffer, { status: 200 });
  };

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const result = await buildPromptDebugImages({
    normalizedItems: [
      {
        id: "top-1",
        category: "top",
        imageUrl: "https://example.com/good-top.png",
      },
      {
        id: "top-2",
        category: "top",
        imageUrl: "https://example.com/bad-top.png",
      },
    ],
    saveDebugArtifacts: true,
    debugOutputDir: outputDir,
  });

  expect(result.downloadedCount).toBe(1);
  expect(result.cachedCount).toBe(0);
  expect(result.skippedCount).toBe(1);
  expect(Buffer.isBuffer(result.stitched.buffer)).toBeTruthy();

  const manifest = JSON.parse(
    await readFile(path.join(outputDir, "manifest.json"), "utf8"),
  );
  expect(manifest.categories[0].items[1].status).toBe("skipped");
  expect(manifest.categories[0].items[1].reason).toBe("socket_hang_up");

  const metadata = await sharp(
    path.join(outputDir, "category-top.jpg"),
  ).metadata();
  expect(metadata.width).toBe(GRID_WIDTH);
  expect(metadata.height).toBe(GRID_HEIGHT + HEADER_HEIGHT);
});

test("buildPromptDebugImages uses local cached image before remote fetch", async (t) => {
  const outputDir = await withTempDir(t);
  const cachedJpeg = await sharp({
    create: {
      width: 900,
      height: 600,
      channels: 3,
      background: "#d97706",
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  const imageUrl =
    "https://static.zara.net/image.jpg?ts=1773310573314&w={width}";
  await withCachedImage(t, imageUrl, cachedJpeg);
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("fetch_should_not_be_called");
  };

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: [
      {
        id: "top-1",
        category: "top",
        imageUrl: imageUrl,
      },
    ],
    saveDebugArtifacts: true,
    debugOutputDir: outputDir,
  });

  expect(result.cachedCount).toBe(1);
  expect(result.downloadedCount).toBe(0);
  expect(result.skippedCount).toBe(0);

  const manifest = JSON.parse(
    await readFile(path.join(outputDir, "manifest.json"), "utf8"),
  );
  expect(manifest.categories[0].items[0].source).toBe("cache");
});

test("buildPromptDebugImages does not return a normalized image map", async (t) => {
  const redBuffer = await createFixtureBuffer("#cc0000");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    createBinaryResponse(redBuffer, { status: 200 });

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: createItems("top", 1),
  });

  expect("downloadedImagesById" in result).toBe(false);
});
