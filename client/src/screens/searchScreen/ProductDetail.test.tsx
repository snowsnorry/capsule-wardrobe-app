import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ProductDetail from "./ProductDetail";

const cachedProductImage = vi.hoisted(() => ({
  buildCachedProductImageUrl: vi.fn()
}));

vi.mock("../../utils/cachedProductImage", () => cachedProductImage);

const theme = createTheme();

const t = (key: string) => {
  const labels: Record<string, string> = {
    "search.back": "Back",
    "search.detailEmpty": "Select a product",
    "search.untitled": "Untitled"
  };
  return labels[key] ?? key;
};

const renderProductDetail = (item: Parameters<typeof ProductDetail>[0]["item"]) => render(
  <ThemeProvider theme={theme}>
    <ProductDetail item={item} t={t} locale="en" />
  </ThemeProvider>
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProductDetail", () => {
  test("renders safe product links and blocks unsafe URLs", () => {
    renderProductDetail({
      id: "safe",
      name: "Safe Coat",
      url: "https://example.com/coat"
    });

    expect(screen.getByRole("link", { name: /safe coat/i })).toHaveAttribute("href", "https://example.com/coat");

    cleanup();

    renderProductDetail({
      id: "unsafe",
      name: "Unsafe Coat",
      url: "javascript:alert(1)"
    });

    expect(screen.queryByRole("link", { name: /unsafe coat/i })).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe Coat")).toBeInTheDocument();
  });

  test("falls back to a cached image when the original image fails", async () => {
    cachedProductImage.buildCachedProductImageUrl.mockResolvedValue("/cached-image?url=https%3A%2F%2Fexample.com%2Fcoat.jpg");

    renderProductDetail({
      id: "coat",
      name: "Coat",
      imageUrl: "https://example.com/coat.jpg"
    });

    const image = screen.getByRole("img", { name: "Coat" });
    expect(image).toHaveAttribute("src", "https://example.com/coat.jpg");

    fireEvent.error(image);

    await waitFor(() => {
      expect(image).toHaveAttribute("src", "/cached-image?url=https%3A%2F%2Fexample.com%2Fcoat.jpg");
    });
    expect(cachedProductImage.buildCachedProductImageUrl).toHaveBeenCalledWith("https://example.com/coat.jpg");
  });
});
