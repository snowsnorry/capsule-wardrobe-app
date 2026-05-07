import { test, expect } from "vitest";
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

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const assets = await downloadProductImageAssets(createItems("top", 1));
  const asset = assets["top-1"];

  expect(asset).toBeTruthy();
  expect(asset.mimeType).toBe("image/jpeg");
  expect(asset.source).toBe("download");
  expect(Buffer.isBuffer(asset.buffer)).toBeTruthy();
  const metadata = await sharp(asset.buffer).metadata();
  expect(metadata.format).toBe("jpeg");
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

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  const assets = await downloadProductImageAssets([{
    id: "top-1",
    category: "top",
    image_url: imageUrl
  }]);

  const asset = assets["top-1"];
  expect(asset).toBeTruthy();
  expect(asset.source).toBe("cache");
  expect(asset.originalImageUrl).toBe(imageUrl);
  const metadata = await sharp(asset.buffer).metadata();
  expect(metadata.format).toBe("jpeg");
});

test("downloadProductImageAssets replaces width placeholder in image url before fetch", async (t) => {
  const fixtureBuffer = await createFixtureBuffer("#228833");
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return createBinaryResponse(fixtureBuffer, { status: 200 });
  };

  t.onTestFinished(() => {
    globalThis.fetch = originalFetch;
  });

  await downloadProductImageAssets([{
    id: "top-1",
    category: "top",
    image_url: "https://static.zara.net/image.jpg?ts=1773310573314&w={width}"
  }]);

  expect(requestedUrls.length).toBe(1);
  expect(requestedUrls[0]).toBe("https://static.zara.net/image.jpg?ts=1773310573314&w=1000");
});
