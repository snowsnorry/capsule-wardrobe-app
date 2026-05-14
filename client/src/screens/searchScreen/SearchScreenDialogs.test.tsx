import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../search/SearchFiltersSidebar", () => ({
  default: ({ onApply }) => (
    <button type="button" onClick={onApply}>
      apply filters
    </button>
  ),
}));
vi.mock("./ProductDetail", () => ({
  default: ({ item, mobileBackAction, onSaveToMyWardrobe }) => (
    <div>
      <span>detail {item?.id || "none"}</span>
      <button type="button" onClick={() => onSaveToMyWardrobe(item)}>
        save detail
      </button>
      <button type="button" onClick={mobileBackAction}>
        close detail
      </button>
    </div>
  ),
}));

import SearchScreenDialogs from "./SearchScreenDialogs";

function createSearch() {
  return {
    applyCurrentQuery: vi.fn(async () => undefined),
    changeSidebarDraft: vi.fn(),
    draftState: {},
    isDetailOpen: true,
    isFiltersOpen: true,
    options: {},
    resetSearch: vi.fn(),
    selectedItem: { id: "item-1" },
    setIsDetailOpen: vi.fn(),
    setIsFiltersOpen: vi.fn(),
    status: { loading: false, error: "" },
  };
}

describe("SearchScreenDialogs", () => {
  test("applies filters, closes filters, and closes product detail", async () => {
    const search = createSearch();
    const onSaveToMyWardrobe = vi.fn();

    render(
      <SearchScreenDialogs
        search={search as never}
        t={(key) =>
          ({
            "capsule.closeFilters": "Close filters",
            "filters.title": "Filters",
          })[key] || key
        }
        locale="en"
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />,
    );

    fireEvent.click(screen.getByText("apply filters"));
    await waitFor(() => {
      expect(search.applyCurrentQuery).toHaveBeenCalled();
    });
    expect(search.setIsFiltersOpen).toHaveBeenCalledWith(false);

    fireEvent.click(
      document.querySelector("[aria-label='Close filters']") as HTMLElement,
    );
    expect(search.setIsFiltersOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "close detail" }));
    expect(search.setIsDetailOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "save detail" }));
    expect(onSaveToMyWardrobe).toHaveBeenCalledWith(search.selectedItem);
  });
});
