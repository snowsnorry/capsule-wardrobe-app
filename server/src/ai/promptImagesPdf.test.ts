import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { preparePdfImageAssets } from "./promptImagesPdf.js";

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
