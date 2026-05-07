import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SearchBar from "./SearchBar";

const t = (key: string) => {
  const labels: Record<string, string> = {
    "filters.open": "Open filters",
    "search.clear": "Clear search",
    "search.placeholder": "Search products",
  };
  return labels[key] ?? key;
};

afterEach(() => {
  cleanup();
});

describe("SearchBar", () => {
  test("applies query on enter and blur without applying during typing", () => {
    const onQueryChange = vi.fn();
    const onApplyQuery = vi.fn();

    render(
      <SearchBar
        isMobile={false}
        query="linen"
        t={t}
        onOpenFilters={vi.fn()}
        onQueryChange={onQueryChange}
        onApplyQuery={onApplyQuery}
        onClearQuery={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Search products");
    fireEvent.change(input, { target: { value: "blue cardigan" } });
    expect(onQueryChange).toHaveBeenCalledWith("blue cardigan");
    expect(onApplyQuery).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onApplyQuery).toHaveBeenCalledTimes(2);
  });

  test("renders mobile filter and clear controls", () => {
    const onOpenFilters = vi.fn();
    const onClearQuery = vi.fn();

    render(
      <SearchBar
        isMobile
        query="linen"
        t={t}
        onOpenFilters={onOpenFilters}
        onQueryChange={vi.fn()}
        onApplyQuery={vi.fn()}
        onClearQuery={onClearQuery}
      />,
    );

    fireEvent.click(screen.getByLabelText("Open filters"));
    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
    expect(onClearQuery).toHaveBeenCalledTimes(1);
  });
});
