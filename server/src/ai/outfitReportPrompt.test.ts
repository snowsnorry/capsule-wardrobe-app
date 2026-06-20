import { describe, expect, test, vi } from "vitest";
import {
  buildOutfitReportCollage,
  getCurrentOutfitCollageImage,
  renderOutfitReportPrompt,
} from "./outfitReportPrompt.js";
import { createOutfitReportServiceDeps } from "./outfitReportServiceDeps.js";
import { buildPromptImageThumbnailUrl } from "./promptImageThumbnails.js";

function createDeps(overrides = {}) {
  return createOutfitReportServiceDeps({
    buildPromptDebugImagesForCategoryImpl: vi.fn(async () => ({
      category: {
        buffer: Buffer.from("collage"),
        cachedCount: 0,
        downloadedCount: 1,
        mimeType: "image/jpeg",
      },
    })),
    runWithImageWorkSlotImpl: vi.fn(async (_label, work) => work()),
    ...overrides,
  });
}

describe("outfitReportPrompt", () => {
  test("renders report prompt items", () => {
    expect(
      renderOutfitReportPrompt([
        {
          id: "item-1",
          itemSource: "from_catalog",
          name: "White shirt",
          category: "top",
          brand: null,
          audience: null,
          season: [],
          formalityLevel: [],
          style: [],
          occasions: [],
          colorBase: [],
          pattern: null,
          finish: null,
          composition: null,
          silhouette: null,
          fit: null,
          closureType: [],
        },
      ]),
    ).toContain('"id": "item-1"');
  });

  test("normalizes Uint8Array collage buffers and rejects empty buffers", () => {
    expect(
      getCurrentOutfitCollageImage({
        buffer: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      }),
    ).toMatchObject({
      buffer: Buffer.from([1, 2, 3]),
      filename: "current-outfit.jpg",
      mimeType: "image/png",
    });
    expect(
      getCurrentOutfitCollageImage({
        buffer: Buffer.alloc(0),
      }),
    ).toBeNull();
  });

  test("builds collage only from items with usable image urls", async () => {
    const deps = createDeps();

    await expect(
      buildOutfitReportCollage({
        deps,
        items: [
          { id: "missing-image", category: "top" },
          {
            id: "item-1",
            category: "bottom",
            imageUrl: " https://images.example.com/item.jpg ",
          },
        ],
      }),
    ).resolves.toMatchObject({
      buffer: Buffer.from("collage"),
      category: "Current Outfit",
    });
    expect(deps.buildPromptDebugImagesForCategoryImpl).toHaveBeenCalledWith({
      category: "Current Outfit",
      compactRows: true,
      items: [
        {
          id: "item-1",
          category: "bottom",
          imageUrl: "https://images.example.com/item.jpg",
          source: null,
          thumbnailUrl: buildPromptImageThumbnailUrl(
            "https://images.example.com/item.jpg",
            null,
          ),
        },
      ],
    });
  });

  test("rejects missing collage inputs and unloaded collage results", async () => {
    await expect(
      buildOutfitReportCollage({
        deps: createDeps(),
        items: [{ id: "item-1", category: "top", imageUrl: "" }],
      }),
    ).rejects.toMatchObject({ code: "service_unavailable" });

    await expect(
      buildOutfitReportCollage({
        deps: createDeps({
          buildPromptDebugImagesForCategoryImpl: vi.fn(async () => ({
            category: {
              buffer: Buffer.from("collage"),
              cachedCount: 0,
              downloadedCount: 0,
            },
          })),
        }),
        items: [
          {
            id: "item-1",
            category: "top",
            imageUrl: "https://images.example.com/item.jpg",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "service_unavailable" });

    await expect(
      buildOutfitReportCollage({
        deps: createDeps({
          buildPromptDebugImagesForCategoryImpl: vi.fn(async () => ({
            category: {
              buffer: Buffer.alloc(0),
              cachedCount: 0,
              downloadedCount: 1,
            },
          })),
        }),
        items: [
          {
            id: "item-1",
            category: "top",
            imageUrl: "https://images.example.com/item.jpg",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "service_unavailable" });
  });
});
