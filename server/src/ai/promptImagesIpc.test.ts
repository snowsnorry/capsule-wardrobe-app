import { test, expect } from "vitest";
import type { TestContext } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  buildPromptDebugImagesInChild,
  deserializePromptDebugImagesFromIpc,
  serializePromptDebugImagesForIpc,
} from "./promptImagesIpc.js";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  HEADER_HEIGHT,
} from "./promptImagesShared.js";
import {
  assertCategoryHasBufferProperty,
  createFixtureBuffer,
  withCachedImage,
  withTempDir,
} from "../test/promptImageFixtures.js";

function enableTsChildProcess(testContext: TestContext): void {
  const originalExecArgv = [...process.execArgv];
  if (!process.execArgv.includes("tsx")) {
    process.execArgv.push("--import", "tsx");
  }
  testContext.onTestFinished(() => {
    process.execArgv.splice(0, process.execArgv.length, ...originalExecArgv);
  });
}

test("prompt image IPC serialization round-trips collages back to buffers", async (_t) => {
  const fixtureBuffer = await createFixtureBuffer("#8844aa");
  const serialized = serializePromptDebugImagesForIpc({
    cachedCount: 1,
    downloadedCount: 1,
    skippedCount: 0,
    stitched: {
      category: "all-categories",
      mimeType: "image/jpeg",
      buffer: fixtureBuffer,
      filename: "categories-stitched.jpg",
      totalItems: 1,
      categoryCount: 1,
    },
    categories: [
      {
        category: "top",
        mimeType: "image/jpeg",
        filename: "category-top.jpg",
        totalItems: 1,
        cachedCount: 1,
        downloadedCount: 1,
        skippedCount: 0,
        items: [],
      },
    ],
  });

  const deserialized = deserializePromptDebugImagesFromIpc(serialized);

  expect(deserialized.cachedCount).toBe(1);
  expect(deserialized.downloadedCount).toBe(1);
  expect(deserialized.skippedCount).toBe(0);
  expect(Buffer.isBuffer(serialized.stitched?.buffer)).toBeTruthy();
  expect(Buffer.isBuffer(deserialized.stitched?.buffer)).toBeTruthy();
  expect(deserialized.stitched?.buffer).toEqual(fixtureBuffer);
  expect(deserialized.categories[0].cachedCount).toBe(1);
  expect(serialized.categories[0].buffer).toBe(null);
  assertCategoryHasBufferProperty(deserialized.categories[0]);
  expect(deserialized.categories[0].buffer).toBe(null);
});

test("buildPromptDebugImagesInChild resolves buffered collages from child success payload", async (_t) => {
  const result = await buildPromptDebugImagesInChild({
    normalizedItems: [
      {
        id: "top-1",
        category: "top",
        image_url: "https://example.com/top-1.png",
      },
      {
        id: "bottom-1",
        category: "bottom",
        image_url: "https://example.com/bottom-1.png",
      },
    ],
    forkImpl: (_modulePath, _options) => {
      const handlers = new Map();
      return {
        on(event, handler) {
          handlers.set(event, handler);
        },
        removeListener(event) {
          handlers.delete(event);
        },
        kill() {},
        send() {
          handlers.get("message")?.({
            ok: true,
            cachedCount: 1,
            downloadedCount: 1,
            skippedCount: 0,
            stitched: {
              category: "all-categories",
              mimeType: "image/jpeg",
              filename: "categories-stitched.jpg",
              totalItems: 2,
              categoryCount: 2,
              buffer: Buffer.from("child-image-stitched"),
            },
            categories: [
              {
                category: "top",
                mimeType: "image/jpeg",
                filename: "category-top.jpg",
                totalItems: 1,
                cachedCount: 1,
                downloadedCount: 0,
                skippedCount: 0,
                items: [],
              },
              {
                category: "bottom",
                mimeType: "image/jpeg",
                filename: "category-bottom.jpg",
                totalItems: 1,
                cachedCount: 0,
                downloadedCount: 1,
                skippedCount: 0,
                items: [],
              },
            ],
          });
          handlers.get("exit")?.(0, null);
        },
      };
    },
  });

  expect(result.cachedCount).toBe(1);
  expect(result.downloadedCount).toBe(1);
  expect(result.categories.length).toBe(2);
  expect(Buffer.isBuffer(result.stitched?.buffer)).toBeTruthy();
  expect(String(result.stitched?.buffer)).toBe("child-image-stitched");
  assertCategoryHasBufferProperty(result.categories[0]);
  assertCategoryHasBufferProperty(result.categories[1]);
  expect(result.categories[0].buffer).toBe(null);
  expect(result.categories[1].buffer).toBe(null);
});

