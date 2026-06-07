import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  getItemImageUrl,
  getItemKey,
  getItemName,
  getOutfitItems,
  getOutfitPersonalItemSource,
  getPreviewItemKey,
  toSnapshot,
  useVisibleOutfitPersonalItems,
} from "./outfitItemMappers";

describe("outfit item mappers", () => {
  test("resolves outfit item snapshots from the effective, draft, or saved state", () => {
    const effectiveItems = [
      { key: "effective", source: "catalog" as const, item: {} },
    ];
    const draftItems = [{ key: "draft", source: "catalog" as const, item: {} }];
    const savedItems = [{ key: "saved", source: "catalog" as const, item: {} }];

    expect(getOutfitItems({ effective: { items: effectiveItems } })).toBe(
      effectiveItems,
    );
    expect(getOutfitItems({ draft: { items: draftItems } })).toBe(draftItems);
    expect(getOutfitItems({ saved: { items: savedItems } })).toBe(savedItems);
    expect(getOutfitItems(null)).toEqual([]);
  });

  test("builds stable keys, snapshots, labels, images, and personal sources", () => {
    expect(getItemKey({ id: 42 }, "personal")).toBe("wardrobe://42");
    expect(getItemKey({ wardrobeId: "w-1" }, "personal")).toBe(
      "wardrobe://w-1",
    );
    expect(getItemKey({ url: "https://example.com/item" }, "catalog")).toBe(
      "https://example.com/item",
    );
    expect(toSnapshot({}, "catalog")).toBeNull();
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
