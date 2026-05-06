import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  buildPromptDebugImagesInChild,
  deserializePromptDebugImagesFromIpc,
  serializePromptDebugImagesForIpc
} from "./promptImagesIpc.js";
import { GRID_HEIGHT, GRID_WIDTH, HEADER_HEIGHT } from "./promptImagesShared.js";
import {
  assertCategoryHasBufferProperty,
  createFixtureBuffer,
  withCachedImage,
  withTempDir
} from "../test/promptImageFixtures.js";

test("prompt image IPC serialization round-trips collages back to buffers", async () => {
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
      categoryCount: 1
    },
    categories: [{
      category: "top",
      mimeType: "image/jpeg",
      filename: "category-top.jpg",
      totalItems: 1,
      cachedCount: 1,
      downloadedCount: 1,
      skippedCount: 0,
      items: []
    }]
  });

  const deserialized = deserializePromptDebugImagesFromIpc(serialized);

  assert.equal(deserialized.cachedCount, 1);
  assert.equal(deserialized.downloadedCount, 1);
  assert.equal(deserialized.skippedCount, 0);
  assert.ok(Buffer.isBuffer(serialized.stitched?.buffer));
  assert.ok(Buffer.isBuffer(deserialized.stitched?.buffer));
  assert.deepEqual(deserialized.stitched?.buffer, fixtureBuffer);
  assert.equal(deserialized.categories[0].cachedCount, 1);
  assert.equal(serialized.categories[0].buffer, null);
  assertCategoryHasBufferProperty(deserialized.categories[0]);
  assert.equal(deserialized.categories[0].buffer, null);
});

test("buildPromptDebugImagesInChild resolves buffered collages from child success payload", async () => {
  const result = await buildPromptDebugImagesInChild({
    normalizedItems: [
      { id: "top-1", category: "top", image_url: "https://example.com/top-1.png" },
      { id: "bottom-1", category: "bottom", image_url: "https://example.com/bottom-1.png" }
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
              buffer: Buffer.from("child-image-stitched")
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
                items: []
              },
              {
                category: "bottom",
                mimeType: "image/jpeg",
                filename: "category-bottom.jpg",
                totalItems: 1,
                cachedCount: 0,
                downloadedCount: 1,
                skippedCount: 0,
                items: []
              }
            ]
          });
          handlers.get("exit")?.(0, null);
        }
      };
    }
  });

  assert.equal(result.cachedCount, 1);
  assert.equal(result.downloadedCount, 1);
  assert.equal(result.categories.length, 2);
  assert.ok(Buffer.isBuffer(result.stitched?.buffer));
  assert.equal(String(result.stitched?.buffer), "child-image-stitched");
  assertCategoryHasBufferProperty(result.categories[0]);
  assertCategoryHasBufferProperty(result.categories[1]);
  assert.equal(result.categories[0].buffer, null);
  assert.equal(result.categories[1].buffer, null);
});

test("buildPromptDebugImagesInChild works with a real child process", async (t) => {
  const fixtureBuffer = await createFixtureBuffer("#1177aa");
  const imageUrl = "https://example.com/top-1.png";
  await withCachedImage(t, imageUrl, fixtureBuffer);

  const result = await buildPromptDebugImagesInChild({
    normalizedItems: [{
      id: "top-1",
      category: "top",
      image_url: imageUrl
    }]
  });

  assert.equal(result.cachedCount, 1);
  assert.equal(result.downloadedCount, 0);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.categories.length, 1);
  assert.ok(Buffer.isBuffer(result.stitched?.buffer));
  const stitchedMetadata = await sharp(result.stitched?.buffer).metadata();
  assert.equal(stitchedMetadata.width, GRID_WIDTH);
  assert.equal(stitchedMetadata.height, GRID_HEIGHT + HEADER_HEIGHT);
});

test("buildPromptDebugImagesInChild saves debug artifacts when enabled", async (t) => {
  const outputDir = await withTempDir(t);
  const fixtureBuffer = await createFixtureBuffer("#1177aa");
  const imageUrl = "https://example.com/top-1.png";
  await withCachedImage(t, imageUrl, fixtureBuffer);

  const result = await buildPromptDebugImagesInChild({
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
  const manifest = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"));
  assert.equal(manifest.cachedCount, 1);
  assert.equal(manifest.downloadedCount, 0);
  assert.equal(manifest.stitched.file, path.join(outputDir, "categories-stitched.jpg"));
  assert.equal(manifest.categories.length, 1);
});

test("buildPromptDebugImagesInChild rejects on child-reported failure", async () => {
  await assert.rejects(
    buildPromptDebugImagesInChild({
      normalizedItems: [{ id: "top-1", category: "top", image_url: "https://example.com/top-1.png" }],
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
              message: "child_failed"
            });
          }
        };
      }
    }),
    /child_failed/
  );
});

test("buildPromptDebugImagesInChild rejects on unexpected child exit", async () => {
  await assert.rejects(
    buildPromptDebugImagesInChild({
      normalizedItems: [{ id: "top-1", category: "top", image_url: "https://example.com/top-1.png" }],
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
          }
        };
      }
    }),
    /prompt_images_child_exit:1:SIGTERM/
  );
});
