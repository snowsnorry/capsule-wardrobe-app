import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { createAppTheme } from "../../theme";
import ProductDetailDialog from "./ProductDetailDialog";

const searchApi = vi.hoisted(() => ({
  fetchProductDetailByUrl: vi.fn(),
}));

vi.mock("../../api/search", () => searchApi);
vi.mock("../../i18n/useI18n", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string) => {
      const labels: Record<string, string> = {
        "actions.close": "Close",
        "actions.cancel": "Cancel",
        "capsule.removeFromMyWardrobe": "Remove from My Wardrobe",
        "myWardrobe.savedBadge": "Saved",
        "myWardrobe.removeConfirm": "Remove",
        "myWardrobe.removeConfirmBody": "Remove body",
        "myWardrobe.removeConfirmTitle": "Remove from My Wardrobe?",
        "search.back": "Back",
        "search.detailLoading": "Loading product details",
        "search.openProductPage": "Open product page",
        "search.productActions": "Product actions",
        "search.untitled": "Untitled",
      };
      return labels[key] ?? key;
    },
  }),
}));

const theme = createTheme();
const darkTheme = createAppTheme("dark");

const item = {
  id: "coat",
  name: "Wool Coat",
  url: "https://example.com/coat",
  image_url: "https://example.com/coat.jpg",
  price: 120,
  currency: "EUR",
  color_base: ["black"],
};

function renderDialog(
  props: Partial<Parameters<typeof ProductDetailDialog>[0]> = {},
  renderTheme = theme,
) {
  return render(
    <ThemeProvider theme={renderTheme}>
      <ProductDetailDialog
        item={item}
        open
        isMobile={false}
        onClose={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  searchApi.fetchProductDetailByUrl.mockReset();
});

describe("ProductDetailDialog", () => {
  test("renders a single desktop product image beside the detail content", () => {
    renderDialog();

    expect(screen.getAllByRole("img", { name: "Wool Coat" })).toHaveLength(1);
    expect(screen.getByTestId("product-detail-group-meta")).toBeInTheDocument();
    expect(
      screen.getByTestId("product-detail-group-style"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /wool coat/i })).toHaveAttribute(
      "href",
      "https://example.com/coat",
    );
    expect(
      screen.queryByRole("link", { name: "Open product page" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Wool Coat" })).toHaveStyle({
      objectFit: "cover",
    });
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(searchApi.fetchProductDetailByUrl).not.toHaveBeenCalled();
  });

  test("uses the catalog mobile detail layout with the image after the title", () => {
    renderDialog({ isMobile: true });

    const title = screen.getByText("Wool Coat");
    const image = screen.getByRole("img", { name: "Wool Coat" });
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(image).toBeInTheDocument();
    expect(
      title.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("blocks unsafe product and image URLs", () => {
    renderDialog({
      item: {
        id: "unsafe",
        name: "Unsafe Coat",
        url: "javascript:alert(1)",
        image_url: "data:text/html,<script>alert(1)</script>",
      },
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByText("Unsafe Coat").length).toBeGreaterThan(0);
  });

  test("keeps the desktop image pane theme-aware in dark mode", () => {
    renderDialog({}, darkTheme);

    expect(screen.getByTestId("product-detail-dialog-image-pane")).toHaveStyle({
      backgroundColor: darkTheme.palette.background.default,
    });
  });

  test("renders product actions when only remove is available", () => {
    renderDialog({ onRemoveFromMyWardrobe: vi.fn() });

    expect(
      screen.getByRole("button", { name: "Product actions" }),
    ).toBeInTheDocument();
  });

  test("loads full catalog details when opened with a sparse capsule item", async () => {
    searchApi.fetchProductDetailByUrl.mockResolvedValue({
      item: {
        id: "catalog-coat",
        name: "Wool Coat",
        url: "https://example.com/coat",
        price: 180,
        currency: "EUR",
        season: ["winter"],
      },
    });

    renderDialog({
      item: {
        id: "capsule-coat",
        name: "Wool Coat",
        url: "https://example.com/coat",
        image_url: "https://example.com/coat.jpg",
        audience: "woman",
      },
    });

    expect(searchApi.fetchProductDetailByUrl).toHaveBeenCalledWith(
      "https://example.com/coat",
    );
    expect(await screen.findByText("180 EUR")).toBeInTheDocument();
    expect(screen.getByText("Winter")).toBeInTheDocument();
  });

  test("shows progress instead of sparse details until catalog details load", async () => {
    let resolveDetail: (value: {
      item: {
        id: string;
        name: string;
        url: string;
        price: number;
        currency: string;
      };
    }) => void = () => undefined;
    searchApi.fetchProductDetailByUrl.mockReturnValue(
      new Promise((resolve) => {
        resolveDetail = resolve;
      }),
    );

    renderDialog({
      item: {
        id: "capsule-coat",
        name: "Wool Coat",
        url: "https://example.com/coat",
        image_url: "https://example.com/coat.jpg",
        audience: "woman",
      },
    });

    expect(
      screen.getByRole("progressbar", { name: "Loading product details" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Wool Coat")).not.toBeInTheDocument();

    await act(async () => {
      resolveDetail({
        item: {
          id: "catalog-coat",
          name: "Wool Coat",
          url: "https://example.com/coat",
          price: 180,
          currency: "EUR",
        },
      });
    });

    expect(await screen.findByText("Wool Coat")).toBeInTheDocument();
    expect(screen.getByText("180 EUR")).toBeInTheDocument();
  });

  test("uses the mobile loading layout while sparse details load", () => {
    searchApi.fetchProductDetailByUrl.mockReturnValue(new Promise(() => {}));

    renderDialog({
      isMobile: true,
      item: {
        id: "capsule-coat",
        name: "Wool Coat",
        url: "https://example.com/coat",
        image_url: "https://example.com/coat.jpg",
      },
    });

    expect(
      screen.getByRole("progressbar", { name: "Loading product details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Loading product details")).toHaveClass(
      "MuiTypography-body1",
    );
  });
});
