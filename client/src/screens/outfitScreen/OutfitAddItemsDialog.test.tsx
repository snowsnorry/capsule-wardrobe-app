import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  EMPTY_SEARCH_OPTIONS,
  createSearchState,
} from "../../search/searchState";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import { AddItemsDialog, AddItemsDialogSurface } from "./OutfitAddItemsDialog";
import {
  AddItemsCatalogPanel,
  AddItemsDialogSelectionSummary,
} from "./OutfitAddItemsDialogPanels";
import { CatalogResultsHeader } from "./OutfitAddItemsDialogParts";
import type { OutfitAddItemsDialogModel } from "./useOutfitAddItemsDialog";

const personalItemsApi = vi.hoisted(() => ({
  fetchPersonalItems: vi.fn(),
}));
const searchApi = vi.hoisted(() => ({
  fetchSearchOptions: vi.fn(),
  runSearch: vi.fn(),
}));

vi.mock("../../api/personalItems", () => personalItemsApi);
vi.mock("../../api/search", () => searchApi);

const theme = createTheme();

function t(key: string, params?: Record<string, unknown>) {
  const labels: Record<string, string> = {
    "actions.add": "Add",
    "actions.cancel": "Cancel",
    "actions.close": "Close",
    "capsule.anchors.empty": "No items",
    "filters.apply": "Apply",
    "filters.open": "Open filters",
    "filters.reset": "Reset",
    "filters.title": "Filters",
    "outfit.addItems": "Add items",
    "outfit.catalog": "Catalog",
    "outfit.catalogSelected": `${params?.count ?? 0} catalog`,
    "outfit.noneSelected": "No items selected",
    "outfit.personalItems": "Personal items",
    "outfit.personalSelected": `${params?.count ?? 0} personal`,
    "search.resultsCount": `${params?.count ?? 0} results`,
  };
  return labels[key] || key;
}

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{element}</ThemeProvider>);
}

function makeModel(
  overrides: Partial<OutfitAddItemsDialogModel> = {},
): OutfitAddItemsDialogModel {
  const draftState = createSearchState(null, EMPTY_SEARCH_OPTIONS.priceRange);
  return {
    catalogActiveChips: [],
    catalogCount: 0,
    catalogDraftState: draftState,
    catalogMobileFiltersDraftState: draftState,
    catalogOptions: EMPTY_SEARCH_OPTIONS,
    catalogStatus: { loading: false, error: "" },
    catalogTotal: 45,
    changeCatalogDraft: vi.fn(),
    changeCatalogMobileFiltersDraft: vi.fn(),
    changeCatalogPage: vi.fn(),
    clearCatalogQuery: vi.fn(),
    deleteCatalogChip: vi.fn(),
    existingKeys: new Set(),
    isCatalogFiltersOpen: false,
    isCatalogMobile: false,
    likedOnly: false,
    maxSelectedReached: false,
    openCatalogFilters: vi.fn(),
    personalCount: 0,
    personalLoading: false,
    resetCatalogSearch: vi.fn(),
    selected: [],
    selectedKeys: new Set(),
    setCatalogDraftState: vi.fn(),
    setIsCatalogFiltersOpen: vi.fn(),
    setLikedOnly: vi.fn(),
    setSourceFilter: vi.fn(),
    setTab: vi.fn(),
    setTypeFilter: vi.fn(),
    sourceFilter: "all",
    tab: 1,
    typeFilter: "all",
    typeOptions: [],
    visibleCatalogItems: [],
    visiblePersonalItems: [],
    applyCatalogSearch: vi.fn(),
    ...overrides,
  } as OutfitAddItemsDialogModel;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AddItemsDialog", () => {
  test("renders pattern swatches in catalog active filter chips", () => {
    renderWithTheme(
      <CatalogResultsHeader
        activeChips={[
          {
            key: "pattern:solid,argyle",
            field: "pattern",
            values: ["solid", "argyle"],
            optionGroup: "patterns",
            title: "Pattern",
            label: "Pattern: Solid, Argyle",
            valueLabels: ["Solid", "Argyle"],
          },
        ]}
        formattedTotal="12"
        onDeleteChip={vi.fn()}
        t={t}
      />,
    );

    const chipRoot = screen.getByTestId("active-filter-chip-pattern");
    expect(
      chipRoot.querySelector('[data-pattern-swatch="solid"]'),
    ).not.toBeNull();
    const emptySlot = chipRoot.querySelector(
      '[data-pattern-swatch-empty="argyle"]',
    );
    expect(emptySlot).not.toBeNull();
    expect(emptySlot).toHaveStyle({ width: "18px", height: "18px" });
  });

  test("renders a fullscreen dialog and submits the selected initial items", () => {
    personalItemsApi.fetchPersonalItems.mockResolvedValue({ items: [] });
    const selected: OutfitItemSnapshot = {
      source: "uploaded",
      url: "wardrobe://42",
      item: { name: "Personal shirt" },
    };
    const onAdd = vi.fn();
    const onClose = vi.fn();

    renderWithTheme(
      <AddItemsDialog
        existingItems={[]}
        initialItems={[selected]}
        locale="en"
        fullScreenOverride
        open
        onAdd={onAdd}
        onClose={onClose}
        t={t}
      />,
    );

    expect(screen.getByRole("dialog", { name: /Add items/ })).toHaveClass(
      "MuiDialog-paperFullScreen",
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onAdd).toHaveBeenCalledWith([selected]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("wires catalog mobile filter dialog callbacks through the surface", () => {
    const setIsCatalogFiltersOpen = vi.fn();
    const applyCatalogSearch = vi.fn();
    const resetCatalogSearch = vi.fn();
    const model = makeModel({
      applyCatalogSearch,
      catalogMobileFiltersDraftState: createSearchState(
        { likedOnly: true },
        EMPTY_SEARCH_OPTIONS.priceRange,
      ),
      isCatalogFiltersOpen: true,
      isCatalogMobile: true,
      resetCatalogSearch,
      setIsCatalogFiltersOpen,
    });

    renderWithTheme(
      <AddItemsDialogSurface
        allowEmptySelection
        existingItems={[]}
        fullScreen
        fullScreenOverride
        initialItems={[]}
        locale="en"
        maxSelected={null}
        model={model}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        open
        t={t}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(setIsCatalogFiltersOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(applyCatalogSearch).toHaveBeenCalledWith(
      model.catalogMobileFiltersDraftState,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Reset" }).at(-1)!);
    expect(resetCatalogSearch).toHaveBeenCalledTimes(1);
  });
});

describe("AddItemsDialogSelectionSummary", () => {
  test("renders empty and mixed source summaries", () => {
    const { rerender } = renderWithTheme(
      <AddItemsDialogSelectionSummary
        catalogCount={0}
        personalCount={0}
        t={t}
      />,
    );
    expect(screen.getByText("No items selected")).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <AddItemsDialogSelectionSummary
          catalogCount={2}
          personalCount={1}
          t={t}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText("1 personal · 2 catalog")).toBeInTheDocument();
  });
});

describe("AddItemsCatalogPanel", () => {
  test("renders catalog errors and pagination controls", () => {
    const model = makeModel({
      catalogStatus: { loading: false, error: "Catalog failed" },
      catalogTotal: 45,
    });

    renderWithTheme(
      <AddItemsCatalogPanel
        formattedTotal="45"
        locale="en"
        model={model}
        totalPages={3}
        t={t}
      />,
    );

    expect(screen.getByText("45 results")).toBeInTheDocument();
    expect(screen.getByText("Catalog failed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to page 2" }),
    ).toBeInTheDocument();
  });
});
