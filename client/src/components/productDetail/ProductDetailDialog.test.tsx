import { afterEach, describe, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { createAppTheme } from "../../theme";
import ProductDetailDialog from "./ProductDetailDialog";

const searchApi = vi.hoisted(() => ({
  fetchProductDetailByUrl: vi.fn(),
}));
const personalItemsApi = vi.hoisted(() => ({
  fetchUploadedWardrobeItemDetail: vi.fn(),
}));

vi.mock("../../api/search", () => searchApi);
vi.mock("../../api/personalItems", () => personalItemsApi);
vi.mock("../../i18n/useI18n", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string) => {
      const labels: Record<string, string> = {
        "actions.close": "Close",
        "actions.cancel": "Cancel",
        "actions.edit": "Edit",
        "capsule.removeFromPersonalItems": "Remove from Personal items",
        "capsule.saveToPersonalItems": "Save to Personal items",
        "wardrobe.savedBadge": "Saved",
        "wardrobe.likedBadge": "Liked",
        "wardrobe.filters.uploaded": "Uploaded",
        "wardrobe.removeConfirm": "Remove",
        "wardrobe.removeConfirmBody": "Remove body",
        "wardrobe.removeConfirmTitle": "Remove from Personal items?",
        "wardrobe.imageVersionToggle.label": "Uploaded item image version",
        "wardrobe.imageVersionToggle.original": "Original",
        "wardrobe.imageVersionToggle.ai": "AI",
        "search.back": "Back",
        "search.detailLoading": "Loading product details",
        "search.productDetailsTitle": "Product details",
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
  imageUrl: "https://example.com/coat.jpg",
  price: 120,
  currency: "EUR",
  colorBase: ["black"],
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
  personalItemsApi.fetchUploadedWardrobeItemDetail.mockReset();
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

  test("uses the standard mobile detail dialog header and body surface", () => {
    renderDialog({ isMobile: true }, darkTheme);

    const title = screen.getByText("Wool Coat");
    const image = screen.getByRole("img", { name: "Wool Coat" });
    const header = screen
      .getByText("Product details")
      .closest(".MuiDialogTitle-root");
    const content = document.querySelector(".MuiDialogContent-root");

    expect(
      screen.queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(header).toHaveStyle({
      backgroundColor: darkTheme.palette.background.paper,
      minHeight: "60px",
      paddingTop: "12px",
      paddingBottom: "8px",
    });
    expect(content).toHaveStyle({
      backgroundColor: darkTheme.palette.background.default,
      paddingTop: "8px",
      paddingBottom: "32px",
    });
    expect(screen.getByTestId("product-detail-content")).toHaveStyle({
      paddingBottom: "8px",
    });
    expect(image).toHaveStyle({
      display: "block",
      marginBottom: "8px",
    });
    expect(image).toBeInTheDocument();
    expect(
      title.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("keeps mobile detail actions attached before the close button", () => {
    renderDialog({ isMobile: true, onSaveToPersonalItems: vi.fn() });

    const actions = screen.getByRole("button", { name: "Product actions" });
    const close = screen.getByRole("button", { name: "Close" });
    const headerTitle = screen.getByText("Product details");
    const actionGroup = close.parentElement;

    expect(headerTitle).toHaveStyle({ whiteSpace: "nowrap" });
    expect(actionGroup).toHaveStyle({
      display: "flex",
      marginLeft: "auto",
    });
    expect(actions.compareDocumentPosition(close)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("blocks unsafe product and image URLs", () => {
    renderDialog({
      item: {
        id: "unsafe",
        name: "Unsafe Coat",
        url: "javascript:alert(1)",
        imageUrl: "data:text/html,<script>alert(1)</script>",
      },
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByText("Unsafe Coat").length).toBeGreaterThan(0);
  });

  test("keeps the desktop image pane on the product image surface in dark mode", () => {
    renderDialog({}, darkTheme);

    expect(screen.getByTestId("product-detail-dialog-image-pane")).toHaveStyle({
      backgroundColor: "var(--cw-color-product-image-wash)",
    });
  });

  test("defaults uploaded desktop detail images to AI and switches to original", () => {
    renderDialog({
      item: {
        id: "uploaded-coat",
        name: "Uploaded Coat",
        source: "uploaded",
        imageUrl: "https://example.com/coat_clean.png",
        rawImageUrl: "https://example.com/coat_original.webp",
        price: 120,
      },
    });

    const image = screen.getByRole("img", { name: "Uploaded Coat" });
    const toggle = screen.getByLabelText("Uploaded item image version");
    expect(image).toHaveAttribute("src", "https://example.com/coat_clean.png");
    expect(toggle).toHaveStyle({ height: "28px" });
    expect(screen.getByRole("button", { name: "AI" })).toHaveStyle({
      height: "28px",
    });
    expect(screen.getByRole("button", { name: "AI" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Original" }));

    expect(image).toHaveAttribute(
      "src",
      "https://example.com/coat_original.webp",
    );
  });

  test("renders product actions when only remove is available", () => {
    renderDialog({ onRemoveFromPersonalItems: vi.fn() });

    expect(
      screen.getByRole("button", { name: "Product actions" }),
    ).toBeInTheDocument();
  });

  test("shows remove action in the mobile header when only remove is available", () => {
    renderDialog({ isMobile: true, onRemoveFromPersonalItems: vi.fn() });

    fireEvent.click(screen.getByRole("button", { name: "Product actions" }));

    expect(
      screen.getByRole("menuitem", { name: "Remove from Personal items" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Save to Personal items" }),
    ).not.toBeInTheDocument();
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
        imageUrl: "https://example.com/coat.jpg",
        audience: "woman",
      },
    });

    expect(searchApi.fetchProductDetailByUrl).toHaveBeenCalledWith(
      "https://example.com/coat",
    );
    expect(await screen.findByText("180 EUR")).toBeInTheDocument();
    expect(screen.getByText("Winter")).toBeInTheDocument();
  });

  test("uses fetched liked state for sparse product details", async () => {
    searchApi.fetchProductDetailByUrl.mockResolvedValue({
      item: {
        id: "catalog-coat",
        name: "Wool Coat",
        url: "https://example.com/coat",
        imageUrl: "https://example.com/coat.jpg",
        isLiked: true,
        price: 180,
      },
    });

    renderDialog({
      item: {
        id: "capsule-coat",
        name: "Wool Coat",
        url: "https://example.com/coat",
        imageUrl: "https://example.com/coat.jpg",
        isLiked: false,
      },
    });

    expect(await screen.findByLabelText("Liked")).toBeInTheDocument();
    expect(
      document.querySelector(".product-detail-liked-indicator"),
    ).not.toBeInTheDocument();
  });

  test("loads uploaded wardrobe details by explicit wardrobe id", async () => {
    personalItemsApi.fetchUploadedWardrobeItemDetail.mockResolvedValue({
      item: {
        id: "uploaded-1",
        name: "Uploaded shirt",
        source: "uploaded",
        url: "wardrobe://uploaded-1",
        imageUrl: "https://example.com/uploaded.jpg",
        rawImageUrl: "https://example.com/uploaded-original.jpg",
        audience: "all",
        category: "top",
        season: ["summer"],
      },
    });

    renderDialog({
      item: {
        id: "Wuploaded-1",
        wardrobeId: "uploaded-1",
        name: "Uploaded shirt",
        source: "uploaded",
        url: "wardrobe://uploaded-1",
        imageUrl: "https://example.com/uploaded.jpg",
      },
    });

    expect(
      personalItemsApi.fetchUploadedWardrobeItemDetail,
    ).toHaveBeenCalledWith("uploaded-1");
    expect(await screen.findByText("Summer")).toBeInTheDocument();
    expect(screen.getByText("Unisex")).toBeInTheDocument();
    expect(searchApi.fetchProductDetailByUrl).not.toHaveBeenCalled();
  });

  test("does not load uploaded wardrobe details from wardrobe URL alone", () => {
    renderDialog({
      item: {
        name: "Uploaded shirt",
        source: "uploaded",
        url: "wardrobe://uploaded-1",
        imageUrl: "https://example.com/uploaded.jpg",
      },
    });

    expect(
      personalItemsApi.fetchUploadedWardrobeItemDetail,
    ).not.toHaveBeenCalled();
    expect(searchApi.fetchProductDetailByUrl).not.toHaveBeenCalled();
  });

  test("shows edit action for uploaded item details", async () => {
    const onEdit = vi.fn();
    renderDialog({
      item: {
        id: "uploaded-coat",
        name: "Uploaded Coat",
        source: "uploaded",
        imageUrl: "https://example.com/coat_clean.png",
        season: ["winter"],
      },
      onEditUploadedWardrobeItem: onEdit,
    });

    fireEvent.click(screen.getByRole("button", { name: "Product actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "uploaded-coat", source: "uploaded" }),
    );
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
        imageUrl: "https://example.com/coat.jpg",
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
        imageUrl: "https://example.com/coat.jpg",
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
