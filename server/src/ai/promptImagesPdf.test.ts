import { test, expect } from "vitest";
import sharp from "sharp";
import {
  preparePdfImageAsset,
  preparePdfImageAssets,
} from "./promptImagesPdf.js";
import type { PromptImageAsset } from "./types.js";

test("preparePdfImageAssets resizes normalized images for pdf", async () => {
  const source = await sharp({
    create: {
      width: 2400,
      height: 1600,
      channels: 3,
      background: "#336699",
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  const prepared = await preparePdfImageAssets(
    {
      "top-1": {
        buffer: source,
        mimeType: "image/jpeg",
        imageUrl: "https://example.com/top-1.jpg",
      },
    },
    {
      width: 600,
      height: 400,
    },
  );

  expect(prepared["top-1"]).toBeTruthy();
  expect(prepared["top-1"].preparedForPdf).toBe(true);
  expect(prepared["top-1"].kind).toBe("jpg");
  const metadata = await sharp(prepared["top-1"].buffer).metadata();
  expect(metadata.format).toBe("jpeg");
  expect((metadata.width || 0) <= 600).toBeTruthy();
  expect((metadata.height || 0) <= 400).toBeTruthy();
});

test("preparePdfImageAsset skips missing buffers and clamps target dimensions", async () => {
  expect(await preparePdfImageAsset(null)).toBe(null);
  expect(
    await preparePdfImageAsset({
      imageUrl: "missing",
      mimeType: "image/png",
    } as PromptImageAsset),
  ).toBe(null);

  const source = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: "#ffffff",
    },
  })
    .png()
    .toBuffer();
  const prepared = await preparePdfImageAsset(
    { buffer: source, imageUrl: "", mimeType: "image/png" },
    {
      width: 0,
      height: Number.NaN,
    },
  );

  expect(prepared?.mimeType).toBe("image/jpeg");
  expect(prepared?.width).toBe(1);
  expect(prepared?.height).toBe(1);
});

test("preparePdfImageAssets filters assets without buffers", async () => {
  const prepared = await preparePdfImageAssets({
    empty: { imageUrl: "empty", mimeType: "image/jpeg" } as PromptImageAsset,
  });

  expect(prepared).toEqual({});
});
