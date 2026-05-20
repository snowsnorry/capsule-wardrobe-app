import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../../search/SearchFiltersSidebar", () => ({
  default: ({ onApply, onReset }) => (
    <div>
      <button type="button" onClick={onReset}>
        reset filters
      </button>
      <button type="button" onClick={onApply}>
        apply filters
      </button>
    </div>
  ),
}));
vi.mock("../../components/productDetail/ProductDetail", () => ({
  default: ({ item, mobileBackAction, onSaveToMyWardrobe }) => (
    <div>
      <span>detail {item?.id || "none"}</span>
      {onSaveToMyWardrobe ? (
        <button type="button" onClick={() => onSaveToMyWardrobe(item)}>
          save detail
        </button>
      ) : null}
      {mobileBackAction ? (
        <button type="button" onClick={mobileBackAction}>
          back detail
        </button>
      ) : null}
    </div>
  ),
}));
vi.mock("./SearchBar", () => ({
  default: ({ onApplyQuery, onClearQuery, onOpenFilters, onQueryChange }) => (
    <div>
      <button type="button" onClick={onOpenFilters}>
        open filters
      </button>
      <button type="button" onClick={onApplyQuery}>
        apply query
      </button>
      <button type="button" onClick={onClearQuery}>
        clear query
      </button>
      <button type="button" onClick={() => onQueryChange("linen")}>
        change query
      </button>
    </div>
  ),
}));
vi.mock("./SearchResultsList", () => ({
  default: ({ onChangePage, onDeleteActiveChip, onSelectResult }) => (
    <div>
      <button type="button" onClick={() => onSelectResult({ id: "item-2" })}>
        select result
      </button>
      <button type="button" onClick={() => onChangePage(2)}>
        page 2
      </button>
      <button
        type="button"
        onClick={() => onDeleteActiveChip({ field: "category", value: "top" })}
      >
        delete chip
      </button>
    </div>
  ),
}));

import {
  SEARCH_DESKTOP_DETAIL_SX,
  SEARCH_DESKTOP_DETAIL_CONTENT_SX,
  SEARCH_DESKTOP_FILTERS_SX,
  SEARCH_DESKTOP_HEADER_SX,
  SEARCH_DESKTOP_LAYOUT_SX,
  SEARCH_DESKTOP_MAIN_SX,
  SEARCH_DESKTOP_RESULTS_SX,
  SearchScreenDesktop,
  SearchScreenMobile,
} from "./SearchScreenLayout";

function createSearch() {
  return {
    activeChips: [],
    applyCurrentQuery: vi.fn(async () => undefined),
    changePage: vi.fn(),
    changeQuery: vi.fn(),
    changeSidebarDraft: vi.fn(),
    clearQuery: vi.fn(async () => undefined),
    deleteActiveChip: vi.fn(async () => undefined),
    draftState: { query: "shirt", page: 1 },
    formattedTotal: "1",
    options: {},
    resetSearch: vi.fn(),
    results: [{ id: "item-1" }],
    selectResult: vi.fn(),
    selectedItem: { id: "item-1" },
    selectedResultId: "item-1",
    setIsFiltersOpen: vi.fn(),
    status: { loading: false, error: "" },
    total: 1,
    totalPages: 2,
  };
}

