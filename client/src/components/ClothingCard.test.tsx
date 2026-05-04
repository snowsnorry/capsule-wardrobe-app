import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
            isSelectionMode
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

  test("renders only the product menu by default and keeps it hidden on desktop until hover", () => {
    const { container, rerender } = renderCard({ isSelectable: true });
    const toggleButton = container.querySelector(".wardrobe-card-regenerate");
    const menuButton = container.querySelector(".wardrobe-card-product-menu");

    expect(toggleButton).not.toBeInTheDocument();
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).not.toBeVisible();

    rerender(
      <ThemeProvider theme={theme}>
        <ClothingCard item={item} isSelectable isMobile />
      </ThemeProvider>
    );

    expect(screen.queryByRole("button", { name: "main.partialRegenerateToggle" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "capsule.openProductMenu" })).toBeVisible();
  });

  test("renders only the selection toggle in selection mode", () => {
    renderCard({ isSelectable: true, isSelectionMode: true, isMobile: true });

    expect(screen.getByRole("button", { name: "main.partialRegenerateToggle" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "capsule.openProductMenu" })).not.toBeInTheDocument();
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

  test("falls back to the local cached image URL once when the original image fails", async () => {
    renderCard();

    const image = screen.getByRole("img", { name: item.name ?? "" });
    expect(image).toHaveAttribute("src", item.image_url);

    fireEvent.error(image);

    await waitFor(() => {
      expect(image).toHaveAttribute(
        "src",
        "/api/images/701ef83d3205bee4cedc8663c6a2100ddeaad5bb7f5aeefbabfa58ac0d84c40a.jpg"
      );
    });

    fireEvent.error(image);
    expect(image).toHaveAttribute(
      "src",
      "/api/images/701ef83d3205bee4cedc8663c6a2100ddeaad5bb7f5aeefbabfa58ac0d84c40a.jpg"
    );
  });

  test("renders product title in the details area and category over the image", () => {
    const { container } = renderCard();

    const details = container.querySelector(".wardrobe-card-details");
    const title = container.querySelector(".wardrobe-card-title");
    const category = container.querySelector(".wardrobe-card-category");

    expect(details).toContainElement(screen.getByText("Red Jacket"));
    expect(title).toHaveTextContent("Red Jacket");
    expect(title).not.toHaveTextContent("options.categories.outerwear");
    expect(details).not.toContainElement(screen.getByText("options.categories.outerwear"));
    expect(category).toContainElement(screen.getByText("options.categories.outerwear"));
  });

  test("moves known category icons into the mobile title prefix", () => {
    const { container } = renderCard({ isMobile: true });
    const title = container.querySelector(".wardrobe-card-title");

    expect(container.querySelector(".wardrobe-card-category")).not.toBeInTheDocument();
    expect(title?.querySelector(".wardrobe-card-title-category-prefix svg")).toBeInTheDocument();
    expect(title?.querySelector(".wardrobe-card-title-category-prefix [aria-label='options.categories.outerwear']")).toBeInTheDocument();
    expect(title?.querySelector(".wardrobe-card-title-separator")).toHaveTextContent("•");
    expect(title).toHaveTextContent("Red Jacket");
    expect(title).not.toHaveTextContent("options.categories.outerwear");
  });

  test("uses the hoodie icon for mobile midlayer title prefixes", () => {
    const { container } = renderCard({
      isMobile: true,
      item: {
        ...item,
        category: "midlayer"
      }
    });
    const title = container.querySelector(".wardrobe-card-title");

    expect(container.querySelector(".wardrobe-card-category")).not.toBeInTheDocument();
    expect(title?.querySelector(".wardrobe-card-title-category-prefix svg")).toBeInTheDocument();
    expect(title?.querySelector(".wardrobe-card-title-category-prefix [aria-label='options.categories.midlayer']")).toBeInTheDocument();
    expect(title).not.toHaveTextContent("options.categories.midlayer");
  });

  test("uses text category fallback in the mobile title prefix for unknown categories", () => {
    const { container } = renderCard({
      isMobile: true,
      item: {
        ...item,
        category: "unknown"
      }
    });
    const title = container.querySelector(".wardrobe-card-title");

    expect(container.querySelector(".wardrobe-card-category")).not.toBeInTheDocument();
    expect(title?.querySelector(".wardrobe-card-title-category-prefix svg")).not.toBeInTheDocument();
    expect(title?.querySelector(".wardrobe-card-title-category-text")).toHaveTextContent("options.categories.unknown");
    expect(title?.querySelector(".wardrobe-card-title-separator")).toHaveTextContent("•");
    expect(title).toHaveTextContent("Red Jacket");
  });

  test("omits the mobile title category prefix when the item has no category", () => {
    const { container } = renderCard({
      isMobile: true,
      item: {
        ...item,
        category: null
      }
    });
    const title = container.querySelector(".wardrobe-card-title");

    expect(container.querySelector(".wardrobe-card-category")).not.toBeInTheDocument();
    expect(title?.querySelector(".wardrobe-card-title-category-prefix")).not.toBeInTheDocument();
    expect(title?.querySelector(".wardrobe-card-title-separator")).not.toBeInTheDocument();
    expect(title).toHaveTextContent("Red Jacket");
  });

  test("uses compact mobile typography while keeping action buttons touch sized", () => {
    const { container } = renderCard({ isSelectable: true, isMobile: true });

    const root = container.querySelector(".wardrobe-card-root");
    const details = container.querySelector(".wardrobe-card-details");
    const title = container.querySelector(".wardrobe-card-title");
    const menuButton = screen.getByRole("button", { name: "capsule.openProductMenu" });

    expect(root).toHaveStyle({
      borderRadius: "0",
      boxShadow: "none",
      border: "0.5px solid rgba(17, 36, 34, 0.44)"
    });
    expect(details).toHaveStyle({ minHeight: "50px" });
    expect(title).toHaveStyle({
      fontSize: "13px",
      overflow: "hidden",
      WebkitLineClamp: "2"
    });
    expect(container.querySelector(".wardrobe-card-category")).not.toBeInTheDocument();
    expect(menuButton).toBeVisible();
    expect(menuButton).toHaveStyle({ width: "36px", height: "36px" });
  });

  test("uses roomier mobile typography for one-column cards", () => {
    const { container } = renderCard({ isSelectable: true, isMobile: true, mobileColumns: 1 });

    expect(container.querySelector(".wardrobe-card-root")).toHaveStyle({
      borderRadius: "8px",
      boxShadow: "0 0px 8px rgba(17, 36, 34, 0.08)",
      border: "1px solid rgba(17, 36, 34, 0.08)"
    });
    expect(container.querySelector(".wardrobe-card-details")).toHaveStyle({ minHeight: "64px" });
    expect(container.querySelector(".wardrobe-card-title")).toHaveStyle({
      fontSize: "16px",
      lineHeight: "1.22"
    });
    expect(container.querySelector(".wardrobe-card-category")).not.toBeInTheDocument();
  });

  test("uses tighter mobile typography for three-column cards while keeping actions touch sized", () => {
    const { container } = renderCard({ isSelectable: true, isMobile: true, mobileColumns: 3 });
    const menuButton = screen.getByRole("button", { name: "capsule.openProductMenu" });

    expect(container.querySelector(".wardrobe-card-root")).toHaveStyle({
      borderRadius: "0",
      boxShadow: "none",
      border: "0.5px solid rgba(17, 36, 34, 0.44)"
    });
    expect(container.querySelector(".wardrobe-card-details")).toHaveStyle({ minHeight: "42px" });
    expect(container.querySelector(".wardrobe-card-title")).toHaveStyle({
      fontSize: "11.5px",
      lineHeight: "1.12"
    });
    expect(container.querySelector(".wardrobe-card-category")).not.toBeInTheDocument();
    expect(menuButton).toHaveStyle({ width: "36px", height: "36px" });
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

  test("opens product menu callback for safe product URLs", () => {
    const onProductMenuClick = vi.fn();
    renderCard({ onProductMenuClick });

    const menuButton = document.querySelector(".wardrobe-card-product-menu");
    fireEvent.click(menuButton as Element);

    expect(onProductMenuClick).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.any(HTMLButtonElement) }),
      "https://example.com/products/red-jacket",
      expect.objectContaining({ id: "item-1" })
    );
  });

  test("does not render product menu button when product URL is not safe", () => {
    const onProductMenuClick = vi.fn();
    renderCard({
      item: { id: "1", url: "mailto:person@example.com", name: "Linen Shirt", category: "top" },
      onProductMenuClick
    });

    expect(screen.queryByRole("button", { name: "capsule.openProductMenu" })).not.toBeInTheDocument();
    expect(onProductMenuClick).not.toHaveBeenCalled();
  });
});
