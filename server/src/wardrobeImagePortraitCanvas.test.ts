import { expect, test } from "vitest";
import sharp from "sharp";
import {
  WARDROBE_PORTRAIT_CANVAS_HEIGHT,
  WARDROBE_PORTRAIT_CANVAS_WIDTH,
  ensureWardrobeImagePortraitCanvas,
} from "./wardrobeImagePortraitCanvas.js";

async function buildPngBuffer(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 160, g: 110, b: 80, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

test("wardrobe portrait canvas pads horizontal images to 3:4 without cropping", async () => {
  const result = await ensureWardrobeImagePortraitCanvas({
    imageBuffer: await buildPngBuffer(900, 500),
    mimeType: "image/png",
  });
  const metadata = await sharp(result.buffer).metadata();

  expect(result.changed).toBe(true);
  expect(result.mimeType).toBe("image/png");
  expect(metadata.width).toBe(WARDROBE_PORTRAIT_CANVAS_WIDTH);
  expect(metadata.height).toBe(WARDROBE_PORTRAIT_CANVAS_HEIGHT);
});

test("wardrobe portrait canvas leaves existing 3:4 images unchanged", async () => {
  const source = await buildPngBuffer(900, 1200);
  const result = await ensureWardrobeImagePortraitCanvas({
    imageBuffer: source,
    mimeType: "image/png",
  });
  const metadata = await sharp(result.buffer).metadata();

  expect(result.changed).toBe(false);
  expect(result.buffer.equals(source)).toBe(true);
  expect(metadata.width).toBe(900);
  expect(metadata.height).toBe(1200);
});
