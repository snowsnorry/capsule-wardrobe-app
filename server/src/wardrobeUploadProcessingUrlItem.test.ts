import { expect, test, vi } from "vitest";
import { processUrlUploadItem } from "./wardrobeUploadProcessingUrlItem.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atcw3kAAAAASUVORK5CYII=",
  "base64",
);

test("URL upload processing treats submitted URLs as direct images", async () => {
  const sendImpl = vi.fn();
  const downloadImageImpl = vi.fn(async () => ({
    buffer: tinyPng,
    imageUrl: "https://cdn.example.com/product.png",
    mimeType: "image/png",
    originalName: "product.png",
  }));
  const processDirectImageUrlItemImpl = vi.fn(async () => ({
    analysis: null,
    cleanup: null,
    inputIndex: 0,
    ok: true,
    source: {
      imageUrl: "https://images.example.com/wardrobe/profile/product.webp",
      kind: "direct-image" as const,
      productPageUrl: "https://cdn.example.com/product.png",
      rawImageUrl: "https://images.example.com/wardrobe/profile/product.webp",
      sourceImageKey: "wardrobe/profile/product.webp",
      sourceImageUrl:
        "https://images.example.com/wardrobe/profile/product.webp",
    },
  }));

  const result = await processUrlUploadItem({
    downloadImageImpl,
    email: "person@example.com",
    input: {
      inputIndex: 0,
      kind: "url",
      url: "https://cdn.example.com/product.png",
    },
    processDirectImageUrlItemImpl,
    sendImpl,
  });

  expect(downloadImageImpl).toHaveBeenCalledWith({
    imageUrl: "https://cdn.example.com/product.png",
  });
  expect(processDirectImageUrlItemImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    image: {
      buffer: tinyPng,
      imageUrl: "https://cdn.example.com/product.png",
      mimeType: "image/png",
      originalName: "product.png",
    },
    inputIndex: 0,
    sendImpl,
  });
  expect(result.source).toEqual(
    expect.objectContaining({
      kind: "direct-image",
      productPageUrl: "https://cdn.example.com/product.png",
    }),
  );
  expect(sendImpl).toHaveBeenCalledWith(
    expect.objectContaining({
      event: "item-started",
      kind: "url",
    }),
  );
  expect(result.source).toEqual(
    expect.objectContaining({ kind: "direct-image" }),
  );
});

test("URL upload processing rejects non-image URLs before saving sources", async () => {
  const sendImpl = vi.fn();

  const result = await processUrlUploadItem({
    downloadImageImpl: vi.fn(async () => {
      throw new Error("image_url_invalid");
    }),
    email: "person@example.com",
    input: {
      inputIndex: 0,
      kind: "url",
      url: "https://shop.example.com/not-an-image",
    },
    sendImpl,
  });

  expect(result).toEqual(
    expect.objectContaining({
      inputIndex: 0,
      message: "image_url_invalid",
      ok: false,
      source: null,
    }),
  );
  expect(sendImpl).not.toHaveBeenCalledWith(
    expect.objectContaining({ event: "source-uploaded" }),
  );
});
