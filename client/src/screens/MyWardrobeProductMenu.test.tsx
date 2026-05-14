import { afterEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  MyWardrobeProductMenu,
  MyWardrobeRemoveConfirmDialog,
} from "./MyWardrobeProductMenu";

const theme = createTheme();
const translations: Record<string, string> = {
  "actions.cancel": "Cancel",
  "capsule.removeFromMyWardrobe": "Remove from My Wardrobe",
  "myWardrobe.removeConfirm": "Remove",
  "myWardrobe.removeConfirmBody": "Remove body",
  "myWardrobe.removeConfirmTitle": "Remove from My Wardrobe?",
};
const t = (key: string) => translations[key] || key;

function renderWithTheme(children: ReactNode) {
  return render(<ThemeProvider theme={theme}>{children}</ThemeProvider>);
}

function createAnchor() {
  const anchor = document.createElement("button");
  document.body.append(anchor);
  return anchor;
}

describe("MyWardrobeProductMenu", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  test("requests removal for the selected menu item", async () => {
    const user = userEvent.setup();
    const onRequestRemove = vi.fn();
    const onClose = vi.fn();
    const item = {
      id: "wardrobe-1",
      name: "Linen Shirt",
      url: "https://example.com/1",
    };
    renderWithTheme(
      <MyWardrobeProductMenu
        anchor={createAnchor()}
        item={item}
        t={t}
        onClose={onClose}
        onRequestRemove={onRequestRemove}
      />,
    );

    await user.click(
      screen.getByRole("menuitem", { name: "Remove from My Wardrobe" }),
    );

    expect(onClose).toHaveBeenCalled();
    expect(onRequestRemove).toHaveBeenCalledWith(item);
  });

  test("closes the menu without a selected item", async () => {
    const user = userEvent.setup();
    const onRequestRemove = vi.fn();
    const onClose = vi.fn();
    renderWithTheme(
      <MyWardrobeProductMenu
        anchor={createAnchor()}
        item={null}
        t={t}
        onClose={onClose}
        onRequestRemove={onRequestRemove}
      />,
    );

    await user.click(
      screen.getByRole("menuitem", { name: "Remove from My Wardrobe" }),
    );

    expect(onClose).toHaveBeenCalled();
    expect(onRequestRemove).not.toHaveBeenCalled();
  });

  test("confirms or cancels removal in the dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const item = {
      id: "wardrobe-1",
      name: "Linen Shirt",
      url: "https://example.com/1",
    };
    renderWithTheme(
      <MyWardrobeRemoveConfirmDialog
        item={item}
        t={t}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledWith(item);
  });
});
