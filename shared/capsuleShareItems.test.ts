import { describe, expect, test } from "vitest";
import {
  hasUploadedPersonalWardrobeItems,
  isCatalogWardrobeItem,
  isUploadedPersonalWardrobeItem,
  normalizeCapsuleItemForShare,
  normalizeCapsuleSnapshotItemsForShare,
} from "./capsuleShareItems.js";

describe("capsuleShareItems", () => {
  test("classifies uploaded personal and catalog wardrobe items", () => {
    expect(isUploadedPersonalWardrobeItem({ source: "uploaded" })).toBe(true);
    expect(
      isUploadedPersonalWardrobeItem({ url: "wardrobe://uploaded-1" }),
    ).toBe(true);
    expect(
      isCatalogWardrobeItem({
        source: "from_catalog",
        url: "https://example.com/catalog",
      }),
    ).toBe(true);
    expect(
      isCatalogWardrobeItem({
        itemSource: "wardrobe",
        url: "https://example.com/catalog",
      }),
    ).toBe(true);
    expect(
      isCatalogWardrobeItem({
        id: "catalog-1",
        url: "https://example.com/catalog",
      }),
    ).toBe(false);
  });

  test("detects uploaded personal items in capsule snapshots", () => {
    expect(
      hasUploadedPersonalWardrobeItems({
        data: {
          wardrobe: {
            items: [{ id: "uploaded-1", url: "wardrobe://uploaded-1" }],
          },
        },
      }),
    ).toBe(true);
    expect(
      hasUploadedPersonalWardrobeItems({
        data: {
          wardrobe: {
            items: [{ id: "catalog-1", url: "https://example.com/catalog" }],
          },
        },
      }),
    ).toBe(false);
  });

  test("normalizes capsule items to minimal share JSON", () => {
    expect(
      normalizeCapsuleItemForShare({
        id: "W7",
        productId: "catalog-7",
        source: "from_catalog",
        url: "https://example.com/catalog-7",
        name: "Catalog shirt",
        audience: "woman",
        category: "top",
        imageUrl: "https://example.com/catalog-7.jpg",
        brand: "Ignored",
      }),
    ).toEqual({
      id: "catalog-7",
      url: "https://example.com/catalog-7",
      name: "Catalog shirt",
      audience: "woman",
      category: "top",
      imageUrl: "https://example.com/catalog-7.jpg",
    });
  });

  test("normalizes snapshot items and remaps outfit set item ids", () => {
    expect(
      normalizeCapsuleSnapshotItemsForShare({
        filters: {},
        data: {
          wardrobe: {
            items: [
              {
                id: "W7",
                wardrobeId: "7",
                productId: "catalog-7",
                source: "from_catalog",
                url: "https://example.com/catalog-7",
                name: "Catalog shirt",
                audience: "woman",
                category: "top",
                imageUrl: "https://example.com/catalog-7.jpg",
              },
              {
                id: "catalog-8",
                url: "https://example.com/catalog-8",
                name: "Catalog jeans",
                audience: "woman",
                category: "bottom",
                imageUrl: "https://example.com/catalog-8.jpg",
              },
            ],
            outfitSets: [{ itemIds: ["W7", "catalog-8"] }],
          },
          rejectedUrls: [],
        },
      }),
    ).toEqual({
      filters: {},
      data: {
        wardrobe: {
          items: [
            {
              id: "catalog-7",
              url: "https://example.com/catalog-7",
              name: "Catalog shirt",
              audience: "woman",
              category: "top",
              imageUrl: "https://example.com/catalog-7.jpg",
            },
            {
              id: "catalog-8",
              url: "https://example.com/catalog-8",
              name: "Catalog jeans",
              audience: "woman",
              category: "bottom",
              imageUrl: "https://example.com/catalog-8.jpg",
            },
          ],
          outfitSets: [{ itemIds: ["catalog-7", "catalog-8"] }],
        },
        rejectedUrls: [],
      },
    });
  });
});
