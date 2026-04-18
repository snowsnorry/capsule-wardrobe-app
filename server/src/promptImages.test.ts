import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  buildPromptDebugImages,
  buildLocalImageCachePath,
  buildPromptDebugImagesInChild,
  deserializePromptDebugImagesFromIpc,
  GRID_HEIGHT,
  GRID_WIDTH,
  HEADER_HEIGHT,
  MAX_ITEMS_PER_CATEGORY,
  groupPromptImageItemsByCategory,
  downloadProductImageAssets,
  preparePdfImageAssets,
  resolveSourceImageUrl,
  serializePromptDebugImagesForIpc
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

async function withCachedImage(testContext, imageUrl, buffer) {
  const cachePath = buildLocalImageCachePath(imageUrl);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, buffer);
  testContext.after(async () => {
    await rm(cachePath, { force: true });
  });
  return cachePath;
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

test("resolveSourceImageUrl rejects localhost and literal IP hosts for server-side fetches", () => {
  assert.equal(resolveSourceImageUrl("https://example.com/image.jpg?w={width}"), "https://example.com/image.jpg?w=1000");
  assert.equal(resolveSourceImageUrl("https://localhost/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("https://cdn.localhost/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("http://127.0.0.1/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("http://10.0.0.15/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("http://169.254.169.254/latest/meta-data"), "");
  assert.equal(resolveSourceImageUrl("http://[::1]/image.jpg"), "");
  assert.equal(resolveSourceImageUrl("https://[2606:4700:4700::1111]/image.jpg"), "");
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

  assert.equal(result.cachedCount, 0);
  assert.equal(result.downloadedCount, 3);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.categories.length, 2);
  assert.ok(Buffer.isBuffer(result.stitched.buffer));

  const topCategory = result.categories.find((entry) => entry.category === "top");
  assert.ok(topCategory);
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
  assert.ok(Buffer.isBuffer(result.stitched.buffer));
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
  assert.equal(asset.source, "download");
  assert.ok(Buffer.isBuffer(asset.buffer));
  const metadata = await sharp(asset.buffer).metadata();
  assert.equal(metadata.format, "jpeg");
});

test("downloadProductImageAssets uses local cached jpeg before remote fetch", async (t) => {
  const imageUrl = "https://static.zara.net/image.jpg?ts=1773310573314&w={width}";
  const cachedJpeg = await sharp({
    create: {
      width: 1000,
      height: 700,
      channels: 3,
      background: "#1d4ed8"
    }
  }).jpeg({ quality: 80 }).toBuffer();
  await withCachedImage(t, imageUrl, cachedJpeg);
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("fetch_should_not_be_called");
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const assets = await downloadProductImageAssets([{
    id: "top-1",
    category: "top",
    image_url: imageUrl
  }]);

  const asset = assets["top-1"];
  assert.ok(asset);
  assert.equal(asset.source, "cache");
  assert.equal(asset.originalImageUrl, imageUrl);
  const metadata = await sharp(asset.buffer).metadata();
  assert.equal(metadata.format, "jpeg");
});

test("downloadProductImageAssets replaces width placeholder in image url before fetch", async (t) => {
  const fixtureBuffer = await createFixtureBuffer("#228833");
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return new Response(fixtureBuffer, { status: 200 });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await downloadProductImageAssets([{
    id: "top-1",
    category: "top",
    image_url: "https://static.zara.net/image.jpg?ts=1773310573314&w={width}"
  }]);

  assert.equal(requestedUrls.length, 1);
  assert.equal(requestedUrls[0], "https://static.zara.net/image.jpg?ts=1773310573314&w=1000");
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
  assert.ok(Buffer.isBuffer(serialized.stitched.buffer));
  assert.ok(Buffer.isBuffer(deserialized.stitched.buffer));
  assert.deepEqual(deserialized.stitched.buffer, fixtureBuffer);
  assert.equal(deserialized.categories[0].cachedCount, 1);
  assert.equal(serialized.categories[0].buffer, null);
  assert.equal(deserialized.categories[0].buffer, null);
});

test("buildPromptDebugImages does not return a normalized image map", async (t) => {
  const redBuffer = await createFixtureBuffer("#cc0000");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response(redBuffer, { status: 200 });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await buildPromptDebugImages({
    normalizedItems: createItems("top", 1)
  });

  assert.equal("downloadedImagesById" in result, false);
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
  assert.ok(Buffer.isBuffer(result.stitched.buffer));
  assert.equal(String(result.stitched.buffer), "child-image-stitched");
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
  assert.ok(Buffer.isBuffer(result.stitched.buffer));
  const stitchedMetadata = await sharp(result.stitched.buffer).metadata();
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

test("resolveSourceImageUrl only allows http and https schemes", () => {
  assert.equal(resolveSourceImageUrl("https://example.com/image.jpg?w={width}"), "https://example.com/image.jpg?w=1000");
  assert.equal(resolveSourceImageUrl("http://example.com/image.jpg"), "http://example.com/image.jpg");
  assert.equal(resolveSourceImageUrl("javascript:alert(1)"), "");
  assert.equal(resolveSourceImageUrl("data:image/png;base64,abc"), "");
  assert.equal(resolveSourceImageUrl("file:///etc/passwd"), "");
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
