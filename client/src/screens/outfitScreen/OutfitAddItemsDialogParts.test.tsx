import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { ActiveFilterChip } from "../../search/searchState";
import {
  CatalogResultsHeader,
  DialogLoadingDivider,
  OutfitAddItemsGrid,
} from "./OutfitAddItemsDialogParts";

vi.mock("../../components/ProfileFiltersAnchorPickerCard", () => ({
  default: ({
    item,
    onToggle,
    selected,
    selectionFull,
  }: {
    item: { name?: string | null };
    onToggle: () => void;
    selected: boolean;
    selectionFull: boolean;
  }) => (
    <button
      data-selected={String(selected)}
      disabled={selectionFull}
      type="button"
      onClick={onToggle}
    >
      {item.name}
    </button>
  ),
}));

const t = (key: string, params?: Record<string, unknown>) =>
  key === "search.resultsCount" ? `Results ${params?.count}` : key;

describe("OutfitAddItemsDialogParts", () => {
  test("renders loading divider and active filter chips", () => {
    const onDeleteChip = vi.fn();
    const chip: ActiveFilterChip = {
      field: "category",
      key: "category:top",
      label: "Category",
      value: "top",
    };

    render(
      <>
        <DialogLoadingDivider loading />
        <CatalogResultsHeader
          activeChips={[chip]}
          formattedTotal="42"
          t={t}
          onDeleteChip={onDeleteChip}
        />
      </>,
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Results 42")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("CancelIcon"));
    expect(onDeleteChip).toHaveBeenCalledWith(chip);
  });

  test("renders empty and normal picker states", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <OutfitAddItemsGrid
        existingKeys={new Set()}
        gridSx={{ display: "grid" }}
        items={[]}
        locale="en"
        selectedKeys={new Set()}
        source="personal"
        t={t}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText("capsule.anchors.empty")).toBeInTheDocument();

    rerender(
      <OutfitAddItemsGrid
        existingKeys={new Set()}
        gridSx={{ display: "grid" }}
        items={[{ id: "1", name: "Linen shirt", source: "uploaded" }]}
        locale="en"
        selectedKeys={new Set(["uploaded\u0000wardrobe://1"])}
        source="personal"
        t={t}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByRole("button", { name: "Linen shirt" })).toHaveAttribute(
      "data-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Linen shirt" }));
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ source: "uploaded", url: "wardrobe://1" }),
    );
  });

  test("virtualizes large personal picker lists", () => {
    const scrollContainer = document.createElement("div");
    Object.defineProperties(scrollContainer, {
      clientHeight: { configurable: true, value: 520 },
      scrollHeight: { configurable: true, value: 1200 },
      scrollTop: { configurable: true, value: 0 },
    });
    const scrollContainerRef = { current: scrollContainer };
    const items = Array.from({ length: 70 }, (_, index) => ({
      id: String(index + 1),
      name: `Item ${index + 1}`,
      source: "uploaded",
    }));

    render(
      <OutfitAddItemsGrid
        existingKeys={new Set(["uploaded\u0000wardrobe://1"])}
        gridSx={{ display: "grid", gap: 1 }}
        items={items}
        locale="en"
        maxSelectedReached
        scrollContainerRef={scrollContainerRef}
        selectedKeys={new Set()}
        source="personal"
        t={t}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("virtual-add-items-personal-grid"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Item 1" })).toBeDisabled();
  });
});
