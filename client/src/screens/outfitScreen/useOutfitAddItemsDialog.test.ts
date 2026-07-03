import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import {
  createSearchState,
  serializeDraftState,
} from "../../search/searchState";
import {
  CATALOG_PICKER_PAGE_SIZE,
  getAppliedCatalogSearchState,
  getCatalogMobileFiltersDraft,
  getResetCatalogSearchState,
  mergeSelectedSnapshots,
  useOutfitAddItemsDialog,
} from "./useOutfitAddItemsDialog";
import { useOutfitCatalogPicker } from "./useOutfitCatalogPicker";

const searchApi = vi.hoisted(() => ({
  fetchSearchOptions: vi.fn(),
  runSearch: vi.fn(),
}));

vi.mock("../../api/search", () => searchApi);

function makeCatalogOptions() {
  return {
    brands: [{ value: "uniqlo", label: "UNIQLO" }],
    categories: ["outerwear", "top"],
    seasons: ["winter"],
    formalityLevels: ["casual"],
    styles: ["minimalistic"],
    occasions: ["office"],
    audience: ["all"],
    colors: ["black"],
    patterns: ["solid"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["zip"],
    priceRange: { min: 0, max: 300 },
  };
}

function t(key: string) {
  return key;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function HookHarness() {
  const model = useOutfitAddItemsDialog({
    existingItems: [],
    initialItems: [],
    locale: "en",
    maxSelected: null,
    open: false,
    t,
  });

  return React.createElement(
    "div",
    null,
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () =>
          model.changeCatalogMobileFiltersDraft((current) => ({
            ...current,
            likedOnly: true,
          })),
      },
      "change mobile draft",
    ),
    React.createElement(
      "span",
      { "data-testid": "mobile-liked" },
      String(model.catalogMobileFiltersDraftState.likedOnly),
    ),
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  searchApi.fetchSearchOptions.mockResolvedValue(makeCatalogOptions());
  searchApi.runSearch.mockResolvedValue({
    items: [{ url: "https://example.com/catalog", name: "Catalog top" }],
    total: 1,
  });
});

describe("mergeSelectedSnapshots", () => {
  test("keeps existing outfit order while appending new personal and catalog selections", () => {
    const existingCatalog: OutfitItemSnapshot = {
      url: "https://example.com/existing",
      source: "from_catalog",
      item: { name: "Existing shirt" },
    };
    const selectedPersonal: OutfitItemSnapshot = {
      url: "wardrobe://42",
      source: "uploaded",
      item: { name: "Personal shirt" },
    };
    const selectedCatalog: OutfitItemSnapshot = {
      url: "https://example.com/bag",
      source: "from_catalog",
      item: { name: "Catalog bag" },
    };

    expect(
      mergeSelectedSnapshots(
        [selectedPersonal, selectedCatalog, existingCatalog],
        [existingCatalog],
      ),
    ).toEqual([existingCatalog, selectedPersonal, selectedCatalog]);
  });

  test("deduplicates by source and URL while preserving the initial item object", () => {
    const staleInitial: OutfitItemSnapshot = {
      url: "https://example.com/bag",
      source: "from_catalog",
      item: { name: "Initial bag" },
    };
    const duplicateSelection: OutfitItemSnapshot = {
      url: "https://example.com/bag",
      source: "from_catalog",
      item: { name: "Selected bag" },
    };

    expect(
      mergeSelectedSnapshots([duplicateSelection], [staleInitial]),
    ).toEqual([staleInitial]);
  });
});

