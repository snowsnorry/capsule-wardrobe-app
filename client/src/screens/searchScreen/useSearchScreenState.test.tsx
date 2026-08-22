import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { getSearchStateWithoutChip } from "./searchChipState";
import useSearchScreenState from "./useSearchScreenState";

const searchApi = vi.hoisted(() => ({
  fetchSavedSearch: vi.fn(),
  fetchSearchOptions: vi.fn(),
  runSearch: vi.fn(),
}));

vi.mock("../../api/search", () => searchApi);

const t = (key: string, params?: Record<string, unknown>) => {
  const labels: Record<string, string> = {
    "errors.generic": "Something went wrong",
    "search.filters.brand": "Brand",
    "profile.audienceTitle": "Audience",
    "search.filters.category": "Category",
    "profile.seasonsTitle": "Seasons",
    "statistics.charts.formalityLevel": "Core",
    "statistics.charts.style": "Aesthetics",
    "profile.occasionsTitle": "Occasions",
    "profile.accentColorTitle": "Accent color",
    "profile.patternTitle": "Pattern",
    "search.filters.silhouette": "Silhouette",
    "search.filters.fit": "Fit",
    "search.filters.closureType": "Closure",
    "search.filters.price": "Price",
  };
  if (key === "search.filters.query") {
    return `Search: ${params?.query}`;
  }
  if (key === "search.resultsCount") {
    return `${params?.count} results`;
  }
  return labels[key] ?? key;
};