test("buildPromptDebugImagesInChild works with a real child process", async (t) => {
  enableTsChildProcess(t);
  const fixtureBuffer = await createFixtureBuffer("#1177aa");
  const imageUrl = "https://example.com/top-1.png";
  await withCachedImage(t, imageUrl, fixtureBuffer);

  const result = await buildPromptDebugImagesInChild({
    normalizedItems: [
      {
        id: "top-1",
        category: "top",
        image_url: imageUrl,
      },
    ],
  });

  expect(result.cachedCount).toBe(1);
  expect(result.downloadedCount).toBe(0);
  expect(result.skippedCount).toBe(0);
  expect(result.categories.length).toBe(1);
  expect(Buffer.isBuffer(result.stitched?.buffer)).toBeTruthy();
  const stitchedMetadata = await sharp(result.stitched?.buffer).metadata();
  expect(stitchedMetadata.width).toBe(GRID_WIDTH);
  expect(stitchedMetadata.height).toBe(GRID_HEIGHT + HEADER_HEIGHT);
});

test("buildPromptDebugImagesInChild saves debug artifacts when enabled", async (t) => {
  enableTsChildProcess(t);
  const outputDir = await withTempDir(t);
  const fixtureBuffer = await createFixtureBuffer("#1177aa");
  const imageUrl = "https://example.com/top-1.png";
  await withCachedImage(t, imageUrl, fixtureBuffer);

  const result = await buildPromptDebugImagesInChild({
    normalizedItems: [
      {
        id: "top-1",
        category: "top",
        image_url: imageUrl,
      },
    ],
    saveDebugArtifacts: true,
    debugOutputDir: outputDir,
  });

  expect(result.cachedCount).toBe(1);
  expect(result.downloadedCount).toBe(0);
  const manifest = JSON.parse(
    await readFile(path.join(outputDir, "manifest.json"), "utf8"),
  );
  expect(manifest.cachedCount).toBe(1);
  expect(manifest.downloadedCount).toBe(0);
  expect(manifest.stitched.file).toBe(
    path.join(outputDir, "categories-stitched.jpg"),
  );
  expect(manifest.categories.length).toBe(1);
});

test("buildPromptDebugImagesInChild rejects on child-reported failure", async (_t) => {
  await expect(
    buildPromptDebugImagesInChild({
      normalizedItems: [
        {
          id: "top-1",
          category: "top",
          image_url: "https://example.com/top-1.png",
        },
      ],
      forkImpl: () => {
        const handlers = new Map();
        return {
          on(event, handler) {
            handlers.set(event, handler);
          },
          removeListener(event) {
            handlers.delete(event);
          },
          kill() {},
          send() {
            handlers.get("message")?.({
              ok: false,
              message: "child_failed",
            });
          },
        };
      },
    }),
  ).rejects.toThrow(/child_failed/);
});

test("buildPromptDebugImagesInChild rejects on unexpected child exit", async (_t) => {
  await expect(
    buildPromptDebugImagesInChild({
      normalizedItems: [
        {
          id: "top-1",
          category: "top",
          image_url: "https://example.com/top-1.png",
        },
      ],
      forkImpl: () => {
        const handlers = new Map();
        return {
          on(event, handler) {
            handlers.set(event, handler);
          },
          removeListener(event) {
            handlers.delete(event);
          },
          kill() {},
          send() {
            handlers.get("exit")?.(1, "SIGTERM");
          },
        };
      },
    }),
  ).rejects.toThrow(/prompt_images_child_exit:1:SIGTERM/);
});