describe("catalog mobile filter state helpers", () => {
  test("keeps mobile catalog filter draft local when closed", async () => {
    const options = makeCatalogOptions();
    const catalogDraftState = createSearchState(null, options.priceRange);
    const editedMobileDraft = {
      ...getCatalogMobileFiltersDraft(catalogDraftState),
      likedOnly: true,
    };

    expect(editedMobileDraft.likedOnly).toBe(true);
    expect(catalogDraftState.likedOnly).toBe(false);
    expect(getCatalogMobileFiltersDraft(catalogDraftState).likedOnly).toBe(
      false,
    );
  });

  test("applies and resets mobile catalog filter payloads", async () => {
    const options = makeCatalogOptions();
    const mobileDraft = {
      ...createSearchState(null, options.priceRange),
      likedOnly: true,
      page: 4,
    };

    const appliedState = getAppliedCatalogSearchState(mobileDraft);
    expect({
      ...serializeDraftState(appliedState, options.priceRange),
      limit: CATALOG_PICKER_PAGE_SIZE,
      persist: false,
    }).toEqual(
      expect.objectContaining({
        likedOnly: true,
        limit: 20,
        page: 1,
        persist: false,
      }),
    );

    const resetState = getResetCatalogSearchState(options);
    expect({
      ...serializeDraftState(resetState, options.priceRange),
      limit: CATALOG_PICKER_PAGE_SIZE,
      persist: false,
    }).toEqual(
      expect.objectContaining({
        likedOnly: false,
        limit: 20,
        page: 1,
        persist: false,
      }),
    );
  });
});

describe("useOutfitAddItemsDialog", () => {
  test("updates the mobile filters draft through the hook callback", () => {
    render(React.createElement(HookHarness));

    fireEvent.click(
      screen.getByRole("button", { name: "change mobile draft" }),
    );

    expect(screen.getByTestId("mobile-liked")).toHaveTextContent("true");
  });
});

