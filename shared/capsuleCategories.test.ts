import { describe, expect, test } from "vitest";
import {
  expandCapsuleCategoriesForAnchors,
  getCapsuleCategories,
  getCapsuleCategoryShortfalls,
  getReadyWardrobeCapsuleItems,
} from "./capsuleCategories.js";

describe("capsuleCategories", () => {
  test("returns the base capsule for missing profile", () => {
    expect(getCapsuleCategories()).toEqual({
      bottom: 3,
      top: 3,
      outerwear: 1,
      shoes: 2,
      belt: 1,
      bag: 2,
    });
  });

  test("adds audience and season specific categories", () => {
    expect(
      getCapsuleCategories({ audience: "woman", season: ["spring", "summer"] }),
    ).toEqual({
      bottom: 3,
      top: 3,
      outerwear: 2,
      shoes: 2,
      belt: 1,
      bag: 2,
      dress: 2,
      midlayer: 2,
    });
  });

  test("filters ready wardrobe capsule items", () => {
    expect(
      getReadyWardrobeCapsuleItems([
        { category: "top", processingStatus: "ready" },
        { category: "bottom", processingStatus: "needs_review" },
        { category: "", processingStatus: "ready" },
      ]),
    ).toEqual([{ category: "top", processingStatus: "ready" }]);
  });

  test("reports missing required capsule categories", () => {
    expect(
      getCapsuleCategoryShortfalls({
        profile: { audience: "any", season: ["summer"] },
        items: [
          { category: "top", processingStatus: "ready" },
          { category: "top", processingStatus: "ready" },
          { category: "bottom", processingStatus: "ready" },
        ],
      }),
    ).toEqual([
      { category: "bottom", required: 3, available: 1, missing: 2 },
      { category: "top", required: 3, available: 2, missing: 1 },
      { category: "outerwear", required: 1, available: 0, missing: 1 },
      { category: "shoes", required: 2, available: 0, missing: 2 },
      { category: "belt", required: 1, available: 0, missing: 1 },
      { category: "bag", required: 2, available: 0, missing: 2 },
    ]);
  });

  test("expands required categories for selected anchors", () => {
    expect(
      expandCapsuleCategoriesForAnchors(getCapsuleCategories(), [
        { category: "top" },
        { category: "top" },
        { category: "top" },
        { category: "top" },
        { category: "scarf" },
      ]),
    ).toEqual({
      bottom: 3,
      top: 4,
      outerwear: 1,
      shoes: 2,
      belt: 1,
      bag: 2,
      scarf: 1,
    });
  });
});
