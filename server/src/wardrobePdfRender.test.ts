import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { buildLocalImageCachePath } from "./ai/promptImages.js";
import { buildWardrobePdf } from "./wardrobePdfRender.js";

async function withCachedImage(testContext, imageUrl, buffer) {
  const cachePath = buildLocalImageCachePath(imageUrl);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, buffer);
  testContext.after(async () => {
    await rm(cachePath, { force: true });
  });
}

test("buildWardrobePdf consumes prepared image assets as pages are rendered", async () => {
  const imageBuffer = await sharp({
    create: {
      width: 600,
      height: 400,
      channels: 3,
      background: "#aa6644"
    }
  }).jpeg({ quality: 80 }).toBuffer();
  const imageAssetsById = {
    "top-1": {
      buffer: imageBuffer,
      mimeType: "image/jpeg",
      kind: "jpg",
      preparedForPdf: true,
      imageUrl: "https://example.com/top-1.jpg"
    }
  };

  const pdfBuffer = await buildWardrobePdf([{
    id: "top-1",
    name: "Top",
    category: "top",
    imageUrl: "https://example.com/top-1.jpg",
    brand: "Brand",
    description: "Description"
  }], {
    locale: "ru",
    imageAssetsById
  });

  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.equal(Object.keys(imageAssetsById).length, 0);
});

test("buildWardrobePdf uses local cached image before remote fetch", async (t) => {
  const imageUrl = "https://static.zara.net/image.jpg?ts=1773310573314&w={width}";
  const cachedJpeg = await sharp({
    create: {
      width: 1000,
      height: 700,
      channels: 3,
      background: "#0f766e"
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

  const pdfBuffer = await buildWardrobePdf([{
    id: "top-1",
    name: "Top",
    category: "top",
    imageUrl,
    brand: "Brand",
    description: "Description"
  }], {
    locale: "en"
  });

  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.ok(pdfBuffer.length > 0);
});
