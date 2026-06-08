import { describe, expect, test } from "vitest";
import {
  parseAnchorPublicIds,
  validateCapsuleAnchorItems,
} from "./capsuleAnchors.js";

describe("capsuleAnchors", () => {
  test("parses public wardrobe anchor ids", () => {
    expect(parseAnchorPublicIds([" w12 ", "W12", "w18"])).toEqual({
      publicIds: ["W12", "W18"],
      numericIds: [12, 18],
    });
  });

  test("rejects malformed and excessive public wardrobe anchor ids", () => {
    expect(() => parseAnchorPublicIds(["12"])).toThrow("invalid_payload");
    expect(() =>
      parseAnchorPublicIds(["W1", "W2", "W3", "W4", "W5", "W6"]),
    ).toThrow("invalid_payload");
  });

  test("validates ownership, readiness, and category before generation", async () => {
    const result = await validateCapsuleAnchorItems({
      email: "person@example.com",
      anchorWardrobeItemIds: ["W12"],
      deps: {
        listWardrobeItemsByIdsImpl: async () => [
          {
            id: 12,
            name: "White shirt",
            category: "top",
            processingStatus: "ready",
          },
        ],
      },
    });

    expect(result.anchorWardrobeItemIds).toEqual(["W12"]);
    expect(result.anchorWardrobeNumericIds).toEqual([12]);
    expect(result.anchorItemRefs).toEqual([
      { source: "uploaded", url: "wardrobe://12" },
    ]);
    expect(result.anchorItems[0]).toMatchObject({
      id: "W12",
      item_source: "wardrobe",
      selection_role: "anchor",
      wardrobe_id: "12",
    });
  });

  test("validates mixed uploaded and catalog anchor refs", async () => {
    const result = await validateCapsuleAnchorItems({
      email: "person@example.com",
      anchorWardrobeItemIds: [],
      anchorItemRefs: [
        { source: "from_catalog", url: "https://example.com/catalog-coat" },
        { source: "uploaded", url: "wardrobe://12" },
      ],
      deps: {
        listWardrobeItemsByIdsImpl: async () => [
          {
            id: 12,
            name: "White shirt",
            category: "top",
            processingStatus: "ready",
          },
        ],
        getProductsByUrlsForEmailImpl: async () => [
          {
            id: "p1",
            name: "Catalog coat",
            url: "https://example.com/catalog-coat",
            category: "outerwear",
          },
        ],
      },
    });

    expect(result.anchorWardrobeItemIds).toEqual(["W12"]);
    expect(result.anchorWardrobeNumericIds).toEqual([12]);
    expect(result.anchorCatalogUrls).toEqual([
      "https://example.com/catalog-coat",
    ]);
    expect(result.anchorItemRefs).toEqual([
      { source: "from_catalog", url: "https://example.com/catalog-coat" },
      { source: "uploaded", url: "wardrobe://12" },
    ]);
    expect(result.anchorItems).toEqual([
      expect.objectContaining({ id: "p1", item_source: "catalog" }),
      expect.objectContaining({ id: "W12", item_source: "wardrobe" }),
    ]);
  });

  test("uses canonical ref order and appends only missing legacy refs", async () => {
    const result = await validateCapsuleAnchorItems({
      email: "person@example.com",
      anchorWardrobeItemIds: ["W12", "W18"],
      anchorItemRefs: [
        { source: "from_catalog", url: "https://example.com/catalog-coat" },
        { source: "uploaded", url: "wardrobe://12" },
      ],
      deps: {
        listWardrobeItemsByIdsImpl: async () => [
          {
            id: 12,
            name: "White shirt",
            category: "top",
            processingStatus: "ready",
          },
          {
            id: 18,
            name: "Blue jeans",
            category: "bottom",
            processingStatus: "ready",
          },
        ],
        getProductsByUrlsForEmailImpl: async () => [
          {
            id: "p1",
            name: "Catalog coat",
            url: "https://example.com/catalog-coat",
            category: "outerwear",
          },
        ],
      },
    });

    expect(result.anchorItemRefs).toEqual([
      { source: "from_catalog", url: "https://example.com/catalog-coat" },
      { source: "uploaded", url: "wardrobe://12" },
      { source: "uploaded", url: "wardrobe://18" },
    ]);
    expect(result.anchorItems).toEqual([
      expect.objectContaining({ id: "p1", item_source: "catalog" }),
      expect.objectContaining({ id: "W12", item_source: "wardrobe" }),
      expect.objectContaining({ id: "W18", item_source: "wardrobe" }),
    ]);
  });

  test("rejects missing, not-ready, or category-less anchors", async () => {
    await expect(() =>
      validateCapsuleAnchorItems({
        email: "person@example.com",
        anchorWardrobeItemIds: ["W12"],
        deps: { listWardrobeItemsByIdsImpl: async () => [] },
      }),
    ).rejects.toThrow("invalid_payload");

    await expect(() =>
      validateCapsuleAnchorItems({
        email: "person@example.com",
        anchorWardrobeItemIds: ["W12"],
        deps: {
          listWardrobeItemsByIdsImpl: async () => [
            { id: 12, category: "", processingStatus: "ready" },
          ],
        },
      }),
    ).rejects.toThrow("invalid_payload");

    await expect(() =>
      validateCapsuleAnchorItems({
        email: "person@example.com",
        anchorWardrobeItemIds: [],
        anchorItemRefs: [{ source: "uploaded", url: "https://example.com/1" }],
        deps: { listWardrobeItemsByIdsImpl: async () => [] },
      }),
    ).rejects.toThrow("invalid_payload");

    await expect(() =>
      validateCapsuleAnchorItems({
        email: "person@example.com",
        anchorWardrobeItemIds: [],
        anchorItemRefs: [
          { source: "from_catalog", url: "https://example.com/missing" },
        ],
        deps: {
          listWardrobeItemsByIdsImpl: async () => [],
          getProductsByUrlsForEmailImpl: async () => [],
        },
      }),
    ).rejects.toThrow("invalid_payload");
  });
});
