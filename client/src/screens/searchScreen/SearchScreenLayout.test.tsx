import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../../search/SearchFiltersSidebar", () => ({
  default: ({ onApply, onReset }) => (
    <div>
      <button type="button" onClick={onApply}>
        apply filters
      </button>
      <button type="button" onClick={onReset}>
        reset filters
      </button>
    </div>
  ),
}));
vi.mock("./ProductDetail", () => ({
  default: ({ item, mobileBackAction }) => (
    <div>
      <span>detail {item?.id || "none"}</span>
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

import { SearchScreenDesktop, SearchScreenMobile } from "./SearchScreenLayout";

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
  test("mobile layout wires query and result callbacks", () => {
    const search = createSearch();

    render(<SearchScreenMobile search={search as never} t={(key) => key} />);

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

    render(
      <SearchScreenDesktop
        search={search as never}
        t={(key) => key}
        locale="en"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "apply filters" }));
    fireEvent.click(screen.getByRole("button", { name: "reset filters" }));

    expect(search.applyCurrentQuery).toHaveBeenCalled();
    expect(search.resetSearch).toHaveBeenCalled();
  });
});
