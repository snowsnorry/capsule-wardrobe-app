import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { preparePdfImageAsset, preparePdfImageAssets } from "./promptImagesPdf.js";
import type { PromptImageAsset } from "./types.js";

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
  assert.ok((metadata.width || 0) <= 600);
  assert.ok((metadata.height || 0) <= 400);
});

test("preparePdfImageAsset skips missing buffers and clamps target dimensions", async () => {
  assert.equal(await preparePdfImageAsset(null), null);
  assert.equal(await preparePdfImageAsset({ imageUrl: "missing", mimeType: "image/png" } as PromptImageAsset), null);

  const source = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: "#ffffff"
    }
  }).png().toBuffer();
  const prepared = await preparePdfImageAsset({ buffer: source, imageUrl: "", mimeType: "image/png" }, {
    width: 0,
    height: Number.NaN
  });

  assert.equal(prepared?.mimeType, "image/jpeg");
  assert.equal(prepared?.width, 1);
  assert.equal(prepared?.height, 1);
});

test("preparePdfImageAssets filters assets without buffers", async () => {
  const prepared = await preparePdfImageAssets({
    empty: { imageUrl: "empty", mimeType: "image/jpeg" } as PromptImageAsset
  });

  assert.deepEqual(prepared, {});
});
