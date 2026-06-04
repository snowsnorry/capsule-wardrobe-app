import { afterEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  WardrobeProductMenu,
  WardrobeRemoveConfirmDialog,
} from "./WardrobeProductMenu";

const theme = createTheme();
const translations: Record<string, string> = {
  "actions.cancel": "Cancel",
  "capsule.removeFromMyWardrobe": "Remove from Wardrobe",
  "wardrobe.deleteUploaded": "Delete item",
  "wardrobe.deleteUploadedConfirm": "Delete",
  "wardrobe.deleteUploadedConfirmBody": "Delete uploaded body",
  "wardrobe.deleteUploadedConfirmTitle": "Delete uploaded item?",
  "wardrobe.removeConfirm": "Remove",
  "wardrobe.removeConfirmBody": "Remove body",
  "wardrobe.removeConfirmTitle": "Remove from Wardrobe?",
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

describe("WardrobeProductMenu", () => {
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
      <WardrobeProductMenu
        anchor={createAnchor()}
        item={item}
        t={t}
        onClose={onClose}
        onRequestRemove={onRequestRemove}
      />,
    );

    await user.click(
      screen.getByRole("menuitem", { name: "Remove from Wardrobe" }),
    );

    expect(onClose).toHaveBeenCalled();
    expect(onRequestRemove).toHaveBeenCalledWith(item);
  });

  test("closes the menu without a selected item", async () => {
    const user = userEvent.setup();
    const onRequestRemove = vi.fn();
    const onClose = vi.fn();
    renderWithTheme(
      <WardrobeProductMenu
        anchor={createAnchor()}
        item={null}
        t={t}
        onClose={onClose}
        onRequestRemove={onRequestRemove}
      />,
    );

    await user.click(
      screen.getByRole("menuitem", { name: "Remove from Wardrobe" }),
    );

    expect(onClose).toHaveBeenCalled();
    expect(onRequestRemove).not.toHaveBeenCalled();
  });

  test("uses permanent delete copy for uploaded items", async () => {
    const user = userEvent.setup();
    const onRequestRemove = vi.fn();
    const item = {
      id: "wardrobe-uploaded",
      name: "Uploaded shirt",
      source: "uploaded",
    };
    renderWithTheme(
      <WardrobeProductMenu
        anchor={createAnchor()}
        item={item}
        t={t}
        onClose={vi.fn()}
        onRequestRemove={onRequestRemove}
      />,
    );

    await user.click(screen.getByRole("menuitem", { name: "Delete item" }));

    expect(onRequestRemove).toHaveBeenCalledWith(item);
  });

  test("renders remove action in the mobile context menu overlay", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onRequestRemove = vi.fn();
    const item = {
      id: "wardrobe-1",
      name: "Linen Shirt",
      url: "https://example.com/1",
    };
    renderWithTheme(
      <WardrobeProductMenu
        anchor={createAnchor()}
        item={item}
        presentation="mobile-context"
        t={t}
        onClose={onClose}
        onRequestRemove={onRequestRemove}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "capsule.openProductMenu" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("menuitem", { name: "Remove from Wardrobe" }),
    );

    expect(onClose).toHaveBeenCalled();
    expect(onRequestRemove).toHaveBeenCalledWith(item);
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
      <WardrobeRemoveConfirmDialog
        item={item}
        isLoading
        t={t}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByRole("progressbar", { name: "Remove from Wardrobe" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();

    cleanup();

    renderWithTheme(
      <WardrobeRemoveConfirmDialog
        item={item}
        t={t}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledWith(item);
  });

  test("confirms uploaded item deletion with permanent delete copy", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const item = {
      id: "wardrobe-uploaded",
      name: "Uploaded shirt",
      source: "uploaded",
    };
    renderWithTheme(
      <WardrobeRemoveConfirmDialog
        item={item}
        t={t}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Delete uploaded item?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Delete uploaded body")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledWith(item);
  });
});
