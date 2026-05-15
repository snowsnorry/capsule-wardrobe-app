import { expect, test, vi } from "vitest";
import sharp from "sharp";
import {
  THUMBNAIL_WIDTHS,
  buildSingleItemImageCleanupPrompt,
  buildWardrobeImageThumbnailBuffers,
  cleanupUploadedWardrobeItemImage,
} from "./wardrobeImageCleanup.js";

async function buildPngBuffer() {
  return sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 4,
      background: { r: 220, g: 230, b: 240, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

test("single item cleanup prompt is loaded from the template", () => {
  expect(buildSingleItemImageCleanupPrompt()).toContain(
    "Edit the provided reference image",
  );
  expect(buildSingleItemImageCleanupPrompt()).toContain("EXACTLY ONE ITEM");
});

test("wardrobe image cleanup uses selected provider, uploads clean image, and writes colocated thumbnails", async () => {
  const generatedBuffer = await buildPngBuffer();
  const uploadedKeys: string[] = [];
  const generateImageWithGeminiImpl = vi.fn(async () => ({
    response: {},
    image: {
      base64: generatedBuffer.toString("base64"),
      mimeType: "image/png",
    },
  }));
  const generateImageWithOpenAiImpl = vi.fn();
  const uploadWardrobeDerivativeImageToR2Impl = vi.fn(
    async ({ buffer, key, mimeType }) => {
      uploadedKeys.push(key);
      return {
        key,
        url: `https://images.example.com/${key}`,
        digest: `${mimeType}:${Buffer.from(buffer).length}`,
      };
    },
  );

  const result = await cleanupUploadedWardrobeItemImage({
    email: "person@example.com",
    imageUrl: "https://images.example.com/wardrobe/profile/item.webp",
    sourceBuffer: Buffer.from("original-webp"),
    sourceFilename: "item.webp",
    sourceKey: "wardrobe/profile/item.webp",
    sourceMimeType: "image/webp",
    getProfileImpl: async () => ({
      activeCapsuleId: "capsule-1",
      email: "person@example.com",
      fullname: "",
      llm: "openai:gpt-5.5",
      locale: "en",
      theme: "system",
      imageLlm: "gemini:gemini-3-pro-image-preview",
    }),
    generateImageWithGeminiImpl,
    generateImageWithOpenAiImpl,
    uploadWardrobeDerivativeImageToR2Impl,
  });

  expect(generateImageWithGeminiImpl).toHaveBeenCalledWith(
    expect.stringContaining("EXACTLY ONE ITEM"),
    expect.objectContaining({
      model: "gemini-3-pro-image-preview",
      images: [
        expect.objectContaining({
          filename: "item.webp",
          imageUrl: "https://images.example.com/wardrobe/profile/item.webp",
          mimeType: "image/webp",
        }),
      ],
    }),
  );
  expect(generateImageWithOpenAiImpl).not.toHaveBeenCalled();
  expect(uploadedKeys).toEqual([
    "wardrobe/profile/item_clean.png",
    "wardrobe/profile/item_clean_320.webp",
    "wardrobe/profile/item_clean_480.webp",
    "wardrobe/profile/item_clean_640.webp",
  ]);
  expect(result.cleanImage.url).toBe(
    "https://images.example.com/wardrobe/profile/item_clean.png",
  );
  expect(result.thumbnails.map((thumbnail) => thumbnail.width)).toEqual([
    320, 480, 640,
  ]);
});

test("wardrobe thumbnail buffers are generated as bounded WebP images", async () => {
  const thumbnails = await buildWardrobeImageThumbnailBuffers(
    await buildPngBuffer(),
  );

  expect(thumbnails.map((thumbnail) => thumbnail.width)).toEqual([
    ...THUMBNAIL_WIDTHS,
  ]);
  for (const thumbnail of thumbnails) {
    const metadata = await sharp(thumbnail.buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(thumbnail.width);
  }
});
