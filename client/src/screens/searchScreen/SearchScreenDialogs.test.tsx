import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { createAppTheme } from "../../theme";

vi.mock("../../search/SearchFiltersSidebar", () => ({
  default: ({ onApply, showFooterActions = true }) => (
    <div data-testid="search-filters-body">
      filter body
      {showFooterActions ? (
        <button type="button" onClick={onApply}>
          apply filters
        </button>
      ) : null}
      <button
        type="button"
        data-testid="search-filters-body-apply"
        onClick={onApply}
      >
        body apply callback
      </button>
    </div>
  ),
}));
vi.mock("../../components/productDetail/ProductDetail", () => ({
  default: ({ item, fallbackToLargestThumbnail, onSetItemLike }) => (
    <div data-thumbnail-fallback={fallbackToLargestThumbnail || undefined}>
      <span>detail {item?.id || "none"}</span>
      {onSetItemLike ? (
        <button type="button">body product actions</button>
      ) : null}
    </div>
  ),
}));

import SearchScreenDialogs from "./SearchScreenDialogs";

afterEach(() => {
  cleanup();
});

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

function getFilterFooterApplyButton() {
  const filterDialog = screen.getByText("Filters").closest('[role="dialog"]');
  const footer = filterDialog?.querySelector(".MuiDialogActions-root");
  const applyButton = Array.from(footer?.querySelectorAll("button") || []).find(
    (button) => button.textContent === "Apply",
  );

  if (!applyButton) {
    throw new Error("Apply button not found in filters footer");
  }

  return applyButton;
}

describe("SearchScreenDialogs", () => {
  test("applies filters, closes filters, and closes product detail", async () => {
    const search = createSearch();
    const onSaveToPersonalItems = vi.fn();

    render(
      <SearchScreenDialogs
        search={search as never}
        t={(key) =>
          ({
            "capsule.closeFilters": "Close filters",
            "actions.close": "Close",
            "capsule.saveToPersonalItems": "Save to Personal items",
            "filters.apply": "Apply",
            "filters.reset": "Reset",
            "filters.title": "Filters",
            "search.productActions": "Product actions",
            "search.productDetailsTitle": "Product details",
          })[key] || key
        }
        locale="en"
        onSaveToPersonalItems={onSaveToPersonalItems}
      />,
    );

    fireEvent.click(getFilterFooterApplyButton());
    expect(screen.getByText("detail item-1").parentElement).toHaveAttribute(
      "data-thumbnail-fallback",
      "true",
    );
    await waitFor(() => {
      expect(search.applyCurrentQuery).toHaveBeenCalled();
    });
    expect(search.setIsFiltersOpen).toHaveBeenCalledWith(false);

    fireEvent.click(
      document.querySelector("[aria-label='Close filters']") as HTMLElement,
    );
    expect(search.setIsFiltersOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(search.setIsDetailOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Product actions" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Save to Personal items" }),
    );
    expect(onSaveToPersonalItems).toHaveBeenCalledWith(search.selectedItem);
  });

  test("keeps mobile product actions only in the dialog header", () => {
    const search = createSearch();

    render(
      <SearchScreenDialogs
        search={search as never}
        t={(key) =>
          ({
            "actions.close": "Close",
            "capsule.closeFilters": "Close filters",
            "filters.apply": "Apply",
            "filters.reset": "Reset",
            "filters.title": "Filters",
            "search.productActions": "Product actions",
            "search.productDetailsTitle": "Product details",
          })[key] || key
        }
        locale="en"
        onSetItemLike={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: "Product actions" }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "body product actions" }),
    ).not.toBeInTheDocument();
  });

  test("keeps filter body apply callback wired after moving actions to the footer", async () => {
    const search = createSearch();

    render(
      <SearchScreenDialogs
        search={search as never}
        t={(key) =>
          ({
            "capsule.closeFilters": "Close filters",
            "actions.close": "Close",
            "filters.apply": "Apply",
            "filters.reset": "Reset",
            "filters.title": "Filters",
            "search.productDetailsTitle": "Product details",
          })[key] || key
        }
        locale="en"
      />,
    );

    fireEvent.click(screen.getByTestId("search-filters-body-apply"));
    await waitFor(() => {
      expect(search.applyCurrentQuery).toHaveBeenCalled();
    });
    expect(search.setIsFiltersOpen).toHaveBeenCalledWith(false);
  });

  test("uses capsule-sized filter header surfaces in dark mode", () => {
    const search = createSearch();
    const theme = createAppTheme("dark");

    render(
      <ThemeProvider theme={theme}>
        <SearchScreenDialogs
          search={search as never}
          t={(key) =>
            ({
              "capsule.closeFilters": "Close filters",
              "actions.close": "Close",
              "filters.apply": "Apply",
              "filters.reset": "Reset",
              "filters.title": "Filters",
              "search.productDetailsTitle": "Product details",
            })[key] || key
          }
          locale="en"
        />
      </ThemeProvider>,
    );

    const header = screen.getByText("Filters").closest(".MuiDialogTitle-root");
    const content = screen
      .getByTestId("search-filters-body")
      .closest(".MuiDialogContent-root");
    const footer = getFilterFooterApplyButton().closest(
      ".MuiDialogActions-root",
    );

    expect(getComputedStyle(header!).paddingTop).toBe("12px");
    expect(getComputedStyle(header!).paddingBottom).toBe("8px");
    expect(getComputedStyle(header!).backgroundColor).toBe("rgb(21, 32, 31)");
    expect(getComputedStyle(header!).borderBottomStyle).toBe("none");
    expect(getComputedStyle(content!).backgroundColor).toBe("rgb(16, 24, 23)");
    expect(getComputedStyle(content!).overflowY).toBe("auto");
    expect(getComputedStyle(content!).paddingTop).toBe("8px");
    expect(footer).not.toBeNull();
    expect(content!.contains(footer)).toBe(false);
    expect(getComputedStyle(footer!).justifyContent).toBe("flex-end");
    const footerButtons = Array.from(footer!.querySelectorAll("button"));
    const resetButton = footerButtons.find(
      (button) => button.textContent === "Reset",
    );
    const applyButton = footerButtons.find(
      (button) => button.textContent === "Apply",
    );
    expect(resetButton).toBeDefined();
    expect(applyButton).toBeDefined();
    expect(
      resetButton!.compareDocumentPosition(applyButton!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(getComputedStyle(footer!).backgroundColor).toBe("rgb(21, 32, 31)");
  });
});
