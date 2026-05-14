import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "vitest";
import sharp from "sharp";
import {
  createWardrobeUploadImagesChildRuntime,
  normalizeWardrobeUploadImages,
} from "./wardrobeUploadImages.child.ts";

async function createPngBuffer() {
  return sharp({
    create: {
      width: 2400,
      height: 1800,
      channels: 3,
      background: "#f7f5f1",
    },
  })
    .png()
    .toBuffer();
}

test("wardrobe upload child normalizes uploads to bounded WebP files", async () => {
  const outputDir = await mkdtemp(
    path.join(os.tmpdir(), "wardrobe-upload-child-test-"),
  );

  try {
    const images = await normalizeWardrobeUploadImages({
      outputDir,
      images: [
        {
          buffer: await createPngBuffer(),
          mimeType: "image/png",
          originalName: "shirt.png",
        },
      ],
    });
    const metadata = await sharp(images[0].filePath).metadata();

    expect(images).toEqual([
      expect.objectContaining({
        mimeType: "image/webp",
        originalName: "shirt.png",
        width: 1600,
        height: 1200,
      }),
    ]);
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(1200);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("wardrobe upload child runtime sends failures and ignores duplicate messages", async () => {
  const sent: unknown[] = [];
  const exits: number[] = [];
  const runtime = createWardrobeUploadImagesChildRuntime({
    normalizeWardrobeUploadImagesImpl: async () => {
      throw new Error("normalize_failed");
    },
    sendImpl: (message, callback) => {
      sent.push(message);
      callback?.();
    },
    disconnectImpl: () => {},
    exitImpl: (code) => {
      exits.push(code);
    },
  });

  await runtime.handleMessage({
    outputDir: "/tmp/wardrobe-upload",
    images: [],
  });
  await runtime.handleMessage({
    outputDir: "/tmp/wardrobe-upload",
    images: [],
  });

  expect(sent).toEqual([
    expect.objectContaining({
      ok: false,
      message: "wardrobe_upload_images_missing",
    }),
  ]);
  expect(exits).toEqual([1]);
});
