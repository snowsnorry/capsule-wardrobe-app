import { describe, expect, test } from "vitest";
import {
  buildSearchOptionsPayload,
  createSearchState,
  EMPTY_SEARCH_OPTIONS,
  serializeDraftState
} from "./searchState";

describe("searchState", () => {
  test("createSearchState normalizes scalar and array filters for shared search screens", () => {
    const state = createSearchState({
      brand: "uniqlo",
      audience: "woman",
      category: "top",
      season: ["summer"],
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: "office",
      color: "blue",
      pattern: "stripe",
      silhouette: "relaxed",
      fit: "regular",
      closureType: "button",
      priceMin: 20,
      priceMax: 80
    }, { min: 10, max: 100 });

    expect(state.brand).toEqual(["uniqlo"]);
    expect(state.audience).toEqual(["woman"]);
    expect(state.category).toEqual(["top"]);
    expect(state.formalityLevel).toEqual(["casual"]);
    expect(state.priceEnabled).toBe(true);
    expect(state.priceMinDraft).toBe(20);
    expect(state.priceMaxDraft).toBe(80);
  });

  test("serializeDraftState preserves the shared payload contract", () => {
    const state = createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange);
    const nextState = {
      ...state,
      query: "linen shirt",
      brand: ["uniqlo"],
      priceEnabled: true,
      priceMinDraft: 15,
      priceMaxDraft: 90,
      page: 3
    };

    expect(serializeDraftState(nextState)).toEqual({
      query: "linen shirt",
      brand: ["uniqlo"],
      priceMin: 15,
      priceMax: 90,
      audience: [],
      category: [],
      season: [],
      formalityLevel: [],
      style: [],
      occasions: [],
      color: [],
      pattern: [],
      silhouette: [],
      fit: [],
      closureType: [],
      page: 3
    });
  });

  test("buildSearchOptionsPayload maps API responses to a stable options shape", () => {
    expect(buildSearchOptionsPayload({
      brands: [{ value: "uniqlo", label: "UNIQLO" }],
      categories: ["top"]
    })).toEqual({
      ...EMPTY_SEARCH_OPTIONS,
      brands: [{ value: "uniqlo", label: "UNIQLO" }],
      categories: ["top"],
      priceRange: { min: null, max: null }
    });
  });
});
