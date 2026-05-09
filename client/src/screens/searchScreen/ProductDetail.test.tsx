import { afterEach, describe, expect, test } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ProductDetail from "./ProductDetail";

const theme = createTheme();

const t = (key: string) => {
  const labels: Record<string, string> = {
    "search.back": "Back",
    "search.detailEmpty": "Select a product",
    "search.untitled": "Untitled",
  };
  return labels[key] ?? key;
};

const renderProductDetail = (
  item: Parameters<typeof ProductDetail>[0]["item"],
) =>
  render(
    <ThemeProvider theme={theme}>
      <ProductDetail item={item} t={t} locale="en" />
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
});
