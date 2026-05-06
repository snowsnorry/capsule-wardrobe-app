import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import useSearchScreenState from "./useSearchScreenState";

const searchApi = vi.hoisted(() => ({
  fetchSavedSearch: vi.fn(),
  fetchSearchOptions: vi.fn(),
  runSearch: vi.fn()
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
    "search.filters.price": "Price"
  };
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
    priceRange: { min: 10, max: 150 }
  };
}

function makeSavedSearch(overrides = {}) {
  return {
    search: {
      query: "linen shirt",
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
      ...overrides
    }
  };
}

function renderSearchState(overrides = {}) {
  return renderHook(() => useSearchScreenState({
    initialQuery: "",
    autoOpenProductDetail: false,
    isMobile: false,
    locale: "en",
    t,
    ...overrides
  }));
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
        { id: "2", name: "Wool Trousers", brand: "COS" }
      ],
      total: 55
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
    expect(result.current.formattedTotal).toBe("55");
    expect(result.current.selectedItem?.id).toBe("1");
    expect(searchApi.fetchSearchOptions).toHaveBeenCalledWith({ force: true });
    expect(searchApi.fetchSavedSearch).toHaveBeenCalledWith({ force: true });
    expect(searchApi.runSearch).toHaveBeenCalledWith({
      query: "linen shirt",
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
      page: 3
    });
  });

  test("uses initial query handoff instead of saved filters on first search", async () => {
    const { result } = renderSearchState({ initialQuery: "https://example.com/products/linen-shirt" });

    await waitForBootstrap();

    expect(result.current.draftState.query).toBe("https://example.com/products/linen-shirt");
    expect(searchApi.runSearch).toHaveBeenCalledWith({
      query: "https://example.com/products/linen-shirt",
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
      page: 1
    });
  });

  test("mobile auto-opens product detail only for a single handoff result with flag", async () => {
    searchApi.runSearch.mockResolvedValueOnce({
      items: [{ id: "1", name: "Linen Shirt", url: "https://example.com/products/linen-shirt" }],
      total: 1
    });

    const { result } = renderSearchState({
      initialQuery: "https://example.com/products/linen-shirt",
      autoOpenProductDetail: true,
      isMobile: true
    });

    await waitFor(() => {
      expect(result.current.isDetailOpen).toBe(true);
    });

    cleanup();
    searchApi.runSearch.mockClear();
    searchApi.runSearch.mockResolvedValueOnce({
      items: [
        { id: "1", name: "Linen Shirt" },
        { id: "2", name: "Wool Trousers" }
      ],
      total: 2
    });

    const multiple = renderSearchState({
      initialQuery: "https://example.com/products/linen-shirt",
      autoOpenProductDetail: true,
      isMobile: true
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

    await act(async () => {
      await result.current.applyCurrentQuery();
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith(expect.objectContaining({
      query: "blue cardigan",
      page: 1
    }));

    searchApi.runSearch.mockClear();
    act(() => {
      result.current.changeQuery("black blazer");
    });
    await act(async () => {
      await result.current.applyCurrentQuery();
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith(expect.objectContaining({
      query: "black blazer",
      page: 1
    }));

    searchApi.runSearch.mockClear();
    await act(async () => {
      await result.current.clearQuery();
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith(expect.objectContaining({
      query: "",
      page: 1
    }));
  });

  test("reset and chip deletion debounce search updates", async () => {
    const { result } = renderSearchState();
    await waitForBootstrap();
    vi.useFakeTimers();
    searchApi.runSearch.mockClear();

    act(() => {
      result.current.deleteActiveChip(result.current.activeChips[0]);
    });
    expect(searchApi.runSearch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith(expect.objectContaining({
      brand: [],
      season: ["summer"],
      page: 1
    }));

    searchApi.runSearch.mockClear();
    act(() => {
      result.current.resetSearch();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(searchApi.runSearch).toHaveBeenCalledWith({
      query: "",
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
      page: 1
    });
  });

  test("debounces rapid filter changes into one search request", async () => {
    const { result } = renderSearchState();
    await waitForBootstrap();
    vi.useFakeTimers();
    searchApi.runSearch.mockClear();

    act(() => {
      result.current.changeSidebarDraft((current) => ({ ...current, category: ["top"], page: 1 }), { submit: true });
      result.current.changeSidebarDraft((current) => ({ ...current, category: ["top", "bottom"], page: 1 }), { submit: true });
      result.current.changeSidebarDraft((current) => ({ ...current, category: ["top", "bottom"], audience: ["woman"], page: 1 }), { submit: true });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(searchApi.runSearch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(searchApi.runSearch).toHaveBeenCalledTimes(1);
    expect(searchApi.runSearch).toHaveBeenCalledWith(expect.objectContaining({
      category: ["top", "bottom"],
      audience: ["woman"],
      page: 1
    }));
  });
});
