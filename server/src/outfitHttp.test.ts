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
      key: "bag",
      source: "catalog",
      item: { name: "Bag", category: "bag" },
    },
    {
      key: "shirt",
      source: "catalog",
      item: { name: "Shirt", category: "top" },
    },
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
      hasUnexpectedOutfitCreateFields({ name: "Weekend", saved: {} }),
    ).toBe(true);

    expect(hasUnexpectedOutfitItemsFields(null)).toBe(false);
    expect(hasUnexpectedOutfitItemsFields([])).toBe(false);
    expect(hasUnexpectedOutfitItemsFields({ items: [] })).toBe(false);
    expect(hasUnexpectedOutfitItemsFields({ items: [], saved: {} })).toBe(true);
  });

  test("serializes summaries and full responses from effective snapshots", () => {
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
      itemCount: 2,
    });
    expect(toOutfitResponse(outfit)).toEqual({
      ...toOutfitSummary(outfit),
      draft: null,
      saved: savedSnapshot,
      effective: savedSnapshot,
    });
  });

  test("returns sorted effective items for PDF generation", () => {
    expect(getOutfitItems({ draft: null, saved: savedSnapshot })).toEqual([
      { name: "Shirt", category: "top" },
      { name: "Bag", category: "bag" },
    ]);
    expect(
      getOutfitItems({ draft: { items: "invalid" }, saved: null }),
    ).toEqual([]);
  });
});
