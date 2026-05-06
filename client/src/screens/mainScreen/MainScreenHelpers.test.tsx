import { beforeEach, describe, expect, test } from "vitest";
import {
  buildCapsuleSummaryItems,
  capsuleCanRequestShare,
  capsuleHasUnsavedChanges,
  readStoredMobileCardColumns,
  resolveOutfitSetImageSrc,
  resolveOutfitSets,
  writeStoredMobileCardColumns
} from "./MainScreenHelpers";
import { t } from "./MainScreen.testUtils";

describe("MainScreenHelpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("builds capsule metadata with counts and active filters in filter order", () => {
    expect(buildCapsuleSummaryItems({
      itemCount: 3,
      outfitCount: 1,
      selectedStyleCore: "formal",
      selectedStyleAesthetic: "minimalistic",
      selectedOccasions: ["office"],
      selectedSeasons: ["spring"],
      selectedAudience: "woman",
      selectedAccentColor: "red",
      selectedPattern: "stripe",
      selectedText: "No wool",
      locale: "en",
      t
    })).toEqual([
      "3 items",
      "1 outfits",
      "Formal / Minimalistic",
      "Office",
      "Spring",
      "Woman",
      "Red",
      "Stripe",
      "No wool"
    ]);
  });

  test("resolves valid outfit sets and sorts items by wardrobe category order", () => {
    expect(resolveOutfitSets([
      { id: "b", url: "https://example.com/b", name: "Blazer", category: "outerwear" },
      { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
      { id: "c", url: "https://example.com/c", name: "Trousers", category: "bottom" },
      { id: "d", url: "https://example.com/d", name: "Bag", category: "bag" }
    ], [
      { itemIds: ["c", "a", "d"] },
      { itemIds: ["x", "a"] }
    ])).toEqual([{
      id: "set-1",
      index: 0,
      label: 1,
      items: [
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "c", url: "https://example.com/c", name: "Trousers", category: "bottom" },
        { id: "d", url: "https://example.com/d", name: "Bag", category: "bag" }
      ],
      image: null,
      imageObsolete: false
    }]);
  });

  test("resolves outfit set image sources", () => {
    expect(resolveOutfitSetImageSrc("abc123")).toBe("data:image/png;base64,abc123");
    expect(resolveOutfitSetImageSrc("data:image/png;base64,abc123")).toBe("data:image/png;base64,abc123");
    expect(resolveOutfitSetImageSrc("https://images.example.com/set.png")).toBe("https://images.example.com/set.png");
    expect(resolveOutfitSetImageSrc("  ")).toBe("");
  });

  test("reads and writes stored mobile card columns with fallback for invalid values", () => {
    expect(readStoredMobileCardColumns()).toBe(2);
    writeStoredMobileCardColumns(3);
    expect(window.localStorage.getItem("capsule.mobileCardColumns")).toBe("3");
    expect(readStoredMobileCardColumns()).toBe(3);
    window.localStorage.setItem("capsule.mobileCardColumns", "4");
    expect(readStoredMobileCardColumns()).toBe(2);
  });

  test("reports capsule unsaved and shareable states", () => {
    expect(capsuleHasUnsavedChanges({ status: "new" })).toBe(true);
    expect(capsuleHasUnsavedChanges({ status: "modified" })).toBe(true);
    expect(capsuleHasUnsavedChanges({ status: "saved" })).toBe(false);

    expect(capsuleCanRequestShare({
      id: "capsule-1",
      draft: { data: { wardrobe: { items: [{ url: "https://example.com/1" }] } } }
    })).toBe(true);
    expect(capsuleCanRequestShare({
      id: "capsule-1",
      draft: { data: { wardrobe: { items: [] } } }
    })).toBe(false);
    expect(capsuleCanRequestShare({ id: "capsule-2" }, { allowUnknownContent: true })).toBe(true);
    expect(capsuleCanRequestShare({ name: "No id" }, { allowUnknownContent: true })).toBe(false);
  });
});
