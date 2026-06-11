import { describe, expect, test } from "vitest";
import {
  getOutfitItems,
  hasUnexpectedOutfitCreateFields,
  hasUnexpectedOutfitItemsFields,
  toOutfitResponse,
  toOutfitSummary,
} from "./outfitHttp.js";

const savedSnapshot = {
  items: [
    {
      url: "https://example.com/bag",
      source: "from_catalog",
    },
    {
      url: "wardrobe://shirt",
      source: "uploaded",
    },
    { url: "wardrobe://missing", source: "uploaded" },
  ],
};

describe("outfitHttp", () => {
  test("validates state-bearing outfit payload fields", () => {
    expect(hasUnexpectedOutfitCreateFields(null)).toBe(false);
    expect(hasUnexpectedOutfitCreateFields([])).toBe(false);
    expect(
      hasUnexpectedOutfitCreateFields({ name: "Weekend", items: [] }),
    ).toBe(false);
    expect(
      hasUnexpectedOutfitCreateFields({
        name: "Weekend",
        items: [],
        sourceCapsuleId: "capsule-1",
        sourceSetIndex: 0,
      }),
    ).toBe(false);
    expect(
      hasUnexpectedOutfitCreateFields({ name: "Weekend", saved: {} }),
    ).toBe(true);

    expect(hasUnexpectedOutfitItemsFields(null)).toBe(false);
    expect(hasUnexpectedOutfitItemsFields([])).toBe(false);
    expect(hasUnexpectedOutfitItemsFields({ items: [] })).toBe(false);
    expect(hasUnexpectedOutfitItemsFields({ items: [], saved: {} })).toBe(true);
  });

  test("serializes summaries and full responses from hydrated effective snapshots", async () => {
    const outfit = {
      id: "outfit-1",
      name: "Weekend",
      draft: null,
      saved: savedSnapshot,
      status: "saved",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-02",
    };

    expect(toOutfitSummary(outfit)).toEqual({
      id: "outfit-1",
      name: "Weekend",
      status: "saved",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-02",
      hasDraft: false,
      hasSaved: true,
      itemCount: 3,
    });
    await expect(
      toOutfitResponse(outfit, {
        email: "person@example.com",
        getProductsByUrlsForEmailImpl: async () => [
          {
            url: "https://example.com/bag",
            name: "Bag",
            category: "bag",
          },
        ],
        listWardrobeItemsByUrlsImpl: async () => [
          { url: "wardrobe://shirt", name: "Shirt", category: "top" },
        ],
      }),
    ).resolves.toEqual({
      ...toOutfitSummary(outfit),
      draft: null,
      saved: {
        items: [
          {
            url: "https://example.com/bag",
            source: "from_catalog",
            item: {
              url: "https://example.com/bag",
              source: "from_catalog",
              name: "Bag",
              category: "bag",
            },
          },
          {
            url: "wardrobe://shirt",
            source: "uploaded",
            item: {
              url: "wardrobe://shirt",
              source: "uploaded",
              name: "Shirt",
              category: "top",
            },
          },
          { url: "wardrobe://missing", source: "uploaded", item: null },
        ],
        image: null,
        imageObsolete: false,
        report: null,
      },
      effective: {
        items: [
          {
            url: "https://example.com/bag",
            source: "from_catalog",
            item: {
              url: "https://example.com/bag",
              source: "from_catalog",
              name: "Bag",
              category: "bag",
            },
          },
          {
            url: "wardrobe://shirt",
            source: "uploaded",
            item: {
              url: "wardrobe://shirt",
              source: "uploaded",
              name: "Shirt",
              category: "top",
            },
          },
          { url: "wardrobe://missing", source: "uploaded", item: null },
        ],
        image: null,
        imageObsolete: false,
        report: null,
      },
    });
  });

  test("hydrates missing catalog products from wardrobe rows by url", async () => {
    const outfit = {
      id: "outfit-1",
      name: "Weekend",
      draft: {
        items: [
          {
            url: "https://example.com/catalog-missing-from-products",
            source: "from_catalog",
          },
        ],
      },
      saved: null,
      status: "new",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-02",
    };
    const wardrobeLookups: unknown[] = [];

    await expect(
      toOutfitResponse(outfit, {
        email: "person@example.com",
        getProductsByUrlsForEmailImpl: async () => [],
        listWardrobeItemsByUrlsImpl: async (payload) => {
          wardrobeLookups.push(payload);
          return [
            {
              url: "https://example.com/catalog-missing-from-products",
              name: "Saved catalog shirt",
              category: "top",
            },
          ];
        },
      }),
    ).resolves.toMatchObject({
      draft: {
        items: [
          {
            url: "https://example.com/catalog-missing-from-products",
            source: "from_catalog",
            item: {
              url: "https://example.com/catalog-missing-from-products",
              source: "from_catalog",
              name: "Saved catalog shirt",
            },
          },
        ],
      },
    });
    expect(wardrobeLookups).toEqual([
      {
        email: "person@example.com",
        urls: ["https://example.com/catalog-missing-from-products"],
        source: "from_catalog",
      },
    ]);
  });

  test("returns sorted resolved effective items for PDF generation", async () => {
    await expect(
      getOutfitItems(
        { draft: null, saved: savedSnapshot },
        {
          email: "person@example.com",
          getProductsByUrlsForEmailImpl: async () => [
            { url: "https://example.com/bag", name: "Bag", category: "bag" },
          ],
          listWardrobeItemsByUrlsImpl: async () => [
            { url: "wardrobe://shirt", name: "Shirt", category: "top" },
          ],
        },
      ),
    ).resolves.toEqual([
      {
        url: "wardrobe://shirt",
        name: "Shirt",
        category: "top",
        source: "uploaded",
      },
      {
        url: "https://example.com/bag",
        name: "Bag",
        category: "bag",
        source: "from_catalog",
      },
    ]);
    await expect(
      getOutfitItems({ draft: { items: "invalid" }, saved: null }),
    ).resolves.toEqual([]);
  });
});