function makeOptions() {
  return {
    brands: [{ value: "uniqlo", label: "UNIQLO" }],
    categories: ["top", "bottom"],
    seasons: ["summer"],
    formalityLevels: ["casual"],
    styles: ["minimalistic"],
    occasions: ["office"],
    audience: ["woman", "all"],
    colors: ["blue"],
    patterns: ["stripe"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["button"],
    priceRange: { min: 10, max: 150 },
  };
}

function makeSavedSearch(overrides = {}) {
  return {
    search: {
      query: "linen shirt",
      exactColor: null,
      likedOnly: true,
      brand: ["uniqlo"],
      category: [],
      season: ["summer"],
      audience: [],
      formalityLevel: [],
      style: [],
      occasions: [],
      color: [],
      pattern: [],
      silhouette: [],
      fit: [],
      closureType: [],
      priceMin: null,
      priceMax: null,
      page: 3,
      ...overrides,
    },
  };
}

function renderSearchState(overrides = {}) {
  return renderHook(() =>
    useSearchScreenState({
      initialQuery: "",
      autoOpenProductDetail: false,
      isMobile: false,
      locale: "en",
      t,
      ...overrides,
    }),
  );
}

async function waitForBootstrap() {
  await waitFor(() => {
    expect(searchApi.runSearch).toHaveBeenCalled();
  });
}

describe("useSearchScreenState", () => {
  beforeEach(() => {
    searchApi.fetchSearchOptions.mockReset();
    searchApi.fetchSavedSearch.mockReset();
    searchApi.runSearch.mockReset();
    searchApi.fetchSearchOptions.mockResolvedValue(makeOptions());
    searchApi.fetchSavedSearch.mockResolvedValue(makeSavedSearch());
    searchApi.runSearch.mockResolvedValue({
      items: [
        { id: "1", name: "Linen Shirt", brand: "UNIQLO", audience: "all" },
        { id: "2", name: "Wool Trousers", brand: "COS" },
      ],
      total: 55,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  test("hydrates from saved search and runs initial search with serialized state", async () => {
    const { result } = renderSearchState();

    await waitForBootstrap();

    expect(result.current.draftState.query).toBe("linen shirt");
    expect(result.current.activeChips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "query",
          label: "Search: linen shirt",
          value: "linen shirt",
        }),
      ]),
    );
    expect(result.current.formattedTotal).toBe("55");
    expect(result.current.selectedItem?.id).toBe("1");
    expect(searchApi.fetchSearchOptions).toHaveBeenCalledWith({ force: true });
    expect(searchApi.fetchSavedSearch).toHaveBeenCalledWith({ force: true });
    expect(searchApi.runSearch).toHaveBeenCalledWith({
      query: "linen shirt",
      exactColor: null,
      likedOnly: true,
      brand: ["uniqlo"],
      priceMin: null,
      priceMax: null,
      audience: [],
      category: [],
      season: ["summer"],
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

  test("builds search state after deleting price and facet chips", () => {
    const currentState = {
      ...makeSavedSearch().search,
      priceEnabled: true,
      priceMinDraft: 25,
      priceMaxDraft: 80,
    };

    expect(
      getSearchStateWithoutChip({
        chip: { key: "price", field: "price", label: "Price" },
        currentState,
        priceRange: { min: 10, max: 150 },
      }),
    ).toEqual({
      ...currentState,
      priceEnabled: false,
      priceMinDraft: 10,
      priceMaxDraft: 150,
      page: 1,
    });
    expect(
      getSearchStateWithoutChip({
        chip: { key: "category-top", field: "category", label: "Top" },
        currentState,
        priceRange: { min: 10, max: 150 },
      }),
    ).toEqual({ ...currentState, category: [], page: 1 });
    expect(
      getSearchStateWithoutChip({
        chip: {
          key: "likedOnly:true",
          field: "likedOnly",
          label: "Liked only",
        },
        currentState,
        priceRange: { min: 10, max: 150 },
      }),
    ).toEqual({ ...currentState, likedOnly: false, page: 1 });
    expect(
      getSearchStateWithoutChip({
        chip: {
          key: "query:linen shirt",
          field: "query",
          label: "Search: linen shirt",
          value: "linen shirt",
        },
        currentState,
        priceRange: { min: 10, max: 150 },
      }),
    ).toEqual({ ...currentState, query: "", page: 1 });
  });

  test("uses initial query handoff instead of saved filters on first search", async () => {
    const { result } = renderSearchState({
      initialQuery: "https://example.com/products/linen-shirt",
    });

    await waitForBootstrap();

    expect(result.current.draftState.query).toBe(
      "https://example.com/products/linen-shirt",
    );
    expect(searchApi.runSearch).toHaveBeenCalledWith({
      query: "https://example.com/products/linen-shirt",
      exactColor: null,
      likedOnly: false,
      brand: [],
      priceMin: null,
      priceMax: null,
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
      page: 1,
    });
  });

  test("builds a compact query chip and clears the search string when deleting it", async () => {
    searchApi.fetchSavedSearch.mockResolvedValueOnce(
      makeSavedSearch({
        query:
          "relaxed blue linen shirt for summer office days with a soft collar",
      }),
    );
    const { result } = renderSearchState();
    await waitForBootstrap();
    vi.useFakeTimers();
    searchApi.runSearch.mockClear();

    const queryChip = result.current.activeChips.find(
      (chip) => chip.field === "query",
    );
    expect(queryChip).toEqual(
      expect.objectContaining({
        field: "query",
        label: "Search: relaxed blue linen shirt for summer office days...",
      }),
    );

    act(() => {
      result.current.deleteActiveChip(queryChip!);
    });
    expect(result.current.draftState.query).toBe("");
    expect(searchApi.runSearch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "",
        page: 1,
      }),
    );
  });

  test("mobile auto-opens product detail only for a single handoff result with flag", async () => {
    searchApi.runSearch.mockResolvedValueOnce({
      items: [
        {
          id: "1",
          name: "Linen Shirt",
          url: "https://example.com/products/linen-shirt",
        },
      ],
      total: 1,
    });

    const { result } = renderSearchState({
      initialQuery: "https://example.com/products/linen-shirt",
      autoOpenProductDetail: true,
      isMobile: true,
    });

    await waitFor(() => {
      expect(result.current.isDetailOpen).toBe(true);
    });

    cleanup();
    searchApi.runSearch.mockClear();
    searchApi.runSearch.mockResolvedValueOnce({
      items: [
        { id: "1", name: "Linen Shirt" },
        { id: "2", name: "Wool Trousers" },
      ],
      total: 2,
    });

    const multiple = renderSearchState({
      initialQuery: "https://example.com/products/linen-shirt",
      autoOpenProductDetail: true,
      isMobile: true,
    });
    await waitForBootstrap();
    expect(multiple.result.current.isDetailOpen).toBe(false);
  });

  test("query applies on enter-style action, blur-style action, and clear while typing alone does not search", async () => {
    const { result } = renderSearchState();
    await waitForBootstrap();
    searchApi.runSearch.mockClear();

    act(() => {
      result.current.changeQuery("blue cardigan");
    });
    expect(searchApi.runSearch).not.toHaveBeenCalled();
    expect(result.current.draftState.query).toBe("blue cardigan");
    expect(result.current.activeChips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "query",
          label: "Search: linen shirt",
        }),
      ]),
    );

    await act(async () => {
      await result.current.applyCurrentQuery();
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "blue cardigan",
        page: 1,
      }),
    );
    expect(result.current.activeChips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "query",
          label: "Search: blue cardigan",
        }),
      ]),
    );

    searchApi.runSearch.mockClear();
    act(() => {
      result.current.changeQuery("black blazer");
    });
    await act(async () => {
      await result.current.applyCurrentQuery();
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "black blazer",
        page: 1,
      }),
    );

    searchApi.runSearch.mockClear();
    await act(async () => {
      await result.current.clearQuery();
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "",
        page: 1,
      }),
    );
  });

  test("marks matching search results as saved to wardrobe", async () => {
    const { result } = renderSearchState();
    await waitForBootstrap();

    act(() => {
      result.current.markResultSavedToWardrobe({
        id: "1",
        url: "https://example.com/1",
      });
    });

    expect(result.current.results[0].isSavedToWardrobe).toBe(true);
    expect(result.current.selectedItem?.isSavedToWardrobe).toBe(true);
    expect(result.current.results[1].isSavedToWardrobe).toBeUndefined();
  });

  test("reset and chip deletion debounce search updates", async () => {
    const { result } = renderSearchState();
    await waitForBootstrap();
    vi.useFakeTimers();
    searchApi.runSearch.mockClear();

    act(() => {
      const likedChip = result.current.activeChips.find(
        (chip) => chip.field === "likedOnly",
      );
      result.current.deleteActiveChip(likedChip!);
    });
    expect(searchApi.runSearch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        likedOnly: false,
        brand: ["uniqlo"],
        season: ["summer"],
        page: 1,
      }),
    );

    searchApi.runSearch.mockClear();
    act(() => {
      result.current.resetSearch();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith({
      query: "",
      exactColor: null,
      likedOnly: false,
      brand: [],
      priceMin: null,
      priceMax: null,
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
      page: 1,
    });
  });

  test("debounces rapid filter changes into one search request", async () => {
    const { result } = renderSearchState();
    await waitForBootstrap();
    vi.useFakeTimers();
    searchApi.runSearch.mockClear();

    act(() => {
      result.current.changeSidebarDraft(
        (current) => ({ ...current, category: ["top"], page: 1 }),
        { submit: true },
      );
      result.current.changeSidebarDraft(
        (current) => ({ ...current, category: ["top", "bottom"], page: 1 }),
        { submit: true },
      );
      result.current.changeSidebarDraft(
        (current) => ({
          ...current,
          category: ["top", "bottom"],
          audience: ["woman"],
          page: 1,
        }),
        { submit: true },
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(searchApi.runSearch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(searchApi.runSearch).toHaveBeenCalledTimes(1);
    expect(searchApi.runSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        category: ["top", "bottom"],
        audience: ["woman"],
        page: 1,
      }),
    );
  });
});
