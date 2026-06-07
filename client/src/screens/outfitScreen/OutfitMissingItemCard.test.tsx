import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import OutfitMissingItemCard, {
  getMissingCardActionLabel,
  getMissingCardDetailsSx,
  getMissingCardRootSx,
  getMissingCardSourceLabel,
} from "./OutfitMissingItemCard";

const theme = createTheme();
const entry: OutfitItemSnapshot = {
  url: "wardrobe://missing-upload",
  source: "uploaded",
  item: null,
};
const labels: Record<string, string> = {
  "outfit.itemNotFoundDescription": "This outfit reference no longer resolves.",
  "outfit.itemNotFoundTitle": "Item not found",
  "outfit.openMissingItemActions": "Open missing item actions",
  "outfit.selectItem": "Select",
  "wardrobe.filters.fromCatalog": "Catalog",
  "wardrobe.filters.uploaded": "Uploaded",
};

function t(key: string) {
  return labels[key] || key;
}

function renderCard({
  isMobile = false,
  isSelected = false,
  isSelectionMode = false,
  mobileColumns = 1,
}: Partial<ComponentProps<typeof OutfitMissingItemCard>> = {}) {
  const onItemMenuOpen = vi.fn();
  const onToggleSelected = vi.fn();
  const view = render(
    <ThemeProvider theme={theme}>
      <OutfitMissingItemCard
        entry={entry}
        isMobile={isMobile}
        isSelected={isSelected}
        isSelectionMode={isSelectionMode}
        mobileColumns={mobileColumns}
        onItemMenuOpen={onItemMenuOpen}
        onToggleSelected={onToggleSelected}
        t={t}
      />
    </ThemeProvider>,
  );

  return { ...view, onItemMenuOpen, onToggleSelected };
}

afterEach(() => {
  cleanup();
});

describe("OutfitMissingItemCard", () => {
  test("opens the anchored actions menu without toggling selection", () => {
    const { onItemMenuOpen, onToggleSelected } = renderCard();

    expect(screen.getAllByText("Item not found")).toHaveLength(1);
    expect(
      screen.getByText("This outfit reference no longer resolves."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Uploaded: wardrobe://missing-upload"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open missing item actions" }),
    );

    expect(onToggleSelected).not.toHaveBeenCalled();
    expect(onItemMenuOpen).toHaveBeenCalledTimes(1);
    expect(onItemMenuOpen.mock.calls[0][1]).toEqual(entry);
    expect(onItemMenuOpen.mock.calls[0][2]).toEqual({
      presentation: "anchored",
    });
  });

  test("toggles selection from the card, keyboard, and selection action", () => {
    const { onItemMenuOpen, onToggleSelected } = renderCard({
      isSelected: true,
      isSelectionMode: true,
    });

    const card = screen.getByRole("button", { name: "Item not found" });
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    fireEvent.click(screen.getByRole("button", { name: "Select" }));

    expect(onItemMenuOpen).not.toHaveBeenCalled();
    expect(onToggleSelected).toHaveBeenCalledTimes(4);
    expect(onToggleSelected).toHaveBeenCalledWith(
      "uploaded\u0000wardrobe://missing-upload",
    );
  });

  test("keeps dense mobile card sizing stable", () => {
    const { container } = renderCard({
      isMobile: true,
      isSelected: true,
      isSelectionMode: true,
      mobileColumns: 3,
    });
    const card = container.querySelector(".outfit-missing-card-root");

    expect(card).toHaveAttribute("data-mobile-columns", "3");
    expect(getMissingCardActionLabel({ isSelectionMode: false, t })).toBe(
      "Open missing item actions",
    );
    expect(getMissingCardActionLabel({ isSelectionMode: true, t })).toBe(
      "Select",
    );
    expect(getMissingCardSourceLabel("from_catalog", t)).toBe("Catalog");
    expect(getMissingCardSourceLabel("uploaded", t)).toBe("Uploaded");
    expect(
      getMissingCardRootSx({
        isMobile: true,
        isSelectionMode: false,
        mobileColumns: 3,
      }),
    ).toMatchObject({
      borderRadius: 0,
      boxShadow: "none",
      cursor: "default",
    });
    expect(
      getMissingCardRootSx({
        isMobile: false,
        isSelectionMode: true,
        mobileColumns: 1,
      }),
    ).toMatchObject({
      cursor: "pointer",
    });
    expect(
      getMissingCardDetailsSx({ isMobile: true, mobileColumns: 1 }),
    ).toMatchObject({
      minHeight: 64,
    });
    expect(
      getMissingCardDetailsSx({ isMobile: true, mobileColumns: 3 }),
    ).toMatchObject({
      minHeight: 50,
    });
  });
});
