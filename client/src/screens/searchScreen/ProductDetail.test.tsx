import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { createAppTheme } from "../../theme";
import ProductDetail from "./ProductDetail";

const theme = createTheme();
const darkTheme = createAppTheme("dark");

const t = (key: string) => {
  const labels: Record<string, string> = {
    "search.back": "Back",
    "search.detailEmpty": "Select a product",
    "search.productActions": "Product actions",
    "search.untitled": "Untitled",
    "actions.cancel": "Cancel",
    "myWardrobe.savedBadge": "Saved",
    "myWardrobe.removeConfirmTitle": "Remove from My Wardrobe?",
    "myWardrobe.removeConfirmBody": "Remove body",
    "myWardrobe.removeConfirm": "Remove",
    "capsule.removeFromMyWardrobe": "Remove from My Wardrobe",
    "capsule.saveToMyWardrobe": "Save to My Wardrobe",
  };
  return labels[key] ?? key;
};

const renderProductDetail = (
  item: Parameters<typeof ProductDetail>[0]["item"],
  renderTheme = theme,
  props: Partial<Parameters<typeof ProductDetail>[0]> = {},
) =>
  render(
    <ThemeProvider theme={renderTheme}>
      <ProductDetail item={item} t={t} locale="en" {...props} />
    </ThemeProvider>,
  );

afterEach(() => {
  cleanup();
});

describe("ProductDetail", () => {
  test("renders safe product links and blocks unsafe product and image URLs", async () => {
    renderProductDetail({
      id: "safe",
      name: "Safe Coat",
      url: "https://example.com/coat",
      imageUrl: "https://example.com/coat.jpg",
    });

    expect(screen.getByRole("link", { name: /safe coat/i })).toHaveAttribute(
      "href",
      "https://example.com/coat",
    );
    expect(
      await screen.findByRole("img", { name: "Safe Coat" }),
    ).toHaveAttribute("src", "https://example.com/coat.jpg");

    cleanup();

    renderProductDetail({
      id: "unsafe",
      name: "Unsafe Coat",
      url: "javascript:alert(1)",
      imageUrl: "data:text/html,<script>alert(1)</script>",
    });

    expect(
      screen.queryByRole("link", { name: /unsafe coat/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Unsafe Coat" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe Coat")).toBeInTheDocument();
  });

  test("uses the original product image without thumbnail srcset", async () => {
    renderProductDetail({
      id: "coat",
      name: "Coat",
      imageUrl: "https://example.com/coat.jpg",
    });

    const image = await screen.findByRole("img", { name: "Coat" });
    expect(image).toHaveAttribute("src", "https://example.com/coat.jpg");
    expect(image).not.toHaveAttribute("srcset");
  });

  test("removes the detail image after the original image fails", async () => {
    renderProductDetail({
      id: "coat",
      name: "Coat",
      imageUrl: "https://example.com/coat.jpg",
    });

    const image = await screen.findByRole("img", { name: "Coat" });
    fireEvent.error(image);
    await waitFor(() => {
      expect(screen.queryByRole("img", { name: "Coat" })).toBeNull();
    });
  });

  test("shows unisex suffix for all-audience items and leaves other items unchanged", () => {
    renderProductDetail({
      id: "shirt",
      name: "Linen Shirt",
      audience: "all",
    });

    expect(screen.getByText("Linen Shirt")).toBeInTheDocument();
    expect(screen.getByText("unisex")).toBeInTheDocument();

    cleanup();

    renderProductDetail({
      id: "trousers",
      name: "Wool Trousers",
      audience: "woman",
    });

    expect(screen.getByText("Wool Trousers")).toBeInTheDocument();
    expect(screen.queryByText("unisex")).not.toBeInTheDocument();
  });

  test("renders saved wardrobe icon before the product detail label", () => {
    const { container } = renderProductDetail({
      id: "coat",
      name: "Coat",
      isSavedToWardrobe: true,
    });

    expect(screen.getByLabelText("Saved")).toBeInTheDocument();
    expect(
      container.querySelector(".catalog-detail-saved-icon"),
    ).toBeInTheDocument();
    const titleHtml = container.innerHTML;
    expect(titleHtml?.indexOf("catalog-detail-saved-icon")).toBeLessThan(
      titleHtml?.indexOf("Coat") ?? 0,
    );
  });

  test("keeps detail groups visually distinct from the dark page background", () => {
    renderProductDetail(
      {
        id: "coat",
        name: "Coat",
        price: 120,
        currency: "EUR",
      },
      darkTheme,
    );

    expect(screen.getByTestId("product-detail-group-meta")).toHaveStyle({
      backgroundColor: darkTheme.palette.background.paper,
    });
  });

  test("uses the statistics chart card surface for detail groups in light mode", () => {
    renderProductDetail({
      id: "coat",
      name: "Coat",
      price: 120,
      currency: "EUR",
    });

    expect(screen.getByTestId("product-detail-group-meta")).toHaveStyle({
      backgroundColor: "rgba(252, 251, 249, 0.72)",
    });
  });

  test("opens product actions and saves the product to my wardrobe", () => {
    const onSaveToMyWardrobe = vi.fn();
    const item = {
      id: "coat",
      name: "Coat",
      url: "https://example.com/coat",
    };
    renderProductDetail(item, theme, { onSaveToMyWardrobe });

    fireEvent.click(screen.getByRole("button", { name: "Product actions" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Save to My Wardrobe" }),
    );

    expect(onSaveToMyWardrobe).toHaveBeenCalledWith(item);
  });

  test("confirms before removing a saved product from my wardrobe", () => {
    const onRemoveFromMyWardrobe = vi.fn();
    const onSaveToMyWardrobe = vi.fn();
    const item = {
      id: "coat",
      name: "Coat",
      url: "https://example.com/coat",
      isSavedToWardrobe: true,
    };
    renderProductDetail(item, theme, {
      onRemoveFromMyWardrobe,
      onSaveToMyWardrobe,
    });

    fireEvent.click(screen.getByRole("button", { name: "Product actions" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Remove from My Wardrobe" }),
    );
    expect(onRemoveFromMyWardrobe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onRemoveFromMyWardrobe).toHaveBeenCalledWith(item);
    expect(onSaveToMyWardrobe).not.toHaveBeenCalled();
  });
});
