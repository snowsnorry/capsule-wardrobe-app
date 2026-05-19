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
  default: ({ onApply }) => (
    <button type="button" onClick={onApply}>
      apply filters
    </button>
  ),
}));
vi.mock("../../components/productDetail/ProductDetail", () => ({
  default: ({ item }) => (
    <div>
      <span>detail {item?.id || "none"}</span>
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
            "actions.close": "Close",
            "capsule.saveToMyWardrobe": "Save to My Wardrobe",
            "filters.title": "Filters",
            "search.productActions": "Product actions",
            "search.productDetailsTitle": "Product details",
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

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(search.setIsDetailOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Product actions" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Save to My Wardrobe" }),
    );
    expect(onSaveToMyWardrobe).toHaveBeenCalledWith(search.selectedItem);
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
      .getByText("apply filters")
      .closest(".MuiDialogContent-root");

    expect(getComputedStyle(header!).paddingTop).toBe("12px");
    expect(getComputedStyle(header!).paddingBottom).toBe("8px");
    expect(getComputedStyle(header!).backgroundColor).toBe("rgb(21, 32, 31)");
    expect(getComputedStyle(header!).borderBottomWidth).toBe("");
    expect(getComputedStyle(content!).backgroundColor).toBe("rgb(16, 24, 23)");
    expect(getComputedStyle(content!).overflowY).toBe("auto");
    expect(getComputedStyle(content!).paddingTop).toBe("8px");
  });
});
