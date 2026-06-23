import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { expect, test, vi } from "vitest";

vi.mock("./wardrobeImageCleanup.js", () => ({
  cleanupUploadedWardrobeItemImage: vi.fn(),
  uploadWardrobeImageThumbnails: vi.fn(),
}));

import {
  cleanupUploadedWardrobeItemImage,
  uploadWardrobeImageThumbnails,
} from "./wardrobeImageCleanup.js";
import {
  buildCleanupProfile,
  buildDirectImageCleanup,
  buildFileCleanup,
  buildPortraitImageBuffer,
  normalizeCleanupResult,
  normalizeImageBuffer,
  normalizeUploadFile,
} from "./wardrobeUploadProcessingImages.js";

async function buildPngBuffer(width = 16, height = 12) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 180, g: 190, b: 200, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

test("wardrobe upload processing images normalize image buffers to bounded WebP", async () => {
  const result = await normalizeImageBuffer({
    buffer: await buildPngBuffer(),
    originalName: "item.png",
  });
  const metadata = await sharp(result.buffer).metadata();

  expect(result).toMatchObject({
    height: metadata.height,
    mimeType: "image/webp",
    originalName: "item.png",
    size: result.buffer.length,
    width: metadata.width,
  });
  expect(metadata.format).toBe("webp");
});

test("wardrobe upload processing images normalize files after MIME detection", async () => {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "wardrobe-upload-images-test-"),
  );
  const imagePath = path.join(tempDir, "item.png");
  const textPath = path.join(tempDir, "item.txt");
  await writeFile(imagePath, await buildPngBuffer());
  await writeFile(textPath, "not an image");

  await expect(
    normalizeUploadFile({
      filePath: imagePath,
      inputIndex: 0,
      kind: "file",
      mimeType: "image/png",
      originalName: "",
    }),
  ).resolves.toMatchObject({
    mimeType: "image/webp",
    originalName: "wardrobe-image",
  });
  await expect(
    normalizeUploadFile({
      filePath: textPath,
      inputIndex: 1,
      kind: "file",
      mimeType: "text/plain",
      originalName: "item.txt",
    }),
  ).rejects.toThrow("invalid_image");
});

test("wardrobe upload processing images normalize cleanup metadata", () => {
  expect(buildCleanupProfile("openai:gpt-image-2")).toEqual({
    imageLlm: "openai:gpt-image-2",
  });
  expect(
    normalizeCleanupResult({
      cleanImage: {
        digest: "digest",
        key: "wardrobe/profile/item_clean.png",
        url: "https://images.example.com/wardrobe/profile/item_clean.png",
      },
      thumbnails: [
        {
          digest: "thumb",
          key: "wardrobe/profile/item_clean_320.webp",
          url: "https://images.example.com/wardrobe/profile/item_clean_320.webp",
          width: "320" as unknown as 320,
        },
      ],
    }),
  ).toEqual({
    cleanImage: {
      digest: "digest",
      key: "wardrobe/profile/item_clean.png",
      url: "https://images.example.com/wardrobe/profile/item_clean.png",
    },
    thumbnails: [
      {
        digest: "thumb",
        key: "wardrobe/profile/item_clean_320.webp",
        url: "https://images.example.com/wardrobe/profile/item_clean_320.webp",
        width: 320,
      },
    ],
  });
});

test("wardrobe upload processing images build file cleanup through the cleanup service", async () => {
  vi.mocked(cleanupUploadedWardrobeItemImage).mockImplementationOnce(
    async ({ getProfileImpl, sourceBuffer }) => {
      await expect(getProfileImpl("person@example.com")).resolves.toEqual({
        imageLlm: "gemini:gemini-3-pro-image",
      });
      expect(Buffer.from(sourceBuffer)).toEqual(Buffer.from("webp"));
      return {
        cleanImage: {
          digest: "clean-digest",
          key: "wardrobe/profile/item_clean.png",
          url: "https://images.example.com/wardrobe/profile/item_clean.png",
        },
        thumbnails: [
          {
            digest: "thumb-digest",
            key: "wardrobe/profile/item_clean_480.webp",
            url: "https://images.example.com/wardrobe/profile/item_clean_480.webp",
            width: 480,
          },
        ],
      };
    },
  );

  const result = await buildFileCleanup({
    email: "person@example.com",
    imageLlm: "gemini:gemini-3-pro-image",
    normalizedImage: {
      buffer: Buffer.from("webp"),
      height: 1200,
      mimeType: "image/webp",
      originalName: "item.webp",
      size: 4,
      width: 900,
    },
    source: {
      imageUrl: "https://images.example.com/wardrobe/profile/item.webp",
      kind: "file",
      productPageUrl: "https://images.example.com/wardrobe/profile/item.webp",
      rawImageUrl: "https://images.example.com/wardrobe/profile/item.webp",
      sourceImageKey: "wardrobe/profile/item.webp",
      sourceImageUrl: "https://images.example.com/wardrobe/profile/item.webp",
    },
  });

  expect(result.thumbnails).toEqual([expect.objectContaining({ width: 480 })]);
});

test("wardrobe upload processing images build direct image cleanup from uploaded thumbnails", async () => {
  vi.mocked(uploadWardrobeImageThumbnails).mockResolvedValueOnce({
    thumbnails: [
      {
        digest: "thumb-digest",
        key: "wardrobe/profile/item_640.webp",
        url: "https://images.example.com/wardrobe/profile/item_640.webp",
        width: 640,
      },
    ],
  });

  const result = await buildDirectImageCleanup({
    imageBuffer: Buffer.from("portrait"),
    source: {
      imageUrl: "https://images.example.com/wardrobe/profile/item.webp",
      kind: "direct-image",
      productPageUrl: "https://shop.example.com/item.png",
      rawImageUrl: "https://images.example.com/wardrobe/profile/item.webp",
      sourceImageKey: null,
      sourceImageUrl: null,
    },
  });

  expect(uploadWardrobeImageThumbnails).toHaveBeenCalledWith({
    imageBuffer: Buffer.from("portrait"),
    sourceKey: null,
    sourceUrl: null,
  });
  expect(result).toEqual({
    cleanImage: {
      digest: "",
      key: "",
      url: "https://images.example.com/wardrobe/profile/item.webp",
    },
    thumbnails: [
      expect.objectContaining({
        key: "wardrobe/profile/item_640.webp",
        width: 640,
      }),
    ],
  });
});

test("wardrobe upload processing images build portrait buffers for direct images", async () => {
  const result = await buildPortraitImageBuffer({
    buffer: await buildPngBuffer(20, 8),
    originalName: "",
  });
  const metadata = await sharp(result.buffer).metadata();

  expect(result.changed).toBe(true);
  expect(result.mimeType).toBe("image/webp");
  expect(metadata.width).toBe(1200);
  expect(metadata.height).toBe(1600);
});
