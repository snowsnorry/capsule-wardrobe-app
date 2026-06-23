import { expect, test, vi } from "vitest";

vi.mock("./wardrobeImageAnalysis.js", () => ({
  analyzeWardrobeImageUrl: vi.fn(),
}));
vi.mock("./r2Storage.js", () => ({
  uploadWardrobeImageToR2: vi.fn(),
}));
vi.mock("./wardrobeUploadProcessingImages.js", () => ({
  buildDirectImageCleanup: vi.fn(),
  buildPortraitImageBuffer: vi.fn(),
}));

import { uploadWardrobeImageToR2 } from "./r2Storage.js";
import { analyzeWardrobeImageUrl } from "./wardrobeImageAnalysis.js";
import type { WardrobeImageAnalysisResult } from "./wardrobeImageAnalysis.js";
import {
  buildDirectImageCleanup,
  buildPortraitImageBuffer,
} from "./wardrobeUploadProcessingImages.js";
import { processUrlUploadItem } from "./wardrobeUploadProcessingUrlItem.js";

test("URL upload processing handles the direct-image processing path", async () => {
  const sendImpl = vi.fn();
  vi.mocked(buildPortraitImageBuffer).mockResolvedValueOnce({
    buffer: Buffer.from("portrait"),
    changed: true,
    mimeType: "image/webp",
  });
  vi.mocked(uploadWardrobeImageToR2).mockResolvedValueOnce({
    digest: "uploaded-digest",
    key: "wardrobe/profile/item.webp",
    url: "https://images.example.com/wardrobe/profile/item.webp",
  });
  vi.mocked(analyzeWardrobeImageUrl).mockResolvedValueOnce({
    hasMetadata: true,
    metadata: {
      audience: "women",
      brand: null,
      category: "tops",
      closure_type: [],
      color_base: ["blue"],
      composition: null,
      description: "Blue top",
      finish: null,
      fit: null,
      formality_level: ["casual"],
      is_neutral: false,
      name: "Blue top",
      occasions: ["daily"],
      pattern: null,
      season: ["summer"],
      silhouette: null,
      style: ["minimal"],
    },
    rawResponse: '{"name":"Blue top"}',
  } satisfies WardrobeImageAnalysisResult);
  vi.mocked(buildDirectImageCleanup).mockResolvedValueOnce({
    cleanImage: {
      digest: "placeholder",
      key: "placeholder",
      url: "https://images.example.com/placeholder.webp",
    },
    thumbnails: [],
  });

  const result = await processUrlUploadItem({
    downloadImageImpl: vi.fn(async () => ({
      buffer: Buffer.from("source"),
      imageUrl: "https://cdn.example.com/item.png",
      mimeType: "image/png",
      originalName: "item.png",
    })),
    email: "person@example.com",
    input: {
      inputIndex: 2,
      kind: "url",
      url: "https://cdn.example.com/item.png",
    },
    sendImpl,
  });

  expect(buildPortraitImageBuffer).toHaveBeenCalledWith({
    buffer: Buffer.from("source"),
    imageUrl: "https://cdn.example.com/item.png",
    mimeType: "image/png",
    originalName: "item.png",
  });
  expect(uploadWardrobeImageToR2).toHaveBeenCalledWith({
    buffer: Buffer.from("portrait"),
    email: "person@example.com",
  });
  expect(analyzeWardrobeImageUrl).toHaveBeenCalledWith({
    imageUrl: "https://images.example.com/wardrobe/profile/item.webp",
  });
  expect(buildDirectImageCleanup).toHaveBeenCalledWith({
    imageBuffer: Buffer.from("portrait"),
    source: expect.objectContaining({
      kind: "direct-image",
      productPageUrl: "https://cdn.example.com/item.png",
      sourceImageKey: "wardrobe/profile/item.webp",
    }),
  });
  expect(result).toEqual(
    expect.objectContaining({
      cleanup: {
        cleanImage: {
          digest: "uploaded-digest",
          key: "wardrobe/profile/item.webp",
          url: "https://images.example.com/wardrobe/profile/item.webp",
        },
        thumbnails: [],
      },
      inputIndex: 2,
      ok: true,
      source: expect.objectContaining({ kind: "direct-image" }),
    }),
  );
  expect(sendImpl.mock.calls.map(([event]) => event)).toEqual([
    expect.objectContaining({ event: "item-started", kind: "url" }),
    expect.objectContaining({ event: "source-uploaded", kind: "direct-image" }),
    expect.objectContaining({ event: "metadata-ready", kind: "direct-image" }),
    expect.objectContaining({ event: "image-cleaned", kind: "direct-image" }),
    expect.objectContaining({ event: "item-complete", kind: "direct-image" }),
  ]);
});

test("URL upload processing reports direct-image failures with partial source context", async () => {
  const sendImpl = vi.fn();
  vi.mocked(buildPortraitImageBuffer).mockResolvedValueOnce({
    buffer: Buffer.from("portrait"),
    changed: false,
    mimeType: "image/webp",
  });
  vi.mocked(uploadWardrobeImageToR2).mockResolvedValueOnce({
    digest: "uploaded-digest",
    key: "wardrobe/profile/item.webp",
    url: "https://images.example.com/wardrobe/profile/item.webp",
  });
  vi.mocked(analyzeWardrobeImageUrl).mockRejectedValueOnce(
    new Error("analysis_failed"),
  );

  const result = await processUrlUploadItem({
    downloadImageImpl: vi.fn(async () => ({
      buffer: Buffer.from("source"),
      imageUrl: "https://cdn.example.com/item.png",
      mimeType: "image/png",
      originalName: "item.png",
    })),
    email: "person@example.com",
    input: {
      inputIndex: 3,
      kind: "url",
      url: "https://cdn.example.com/item.png",
    },
    sendImpl,
  });

  expect(result).toEqual(
    expect.objectContaining({
      cleanup: null,
      inputIndex: 3,
      message: "analysis_failed",
      ok: false,
      source: expect.objectContaining({
        imageUrl: "https://images.example.com/wardrobe/profile/item.webp",
        kind: "direct-image",
      }),
    }),
  );
  expect(sendImpl).toHaveBeenLastCalledWith(
    expect.objectContaining({
      event: "item-failed",
      kind: "direct-image",
      message: "analysis_failed",
      source: expect.objectContaining({ kind: "direct-image" }),
    }),
  );
});