describe("SearchScreenLayout", () => {
  test("desktop layout mirrors the capsule screen sizing contract", () => {
    expect(SEARCH_DESKTOP_LAYOUT_SX.gridTemplateColumns).toEqual({
      lg: "320px minmax(0, 1fr)",
    });
    expect(SEARCH_DESKTOP_LAYOUT_SX.gap).toEqual({ xs: 3, lg: "40px" });
    expect(SEARCH_DESKTOP_LAYOUT_SX.width).toBe("100%");
    expect(SEARCH_DESKTOP_LAYOUT_SX.height).toBe("100%");
    expect(SEARCH_DESKTOP_LAYOUT_SX.pt).toBe(2);
    expect(SEARCH_DESKTOP_LAYOUT_SX).not.toHaveProperty("pb");

    expect(SEARCH_DESKTOP_FILTERS_SX.maxHeight).toBe("calc(100vh - 32px)");
    expect(SEARCH_DESKTOP_FILTERS_SX.p).toBe(3);
    expect(SEARCH_DESKTOP_MAIN_SX.columnGap).toBe("40px");
    expect(SEARCH_DESKTOP_MAIN_SX.height).toBe("100%");
    expect(SEARCH_DESKTOP_MAIN_SX.width).toBe("100%");
    expect(SEARCH_DESKTOP_MAIN_SX).not.toHaveProperty("maxWidth");
    expect(SEARCH_DESKTOP_HEADER_SX.gridColumn).toBe("1 / 3");
    expect(SEARCH_DESKTOP_HEADER_SX.backgroundColor).toBe("background.default");
    expect(SEARCH_DESKTOP_HEADER_SX.maxWidth).toEqual({ lg: "1240px" });
    expect(SEARCH_DESKTOP_DETAIL_SX.gridRow).toBe("2");
    expect(SEARCH_DESKTOP_DETAIL_SX.overflowY).toBe("auto");
    expect(SEARCH_DESKTOP_DETAIL_SX).not.toHaveProperty("pt");
    expect(SEARCH_DESKTOP_DETAIL_CONTENT_SX.maxWidth).toEqual({
      lg: "780px",
    });
    expect(SEARCH_DESKTOP_DETAIL_CONTENT_SX.mr).toBe("auto");
    expect(SEARCH_DESKTOP_RESULTS_SX.maxWidth).toEqual({ lg: "1240px" });
    expect(SEARCH_DESKTOP_RESULTS_SX.pb).toBe(2);
    expect(SEARCH_DESKTOP_MAIN_SX).not.toHaveProperty("border");
    expect(SEARCH_DESKTOP_MAIN_SX).not.toHaveProperty("borderColor");
    expect(SEARCH_DESKTOP_MAIN_SX).not.toHaveProperty("borderRadius");
    expect(SEARCH_DESKTOP_MAIN_SX).not.toHaveProperty("backgroundColor");
    expect(SEARCH_DESKTOP_MAIN_SX).not.toHaveProperty("p");
  });

  test("mobile layout wires query and result callbacks", () => {
    const search = createSearch();

    render(<SearchScreenMobile search={search as never} t={(key) => key} />);

    expect(screen.getByTestId("search-mobile-body")).toHaveStyle({
      paddingTop: "8px",
    });
    fireEvent.click(screen.getByRole("button", { name: "open filters" }));
    fireEvent.click(screen.getByRole("button", { name: "apply query" }));
    fireEvent.click(screen.getByRole("button", { name: "clear query" }));
    fireEvent.click(screen.getByRole("button", { name: "change query" }));
    fireEvent.click(screen.getByRole("button", { name: "select result" }));
    fireEvent.click(screen.getByRole("button", { name: "page 2" }));
    fireEvent.click(screen.getByRole("button", { name: "delete chip" }));

    expect(search.setIsFiltersOpen).toHaveBeenCalledWith(true);
    expect(search.applyCurrentQuery).toHaveBeenCalled();
    expect(search.clearQuery).toHaveBeenCalled();
    expect(search.changeQuery).toHaveBeenCalledWith("linen");
    expect(search.selectResult).toHaveBeenCalledWith({ id: "item-2" });
    expect(search.changePage).toHaveBeenCalledWith(2);
    expect(search.deleteActiveChip).toHaveBeenCalledWith({
      field: "category",
      value: "top",
    });
  });

  test("desktop layout applies filters and closes the filter panel", async () => {
    const search = createSearch();
    const onSaveToMyWardrobe = vi.fn();

    render(
      <SearchScreenDesktop
        search={search as never}
        t={(key) => key}
        locale="en"
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />,
    );

    expect(screen.queryByText("Catalog: Explore")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "apply filters" }));
    fireEvent.click(screen.getByRole("button", { name: "reset filters" }));
    fireEvent.click(screen.getByRole("button", { name: "save detail" }));

    expect(search.applyCurrentQuery).toHaveBeenCalled();
    expect(search.resetSearch).toHaveBeenCalled();
    expect(onSaveToMyWardrobe).toHaveBeenCalledWith(search.selectedItem);
  });
});
