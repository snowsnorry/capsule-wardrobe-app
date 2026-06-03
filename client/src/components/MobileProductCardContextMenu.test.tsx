import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import MobileProductCardContextMenu from "./MobileProductCardContextMenu";
import type { ClothingCardItem } from "./ClothingCardTypes";

vi.mock("../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const theme = createTheme();

const item: ClothingCardItem = {
  id: "item-1",
  name: "Navy relaxed shirt",
  brand: "E2E Studio",
  category: "top",
  imageUrl: "https://example.com/navy-shirt.jpg",
  url: "https://example.com/products/navy-shirt",
};

function renderMenu() {
  return render(
    <ThemeProvider theme={theme}>
      <MobileProductCardContextMenu
        actions={<button type="button">Action</button>}
        item={item}
        label="Navy relaxed shirt"
        open
        onClose={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe("MobileProductCardContextMenu", () => {
  afterEach(() => {
    cleanup();
  });

  test("suppresses the native browser context menu inside the preview card", () => {
    const { container } = renderMenu();

    expect(screen.getByRole("dialog", { name: "Navy relaxed shirt" }));
    const previewCard = container.ownerDocument.querySelector(
      ".wardrobe-card-root",
    );
    expect(previewCard).toBeInstanceOf(HTMLElement);
    const event = createEvent.contextMenu(previewCard as HTMLElement);
    fireEvent(previewCard as HTMLElement, event);

    expect(event.defaultPrevented).toBe(true);
  });
});