describe("useOutfitCatalogPicker", () => {
  test("bootstraps catalog search and applies catalog actions", async () => {
    const { result } = renderHook(() =>
      useOutfitCatalogPicker({
        locale: "en",
        open: true,
        tab: 1,
        t,
      }),
    );

    await waitFor(() =>
      expect(searchApi.fetchSearchOptions).toHaveBeenCalled(),
    );
    expect(searchApi.runSearch).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, persist: false }),
    );
    await waitFor(() => expect(result.current.catalogTotal).toBe(1));
    expect(result.current.visibleCatalogItems).toHaveLength(1);

    await act(async () => {
      await result.current.changeCatalogDraft(
        (current) => ({ ...current, query: "linen" }),
        { submit: true },
      );
    });
    expect(searchApi.runSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: "linen", page: 1 }),
    );

    act(() => {
      result.current.openCatalogFilters();
      result.current.changeCatalogMobileFiltersDraft((current) => ({
        ...current,
        likedOnly: true,
      }));
    });
    expect(result.current.isCatalogFiltersOpen).toBe(true);
    expect(result.current.catalogMobileFiltersDraftState.likedOnly).toBe(true);

    await act(async () => {
      await result.current.applyCatalogSearch({
        ...result.current.catalogMobileFiltersDraftState,
        page: 4,
      });
    });
    expect(searchApi.runSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ likedOnly: true, page: 1 }),
    );

    await act(async () => {
      await result.current.changeCatalogPage(null, 2);
    });
    expect(searchApi.runSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );

    await act(async () => {
      await result.current.clearCatalogQuery();
      await result.current.resetCatalogSearch();
    });
    expect(result.current.isCatalogFiltersOpen).toBe(false);
  });

  test("ignores stale catalog search results from older requests", async () => {
    const slowSearch = createDeferred<{
      items: { name: string; url: string }[];
      total: number;
    }>();
    const fastSearch = createDeferred<{
      items: { name: string; url: string }[];
      total: number;
    }>();
    searchApi.runSearch
      .mockResolvedValueOnce({
        items: [{ url: "https://example.com/initial", name: "Initial" }],
        total: 1,
      })
      .mockImplementationOnce(() => slowSearch.promise)
      .mockImplementationOnce(() => fastSearch.promise);
    const { result } = renderHook(() =>
      useOutfitCatalogPicker({
        locale: "en",
        open: true,
        tab: 1,
        t,
      }),
    );

    await waitFor(() => expect(result.current.catalogTotal).toBe(1));

    let slowAction: Promise<void> = Promise.resolve();
    await act(async () => {
      slowAction = result.current.changeCatalogDraft(
        (current) => ({ ...current, query: "slow" }),
        { submit: true },
      );
      await Promise.resolve();
    });
    let fastAction: Promise<void> = Promise.resolve();
    await act(async () => {
      fastAction = result.current.changeCatalogDraft(
        (current) => ({ ...current, query: "fast" }),
        { submit: true },
      );
      await Promise.resolve();
    });

    await act(async () => {
      fastSearch.resolve({
        items: [{ url: "https://example.com/fast", name: "Fast" }],
        total: 2,
      });
      await fastAction;
    });
    expect(result.current.catalogTotal).toBe(2);
    expect(result.current.visibleCatalogItems).toEqual([
      expect.objectContaining({ name: "Fast" }),
    ]);

    await act(async () => {
      slowSearch.resolve({
        items: [{ url: "https://example.com/slow", name: "Slow" }],
        total: 3,
      });
      await slowAction;
    });

    expect(result.current.catalogTotal).toBe(2);
    expect(result.current.visibleCatalogItems).toEqual([
      expect.objectContaining({ name: "Fast" }),
    ]);
  });

  test("does not close catalog filters after a stale apply request resolves", async () => {
    const slowSearch = createDeferred<{
      items: { name: string; url: string }[];
      total: number;
    }>();
    const fastSearch = createDeferred<{
      items: { name: string; url: string }[];
      total: number;
    }>();
    searchApi.runSearch
      .mockResolvedValueOnce({
        items: [{ url: "https://example.com/initial", name: "Initial" }],
        total: 1,
      })
      .mockImplementationOnce(() => slowSearch.promise)
      .mockImplementationOnce(() => fastSearch.promise);
    const { result } = renderHook(() =>
      useOutfitCatalogPicker({
        locale: "en",
        open: true,
        tab: 1,
        t,
      }),
    );

    await waitFor(() => expect(result.current.catalogTotal).toBe(1));

    act(() => {
      result.current.openCatalogFilters();
    });
    let staleApply: Promise<void> = Promise.resolve();
    await act(async () => {
      staleApply = result.current.applyCatalogSearch({
        ...result.current.catalogMobileFiltersDraftState,
        query: "slow",
      });
      await Promise.resolve();
    });
    let fastAction: Promise<void> = Promise.resolve();
    await act(async () => {
      fastAction = result.current.changeCatalogDraft(
        (current) => ({ ...current, query: "fast" }),
        { submit: true },
      );
      await Promise.resolve();
    });

    await act(async () => {
      fastSearch.resolve({
        items: [{ url: "https://example.com/fast", name: "Fast" }],
        total: 2,
      });
      await fastAction;
    });
    act(() => {
      result.current.openCatalogFilters();
    });
    expect(result.current.isCatalogFiltersOpen).toBe(true);

    await act(async () => {
      slowSearch.resolve({
        items: [{ url: "https://example.com/slow", name: "Slow" }],
        total: 3,
      });
      await staleApply;
    });

    expect(result.current.isCatalogFiltersOpen).toBe(true);
    expect(result.current.catalogTotal).toBe(2);
  });

  test("shows generic catalog error for the current failed search", async () => {
    searchApi.runSearch
      .mockResolvedValueOnce({
        items: [{ url: "https://example.com/initial", name: "Initial" }],
        total: 1,
      })
      .mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() =>
      useOutfitCatalogPicker({
        locale: "en",
        open: true,
        tab: 1,
        t,
      }),
    );

    await waitFor(() => expect(result.current.catalogTotal).toBe(1));

    await act(async () => {
      await result.current.changeCatalogDraft(
        (current) => ({ ...current, query: "error" }),
        { submit: true },
      );
    });

    expect(result.current.catalogStatus).toEqual({
      loading: false,
      error: "errors.generic",
    });
  });

  test("invalidates pending catalog bootstrap when the dialog closes", async () => {
    const optionsRequest =
      createDeferred<ReturnType<typeof makeCatalogOptions>>();
    searchApi.fetchSearchOptions.mockReturnValueOnce(optionsRequest.promise);
    const { rerender } = renderHook(
      ({ open, tab }: { open: boolean; tab: number }) =>
        useOutfitCatalogPicker({
          locale: "en",
          open,
          tab,
          t,
        }),
      { initialProps: { open: true, tab: 1 } },
    );

    rerender({ open: false, tab: 1 });
    await act(async () => {
      optionsRequest.resolve(makeCatalogOptions());
      await optionsRequest.promise;
    });

    expect(searchApi.runSearch).not.toHaveBeenCalled();
  });
});
