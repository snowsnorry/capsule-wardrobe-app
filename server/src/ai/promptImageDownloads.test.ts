import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { downloadProductImageAssets } from "./promptImageDownloads.js";
import { createBinaryResponse } from "../test/testDoubles.js";
import { createFixtureBuffer, createItems, withCachedImage } from "../test/promptImageFixtures.js";

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

  globalThis.fetch = async () => createBinaryResponse(transparentBuffer, {
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
  const requestedUrls: string[] = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return createBinaryResponse(fixtureBuffer, { status: 200 });
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
