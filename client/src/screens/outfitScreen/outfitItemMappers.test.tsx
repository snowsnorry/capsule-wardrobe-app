import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  getItemImageUrl,
  getItemKey,
  getItemName,
  getOutfitItemKey,
  getOutfitItems,
  getOutfitPersonalItemSource,
  getPreviewItemKey,
  sortOutfitItemSnapshots,
  toSnapshot,
  useVisibleOutfitPersonalItems,
} from "./outfitItemMappers";

describe("outfit item mappers", () => {
  test("resolves outfit item snapshots from the effective, draft, or saved state", () => {
    const effectiveItems = [
      {
        url: "https://example.com/effective",
        source: "from_catalog" as const,
        item: {},
      },
    ];
    const draftItems = [
      {
        url: "https://example.com/draft",
        source: "from_catalog" as const,
        item: {},
      },
    ];
    const savedItems = [
      { url: "wardrobe://saved", source: "uploaded" as const, item: {} },
    ];

    expect(getOutfitItems({ effective: { items: effectiveItems } })).toBe(
      effectiveItems,
    );
    expect(getOutfitItems({ draft: { items: draftItems } })).toBe(draftItems);
    expect(getOutfitItems({ saved: { items: savedItems } })).toBe(savedItems);
    expect(getOutfitItems(null)).toEqual([]);
  });

  test("builds stable keys, snapshots, labels, images, and personal sources", () => {
    expect(getItemKey({ id: 42 })).toBe("");
    expect(getOutfitItemKey({ url: "wardrobe://42", source: "uploaded" })).toBe(
      "uploaded\u0000wardrobe://42",
    );
    expect(getItemKey({ url: "https://example.com/item" })).toBe(
      "https://example.com/item",
    );
    expect(toSnapshot({}, "catalog")).toBeNull();
    expect(
      toSnapshot(
        {
          url: "https://example.com/catalog",
          name: "Catalog",
        },
        "catalog",
      ),
    ).toMatchObject({
      url: "https://example.com/catalog",
      source: "from_catalog",
    });
    expect(
      toSnapshot(
        {
          id: 7,
          url: "https://example.com/uploaded-product-page",
          name: "Uploaded",
          source: "uploaded",
        },
        "personal",
      ),
    ).toMatchObject({
      url: "wardrobe://7",
      source: "uploaded",
    });
    expect(
      toSnapshot(
        {
          wardrobeId: 8,
          url: "https://example.com/uploaded-product-page",
          name: "Uploaded",
          source: "uploaded",
        },
        "personal",
      ),
    ).toMatchObject({
      url: "wardrobe://8",
      source: "uploaded",
    });
    expect(
      toSnapshot(
        {
          url: "https://example.com/uploaded-product-page",
          name: "Uploaded",
          source: "uploaded",
        },
        "personal",
      ),
    ).toMatchObject({
      url: "https://example.com/uploaded-product-page",
      source: "uploaded",
    });
    expect(
      getItemImageUrl({ rawImageUrl: "https://example.com/raw.jpg" }),
    ).toBe("https://example.com/raw.jpg");
    expect(getItemName({ productName: "Product name" })).toBe("Product name");
    expect(getPreviewItemKey({ wardrobeId: 7 })).toBe("7");
    expect(getOutfitPersonalItemSource({ source: "uploaded" })).toBe(
      "uploaded",
    );
    expect(getOutfitPersonalItemSource({ source: "from_catalog" })).toBe(
      "catalog",
    );
    expect(getOutfitPersonalItemSource({ source: "unknown" })).toBe("catalog");
  });

  test("sorts resolved outfit items before missing entries", () => {
    const items = [
      { url: "wardrobe://missing", source: "uploaded" as const, item: null },
      {
        url: "https://example.com/bag",
        source: "from_catalog" as const,
        item: { name: "Bag", category: "bag" },
      },
      {
        url: "https://example.com/top",
        source: "from_catalog" as const,
        item: { name: "Top", category: "top" },
      },
    ];

    expect(sortOutfitItemSnapshots(items).map((item) => item.url)).toEqual([
      "https://example.com/top",
      "https://example.com/bag",
      "wardrobe://missing",
    ]);
  });

  test("filters visible personal items by source, liked state, and type", () => {
    const items = [
      {
        id: 1,
        name: "Catalog top",
        category: "top",
        source: "from_catalog",
        isLiked: true,
      },
      {
        id: 2,
        name: "Uploaded top",
        category: "top",
        source: "uploaded",
        isLiked: false,
      },
      {
        id: 3,
        name: "Uploaded bag",
        category: "bag",
        source: "uploaded",
        isLiked: true,
      },
    ];

    const { result, rerender } = renderHook(
      ({
        likedOnly,
        sourceFilter,
        typeFilter,
      }: {
        likedOnly: boolean;
        sourceFilter: "all" | "catalog" | "uploaded";
        typeFilter: "all" | string;
      }) =>
        useVisibleOutfitPersonalItems({
          items,
          likedOnly,
          sourceFilter,
          typeFilter,
        }),
      {
        initialProps: {
          likedOnly: true,
          sourceFilter: "uploaded" as const,
          typeFilter: "all",
        },
      },
    );
    expect(result.current.map((item) => item.name)).toEqual(["Uploaded bag"]);

    rerender({
      likedOnly: false,
      sourceFilter: "all",
      typeFilter: "top",
    });
    expect(result.current.map((item) => item.name)).toEqual([
      "Catalog top",
      "Uploaded top",
    ]);
  });
});
