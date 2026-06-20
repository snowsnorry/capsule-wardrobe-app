import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";
import WardrobeGrid from "./WardrobeGrid";

vi.mock("../components/ClothingCard", () => ({
  default: ({ item }: { item: MainScreenItem }) => (
    <div>{String(item.name || item.id || item.wardrobeId || "")}</div>
  ),
}));

vi.mock("../components/ClothingGridPlaceholder", () => ({
  default: ({ count }: { count: number }) => (
    <div data-testid="wardrobe-placeholder">{count}</div>
  ),
  buildClothingGridGap: () => 2,
  buildClothingGridTemplateColumns: () => "repeat(2, minmax(0, 1fr))",
}));

describe("WardrobeGrid", () => {
  test("highlights personal items by id and wardrobeId without URL fallback", () => {
    render(
      <WardrobeGrid
        highlightedKeys={["W2", "catalog-1"]}
        isLoading={false}
        isOverlay={false}
        items={[
          {
            id: "catalog-1",
            name: "Catalog item",
            url: "https://example.com/catalog",
          },
          {
            name: "Wardrobe id item",
            wardrobeId: "W2",
            url: "https://example.com/uploaded",
          },
          {
            name: "URL only item",
            url: "https://example.com/url-only",
          },
        ]}
        mobileColumns={2}
        onProductClick={vi.fn()}
        onProductMenuOpen={vi.fn()}
        t={(key) => key}
      />,
    );

    expect(
      screen.getAllByTestId("personal-items-report-item-highlighted"),
    ).toHaveLength(2);
    expect(screen.getByText("URL only item").parentElement).not.toHaveAttribute(
      "data-testid",
      "personal-items-report-item-highlighted",
    );
  });
});
