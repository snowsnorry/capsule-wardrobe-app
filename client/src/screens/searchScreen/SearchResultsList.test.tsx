import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchResultsList from "./SearchResultsList";

const t = (key: string, params?: Record<string, unknown>) => {
  const labels: Record<string, string> = {
    "search.empty": "No results",
    "search.noBrand": "No brand",
    "search.untitled": "Untitled",
    "wardrobe.likedBadge": "Liked",
    "wardrobe.savedBadge": "Saved",
  };
  if (key === "search.resultsCount") {
    return `${params?.count} results`;
  }
  return labels[key] ?? key;
};

const baseProps = {
  isMobile: false,
  t,
  formattedTotal: "55",
  status: { loading: false, error: "" },
  activeChips: [],
  results: [
    {
      id: "1",
      name: "Linen Shirt",
      brand: "UNIQLO",
      audience: "all",
      isLiked: true,
      isSavedToWardrobe: true,
    },
    { id: "2", name: "Wool Trousers", brand: "COS", audience: "woman" },
  ],
  selectedResultId: "1",
  total: 55,
  totalPages: 2,
  page: 1,
  onDeleteActiveChip: vi.fn(),
  onSelectResult: vi.fn(),
  onChangePage: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SearchResultsList", () => {
  test("renders result count, pagination, and unisex suffix only for all-audience items", () => {
    render(<SearchResultsList {...baseProps} />);

    expect(screen.getByText("55 results")).toBeInTheDocument();
    expect(screen.getByText("Linen Shirt")).toBeInTheDocument();
    expect(screen.getByText("unisex")).toBeInTheDocument();
    expect(screen.getByLabelText("Liked")).toBeInTheDocument();
    expect(screen.getByLabelText("Saved")).toBeInTheDocument();
    const titleHtml = screen.getByText("Linen Shirt").closest("p")?.innerHTML;
    expect(titleHtml?.indexOf("catalog-result-liked-icon")).toBeLessThan(
      titleHtml?.indexOf("catalog-result-saved-icon") ?? 0,
    );
    expect(titleHtml?.indexOf("catalog-result-saved-icon")).toBeLessThan(
      titleHtml?.indexOf("Linen Shirt") ?? 0,
    );
    expect(screen.getByText("Wool Trousers")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("button")
        .some((button) => button.textContent === "2"),
    ).toBe(true);
  });

  test("selects results and deletes active chips", () => {
    const onDeleteActiveChip = vi.fn();
    const onSelectResult = vi.fn();
    const chip = {
      key: "brand:uniqlo",
      field: "brand" as const,
      values: ["uniqlo"],
      label: "Brand: UNIQLO",
    };

    render(
      <SearchResultsList
        {...baseProps}
        activeChips={[chip]}
        onDeleteActiveChip={onDeleteActiveChip}
        onSelectResult={onSelectResult}
      />,
    );

    fireEvent.click(screen.getByText("Wool Trousers"));
    expect(onSelectResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: "2" }),
    );

    const chipRoot = screen.getByText("Brand: UNIQLO").closest(".MuiChip-root");
    expect(chipRoot).not.toBeNull();
    fireEvent.click(within(chipRoot as HTMLElement).getByTestId("CancelIcon"));
    expect(onDeleteActiveChip).toHaveBeenCalledWith(chip);
  });

  test("renders pattern swatches in active filter chips", () => {
    const patternChip = {
      key: "pattern:solid,argyle",
      field: "pattern" as const,
      values: ["solid", "argyle"],
      optionGroup: "patterns",
      title: "Pattern",
      label: "Pattern: Solid, Argyle",
      valueLabels: ["Solid", "Argyle"],
    };

    render(<SearchResultsList {...baseProps} activeChips={[patternChip]} />);

    const chipRoot = screen.getByTestId("active-filter-chip-pattern");
    expect(chipRoot).toHaveTextContent("Pattern:Solid,Argyle");
    expect(
      chipRoot.querySelector('[data-pattern-swatch="solid"]'),
    ).not.toBeNull();
    const argyleSwatch = chipRoot.querySelector(
      '[data-pattern-swatch="argyle"]',
    );
    expect(argyleSwatch).not.toBeNull();
    expect(argyleSwatch).toHaveStyle({ width: "20px", height: "20px" });
  });

  test("keeps custom result rows keyboard operable with a visible focus style", async () => {
    const user = userEvent.setup();
    const onSelectResult = vi.fn();

    render(
      <SearchResultsList {...baseProps} onSelectResult={onSelectResult} />,
    );

    const resultRow = screen.getByRole("button", { name: /Wool Trousers/ });
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");

    expect(resultRow).toHaveFocus();
    expect(onSelectResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: "2" }),
    );
    expect(
      Array.from(document.head.querySelectorAll("style")).some((style) =>
        style.textContent?.includes("inset 0 0 0 2px"),
      ),
    ).toBe(true);
  });

  test("renders empty state when not loading", () => {
    render(
      <SearchResultsList
        {...baseProps}
        formattedTotal="0"
        results={[]}
        total={0}
        totalPages={1}
      />,
    );

    expect(screen.getByText("0 results")).toBeInTheDocument();
    expect(screen.getByText("No results")).toBeInTheDocument();
  });
});
