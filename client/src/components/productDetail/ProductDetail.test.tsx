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
    "myWardrobe.filters.uploaded": "Uploaded",
    "myWardrobe.removeConfirmTitle": "Remove from My Wardrobe?",
    "myWardrobe.removeConfirmBody": "Remove body",
    "myWardrobe.removeConfirm": "Remove",
    "myWardrobe.imageVersionToggle.label": "Uploaded item image version",
    "myWardrobe.imageVersionToggle.original": "Original",
    "myWardrobe.imageVersionToggle.ai": "AI",
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

  test("shows an AI original image toggle only for uploaded items", async () => {
    renderProductDetail({
      id: "uploaded-coat",
      name: "Uploaded Coat",
      source: "uploaded",
      imageUrl: "https://example.com/coat_clean.png",
      rawImageUrl: "https://example.com/coat_original.webp",
    });

    const image = await screen.findByRole("img", { name: "Uploaded Coat" });
    expect(image).toHaveAttribute("src", "https://example.com/coat_clean.png");
    expect(screen.getByRole("button", { name: "AI" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Original" }));

    expect(image).toHaveAttribute(
      "src",
      "https://example.com/coat_original.webp",
    );
    expect(screen.getByRole("button", { name: "Original" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    cleanup();
    renderProductDetail({
      id: "catalog-coat",
      name: "Catalog Coat",
      source: "from_catalog",
      imageUrl: "https://example.com/catalog.jpg",
      rawImageUrl: "https://example.com/catalog-original.jpg",
    });

    expect(
      screen.queryByRole("button", { name: "AI" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Original" }),
    ).not.toBeInTheDocument();
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

  test("normalizes capsule item string fields into product details", () => {
    renderProductDetail({
      id: "shirt",
      name: "Navy Shirt",
      price: 79,
      currency: "EUR",
      color: "navy",
      formalityLevel: "casual",
      style: "minimalistic",
      season: "spring",
      occasions: "office",
      audience: "woman",
      pattern: "solid",
      closureType: "button",
    });

    expect(screen.getByText("79 EUR")).toBeInTheDocument();
    expect(screen.getByText("Woman")).toBeInTheDocument();
    expect(screen.getByText("Spring")).toBeInTheDocument();
    expect(screen.getByText("Casual")).toBeInTheDocument();
    expect(screen.getByText("Minimalistic")).toBeInTheDocument();
    expect(screen.getByText("Office")).toBeInTheDocument();
    expect(screen.getByText("Navy")).toBeInTheDocument();
    expect(screen.getByText("Solid")).toBeInTheDocument();
    expect(screen.getByText("Button")).toBeInTheDocument();
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

  test("renders uploaded wardrobe icon instead of bookmark for uploaded detail items", () => {
    const { container } = renderProductDetail({
      id: "uploaded-coat",
      name: "Uploaded Coat",
      source: "uploaded",
      isSavedToWardrobe: true,
    });

    expect(screen.getByLabelText("Uploaded")).toBeInTheDocument();
    expect(
      container.querySelector(".catalog-detail-uploaded-icon"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".catalog-detail-saved-icon"),
    ).not.toBeInTheDocument();
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

  test("shows save progress while the wardrobe request is pending", async () => {
    let resolveSave: () => void = () => undefined;
    const onSaveToMyWardrobe = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
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

    expect(
      screen.getByRole("progressbar", { name: "Save to My Wardrobe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Product actions" }),
    ).toBeDisabled();

    resolveSave();

    await waitFor(() => {
      expect(
        screen.queryByRole("progressbar", { name: "Save to My Wardrobe" }),
      ).not.toBeInTheDocument();
    });
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

  test("shows remove actions for wardrobe detail items without a save handler", () => {
    const onRemoveFromMyWardrobe = vi.fn();
    const item = {
      id: "coat",
      name: "Coat",
      url: "https://example.com/coat",
      source: "from_catalog",
    };
    renderProductDetail(item, theme, { onRemoveFromMyWardrobe });

    fireEvent.click(screen.getByRole("button", { name: "Product actions" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Remove from My Wardrobe" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onRemoveFromMyWardrobe).toHaveBeenCalledWith(item);
  });
});
