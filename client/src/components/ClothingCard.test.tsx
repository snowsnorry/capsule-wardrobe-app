import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";

vi.mock("../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}));

import ClothingCard from "./ClothingCard";

const theme = createTheme();

const item: ComponentProps<typeof ClothingCard>["item"] = {
  id: "item-1",
  name: "Red Jacket",
  category: "outerwear",
  image_url: "https://example.com/red-jacket.jpg",
  url: "https://example.com/products/red-jacket"
};

function renderCard(props: Partial<ComponentProps<typeof ClothingCard>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ClothingCard item={item} {...props} />
    </ThemeProvider>
  );
}

describe("ClothingCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("calls onToggleSelected and stops bubbling when the toggle button is clicked", async () => {
    const onToggleSelected = vi.fn();
    const onParentClick = vi.fn();

    render(
      <ThemeProvider theme={theme}>
        <div onClick={onParentClick}>
          <ClothingCard
            item={item}
            isSelectable
            isMobile
            onToggleSelected={onToggleSelected}
          />
        </div>
      </ThemeProvider>
    );

    const toggleButton = screen.getByRole("button", { name: "main.partialRegenerateToggle" });
    fireEvent.click(toggleButton);

    expect(onToggleSelected).toHaveBeenCalledTimes(1);
    expect(onToggleSelected).toHaveBeenCalledWith(item);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  test("keeps the toggle hidden on desktop until selected but shows it on mobile", () => {
    const { container, rerender } = renderCard({ isSelectable: true });
    const toggleButton = container.querySelector("button");

    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).not.toBeVisible();

    rerender(
      <ThemeProvider theme={theme}>
        <ClothingCard item={item} isSelectable isMobile />
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: "main.partialRegenerateToggle" })).toBeVisible();
  });

  test("renders an outbound link with the product image and attributes", () => {
    renderCard();

    const link = screen.getByRole("link", { name: /Red Jacket/ });
    const image = screen.getByRole("img", { name: item.name ?? "" });

    expect(link).toHaveAttribute("href", item.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(image).toHaveAttribute("src", item.image_url);
    expect(image).toHaveAttribute("alt", item.name);
  });

  test("drops unsafe product and image urls", () => {
    renderCard({
      item: {
        ...item,
        url: "javascript:alert(1)",
        image_url: "data:text/html,<script>alert(1)</script>"
      }
    });

    expect(screen.queryByRole("link", { name: /Red Jacket/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: item.name ?? "" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Red Jacket").length).toBeGreaterThan(0);
  });

  test("appends unisex suffix for all-audience products", () => {
    renderCard({
      item: {
        ...item,
        audience: "all"
      }
    });

    const expectedLabel = "Red Jacket unisex";

    expect(screen.getByText("Red Jacket")).toBeInTheDocument();
    expect(screen.getByText("unisex")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Red Jacket unisex/ })).toHaveAttribute("href", item.url);
    expect(screen.getByRole("img", { name: expectedLabel })).toHaveAttribute("alt", expectedLabel);
  });

  test("does not append unisex suffix for non-all audiences", () => {
    renderCard({
      item: {
        ...item,
        audience: "woman"
      }
    });

    expect(screen.getByText("Red Jacket")).toBeInTheDocument();
    expect(screen.queryByText("unisex")).not.toBeInTheDocument();
  });

  test("opens product context menu callback for safe product URLs", () => {
    const onProductContextMenu = vi.fn();
    renderCard({ onProductContextMenu });

    const link = screen.getByRole("link");
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 36
    });

    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onProductContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ clientX: 24, clientY: 36 }),
      "https://example.com/products/red-jacket",
      expect.objectContaining({ id: "item-1" })
    );
  });

  test("keeps the native context menu when product URL is not safe", () => {
    const onProductContextMenu = vi.fn();
    const { container } = renderCard({
      item: { id: "1", url: "mailto:person@example.com", name: "Linen Shirt", category: "top" },
      onProductContextMenu
    });

    fireEvent.contextMenu(container.firstElementChild as Element);

    expect(onProductContextMenu).not.toHaveBeenCalled();
  });
});
