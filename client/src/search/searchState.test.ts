import { describe, expect, test } from "vitest";
import {
  buildActiveFilterChips,
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
      exactColor: null,
      exactColorRange: "balanced",
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

  test("normalizes and serializes the exact color filter", () => {
    const state = createSearchState(
      { exactColor: " #AABBCC ", exactColorRange: "broad" },
      EMPTY_SEARCH_OPTIONS.priceRange,
    );

    expect(state.exactColor).toBe("#aabbcc");
    expect(state.exactColorRange).toBe("broad");
    expect(serializeDraftState(state).exactColor).toBe("#aabbcc");

    const chips = buildActiveFilterChips({
      state,
      options: EMPTY_SEARCH_OPTIONS,
      locale: "en",
      t: (key, params) => {
        if (key === "search.filters.exactColorRangeBroad") return "Broad";
        if (key === "search.filters.exactColorChip") {
          return `Color match: ${params?.color} · ${params?.range}`;
        }
        return key;
      },
      translateOption: (_group, value) => value,
    });
    expect(chips).toContainEqual({
      key: "exactColor:#aabbcc",
      field: "exactColor",
      value: "#aabbcc",
      label: "Color match: #aabbcc · Broad",
      swatchColor: "#aabbcc",
    });
  });

  test("defaults missing or invalid exact color ranges to balanced", () => {
    expect(
      createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange).exactColorRange,
    ).toBe("balanced");
    expect(
      createSearchState(
        { exactColorRange: "unsupported" },
        EMPTY_SEARCH_OPTIONS.priceRange,
      ).exactColorRange,
    ).toBe("balanced");
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

  test("buildActiveFilterChips preserves pattern metadata for swatch labels", () => {
    const state = createSearchState(
      {
        pattern: ["solid", "argyle"],
      },
      EMPTY_SEARCH_OPTIONS.priceRange,
    );

    const chips = buildActiveFilterChips({
      state,
      options: {
        ...EMPTY_SEARCH_OPTIONS,
        patterns: ["solid", "argyle"],
      },
      locale: "en",
      t: (key) =>
        ({
          "profile.patternTitle": "Pattern",
        })[key] || key,
      translateOption: (_group, value) =>
        ({
          solid: "Solid",
          argyle: "Argyle",
        })[value] || value,
    });

    expect(chips).toContainEqual(
      expect.objectContaining({
        field: "pattern",
        optionGroup: "patterns",
        title: "Pattern",
        values: ["solid", "argyle"],
        valueLabels: ["Solid", "Argyle"],
        label: "Pattern: Solid, Argyle",
      }),
    );
  });
});
