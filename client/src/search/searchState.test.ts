import { describe, expect, test } from "vitest";
import {
  buildSearchOptionsPayload,
  createSearchState,
  EMPTY_SEARCH_OPTIONS,
  serializeDraftState,
} from "./searchState";

describe("searchState", () => {
  test("createSearchState normalizes scalar and array filters for shared search screens", () => {
    const state = createSearchState(
      {
        likedOnly: true,
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
        priceMax: 80,
      },
      { min: 10, max: 100 },
    );

    expect(state.brand).toEqual(["uniqlo"]);
    expect(state.likedOnly).toBe(true);
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
      likedOnly: true,
      brand: ["uniqlo"],
      priceEnabled: true,
      priceMinDraft: 15,
      priceMaxDraft: 90,
      page: 3,
    };

    expect(serializeDraftState(nextState)).toEqual({
      query: "linen shirt",
      likedOnly: true,
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
      page: 3,
    });
  });

  test("treats the full available price range as no active price filter", () => {
    const priceRange = { min: 10, max: 150 };
    const state = createSearchState(
      { priceMin: 10, priceMax: 150 },
      priceRange,
    );

    expect(state).toMatchObject({
      priceEnabled: false,
      priceMinDraft: 10,
      priceMaxDraft: 150,
    });
    expect(
      serializeDraftState(
        { ...state, priceEnabled: true, priceMinDraft: 10, priceMaxDraft: 150 },
        priceRange,
      ),
    ).toMatchObject({
      priceMin: null,
      priceMax: null,
    });
  });

  test("keeps partial saved price bounds active", () => {
    const state = createSearchState({ priceMax: 100 }, { min: 10, max: 150 });

    expect(state).toMatchObject({
      priceEnabled: true,
      priceMinDraft: 10,
      priceMaxDraft: 100,
    });
  });

  test("buildSearchOptionsPayload maps API responses to a stable options shape", () => {
    expect(
      buildSearchOptionsPayload({
        brands: [{ value: "uniqlo", label: "UNIQLO" }],
        categories: ["top"],
      }),
    ).toEqual({
      ...EMPTY_SEARCH_OPTIONS,
      brands: [{ value: "uniqlo", label: "UNIQLO" }],
      categories: ["top"],
      priceRange: { min: null, max: null },
    });
  });
});
