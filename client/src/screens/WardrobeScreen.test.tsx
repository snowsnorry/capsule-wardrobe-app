import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import WardrobeScreen from "./WardrobeScreen";
import { WARDROBE_FILTERS_STORAGE_KEY } from "./WardrobeCardLayoutStorage";

const api = vi.hoisted(() => ({
  deleteUploadedWardrobeItem: vi.fn(),
  downloadMyWardrobePdf: vi.fn(),
  fetchMyWardrobeItems: vi.fn(),
  removeCatalogItemFromMyWardrobe: vi.fn(),
  updateUploadedWardrobeItem: vi.fn(),
  uploadWardrobeImages: vi.fn(),
  uploadWardrobeUrls: vi.fn(),
}));
const likedApi = vi.hoisted(() => ({
  likeItem: vi.fn(),
  removeItemLike: vi.fn(),
}));
const useI18nMock = vi.hoisted(() => vi.fn());
const useMediaQueryMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("../api/myWardrobe", () => api);
vi.mock("../api/likedItems", () => likedApi);
vi.mock("../i18n/useI18n", () => ({
  useI18n: useI18nMock,
}));
vi.mock("@mui/material/useMediaQuery", () => ({
  default: useMediaQueryMock,
}));
vi.mock("../components/ClothingCard", () => ({
  default: ({
    allowProductMenuWithoutUrl = false,
    item,
    mobileColumns,
    onProductClick,
    onProductMenuOpen,
    showProductMenu = true,
  }) => (
    <div
      role="button"
      tabIndex={0}
      data-testid={`wardrobe-card-${item.id}`}
      data-mobile-columns={String(mobileColumns)}
      data-show-product-menu={String(showProductMenu)}
      onClick={() => onProductClick?.(item)}
      onKeyDown={() => undefined}
    >
      {item.name}
      {showProductMenu ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onProductMenuOpen?.(
              event.currentTarget,
              item.url || (allowProductMenuWithoutUrl ? item.id : ""),
              item,
              { presentation: "anchored" },
            );
          }}
        >
          open product menu
        </button>
      ) : null}
    </div>
  ),
}));
vi.mock("../components/productDetail/ProductDetailDialog", () => ({
  default: ({
    item,
    open,
    onClose,
    onEditUploadedWardrobeItem,
    onRemoveFromMyWardrobe,
  }) =>
    open ? (
      <div data-testid="product-detail-dialog">
        {item?.name}
        <button type="button" onClick={onClose}>
          close product
        </button>
        <button
          type="button"
          onClick={() => onEditUploadedWardrobeItem?.(item)}
        >
          edit uploaded product
        </button>
        <button type="button" onClick={() => onRemoveFromMyWardrobe?.(item)}>
          dialog remove product
        </button>
      </div>
    ) : null,
}));
vi.mock("../components/productDetail/UploadedProductDetailDialog", () => ({
  default: ({ item, open, onClose, onApply }) =>
    open ? (
      <div data-testid="uploaded-product-detail-dialog">
        {item?.name}
        <button type="button" onClick={onClose}>
          close uploaded product
        </button>
        <button
          type="button"
          onClick={() =>
            onApply?.(item, {
              name: "Updated uploaded shirt",
              description: null,
              brand: null,
              audience: "all",
              category: "top",
              season: ["summer"],
              formalityLevel: [],
              style: [],
              occasions: [],
              colorBase: [],
              pattern: null,
              finish: null,
              composition: "linen",
              silhouette: null,
              fit: null,
              closureType: [],
            })
          }
        >
          apply uploaded product
        </button>
      </div>
    ) : null,
}));
vi.mock("./mainScreen/CapsuleProductDetailDialog", () => ({
  default: ({
    item,
    mode,
    open,
    onApply,
    onClose,
    onEdit,
    onReadMode,
    onRemoveFromMyWardrobe,
  }) => {
    if (!open) {
      return null;
    }

    if (mode === "edit") {
      return (
        <div data-testid="uploaded-product-detail-dialog">
          {item?.name}
          <button type="button" onClick={onReadMode}>
            cancel uploaded product
          </button>
          <button
            type="button"
            onClick={() =>
              onApply?.(item, {
                name: "Updated uploaded shirt",
                description: null,
                brand: null,
                audience: "all",
                category: "top",
                season: ["summer"],
                formalityLevel: [],
                style: [],
                occasions: [],
                colorBase: [],
                pattern: null,
                finish: null,
                composition: "linen",
                silhouette: null,
                fit: null,
                closureType: [],
              })
            }
          >
            apply uploaded product
          </button>
        </div>
      );
    }

    return (
      <div data-testid="product-detail-dialog">
        {item?.name}
        <button type="button" onClick={onClose}>
          close product
        </button>
        <button type="button" onClick={() => onEdit?.(item)}>
          edit uploaded product
        </button>
        <button type="button" onClick={() => onRemoveFromMyWardrobe?.(item)}>
          dialog remove product
        </button>
      </div>
    );
  },
}));
vi.mock("../components/ClothingGridPlaceholder", () => ({
  default: ({ count, mobileColumns }) => (
    <div
      data-testid="wardrobe-placeholder"
      data-mobile-columns={String(mobileColumns)}
    >
      {count}
    </div>
  ),
  buildClothingGridTemplateColumns: () => "repeat(2, minmax(0, 1fr))",
  buildClothingGridGap: () => 2,
}));

const theme = createTheme();
const translations: Record<string, string> = {
  "wardrobe.title": "Personal items",
  "wardrobe.subtitle": "Saved catalog pieces and uploaded items in one place.",
  "wardrobe.upload": "Upload item photo",
  "wardrobe.uploadMenu": "Choose upload method",
  "wardrobe.uploadMenuLabel": "Upload methods",
  "wardrobe.uploadPhoto": "Upload photo",
  "wardrobe.uploadUrl": "Upload URL",
  "wardrobe.openMenu": "Open Personal items menu",
  "wardrobe.downloadFailed": "Failed to export Personal items PDF.",
  "wardrobe.filterLabel": "Personal item source",
  "wardrobe.loadFailed": "Failed to load Personal items.",
  "wardrobe.removeFailed": "Failed to remove from Personal items.",
  "wardrobe.updateFailed": "Failed to update the item.",
  "wardrobe.uploadFailed": "Failed to upload personal item photos.",
  "wardrobe.urlUploadFailed": "Failed to upload product URLs.",
  "wardrobe.failedUploadBadge": "Failed",
  "wardrobe.like": "Like",
  "wardrobe.likedBadge": "Liked",
  "wardrobe.likeFailed": "Failed to update like.",
  "wardrobe.noCategoryBadge": "No category",
  "wardrobe.needsReviewBadge": "Needs review",
  "wardrobe.removeLike": "Remove like",
  "wardrobe.deleteUploaded": "Delete item",
  "wardrobe.deleteUploadedConfirmTitle": "Delete uploaded item?",
  "wardrobe.deleteUploadedConfirmBody":
    "This uploaded item and its images will be permanently deleted.",
  "wardrobe.deleteUploadedConfirm": "Delete",
  "wardrobe.removeConfirmTitle": "Remove from Personal items?",
  "wardrobe.removeConfirmBody":
    "This product will be removed from Personal items.",
  "wardrobe.removeConfirm": "Remove",
  "wardrobe.emptyTitle": "No saved items yet",
  "wardrobe.emptyBody":
    "Save products from a capsule or upload item photos later.",
  "wardrobe.filteredEmptyTitle": "No liked items here",
  "wardrobe.filteredEmptyBody":
    "Like items to keep them visible in this filtered view.",
  "wardrobe.filters.all": "All",
  "wardrobe.filters.uploaded": "Uploaded",
  "wardrobe.filters.fromCatalog": "From Catalog",
  "wardrobe.filters.likedOnly": "Liked only",
  "wardrobe.uploadDialog.title": "Upload personal item photos",
  "wardrobe.uploadDialog.body":
    "Use one image per garment. Photograph the item laid flat or neatly hung, fully visible, with no other clothing in frame, against a plain, even background.",
  "wardrobe.uploadDialog.dropzoneLabel": "Choose personal item photos",
  "wardrobe.uploadDialog.dropzoneTitle": "Upload photos",
  "wardrobe.uploadDialog.dropzoneHint":
    "Drag and drop or click to browse. JPEG, PNG, or WebP. Up to 5 files, 10 MB each.",
  "wardrobe.uploadDialog.mobileDropzoneTitle": "Upload photos",
  "wardrobe.uploadDialog.mobileDropzoneHint":
    "Tap to browse. JPEG, PNG, or WebP. Up to 5 files, 10 MB each.",
  "wardrobe.uploadDialog.fileList": "Selected files",
  "wardrobe.uploadDialog.selectedSummary": "{count} files, {size}",
  "wardrobe.uploadDialog.removeFile": "Remove {name}",
  "wardrobe.uploadDialog.upload": "Upload",
  "wardrobe.uploadDialog.uploadedStatus": "Uploaded: {image_count}",
  "wardrobe.uploadDialog.metadataProcessedStatus":
    "Metadata processed: {image_count}",
  "wardrobe.uploadDialog.imageProcessedStatus":
    "Images processed: {image_count}",
  "wardrobe.uploadDialog.failedStatus": "Failed: {image_count}",
  "wardrobe.uploadDialog.tooManyFiles": "Upload up to 5 files.",
  "wardrobe.uploadDialog.invalidType": "Use JPEG, PNG, or WebP images.",
  "wardrobe.uploadDialog.fileTooLarge": "Each image must be 10 MB or less.",
  "wardrobe.urlUploadDialog.title": "Upload product image URLs",
  "wardrobe.urlUploadDialog.body":
    "Add links to commercial product images where the item is clearly visible and laid flat. Each accepted image becomes an uploaded personal item.",
  "wardrobe.urlUploadDialog.fieldLabel": "Product image URL {index}",
  "wardrobe.urlUploadDialog.placeholder":
    "https://example.com/product-image.jpg",
  "wardrobe.urlUploadDialog.helperText":
    "Use a product image URL starting with http:// or https://.",
  "wardrobe.urlUploadDialog.invalidUrl":
    "Enter a URL that starts with http:// or https://.",
  "wardrobe.urlUploadDialog.upload": "Upload URLs",
  "capsule.exportPdf": "Export as PDF",
  "capsule.cardLayout": "Card layout",
  "capsule.cardColumnsOne": "1 column",
  "capsule.cardColumnsTwo": "2 columns",
  "capsule.cardColumnsThree": "3 columns",
  "capsule.removeFromMyWardrobe": "Remove from Personal items",
  "actions.cancel": "Cancel",
  "actions.edit": "Edit",
};

function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <WardrobeScreen />
    </ThemeProvider>,
  );
}

describe("WardrobeScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMediaQueryMock.mockReset();
    useMediaQueryMock.mockReturnValue(false);
    api.downloadMyWardrobePdf.mockReset();
    api.downloadMyWardrobePdf.mockResolvedValue(undefined);
    api.deleteUploadedWardrobeItem.mockReset();
    api.deleteUploadedWardrobeItem.mockResolvedValue({ ok: true });
    api.fetchMyWardrobeItems.mockReset();
    api.removeCatalogItemFromMyWardrobe.mockReset();
    api.removeCatalogItemFromMyWardrobe.mockResolvedValue({ ok: true });
    api.updateUploadedWardrobeItem.mockReset();
    api.updateUploadedWardrobeItem.mockResolvedValue({
      item: {
        id: "wardrobe-uploaded",
        name: "Updated uploaded shirt",
        source: "uploaded",
      },
    });
    api.uploadWardrobeImages.mockReset();
    api.uploadWardrobeImages.mockResolvedValue({ ok: true, items: [] });
    api.uploadWardrobeUrls.mockReset();
    api.uploadWardrobeUrls.mockResolvedValue({ ok: true, items: [] });
    likedApi.likeItem.mockReset();
    likedApi.likeItem.mockResolvedValue({ ok: true });
    likedApi.removeItemLike.mockReset();
    likedApi.removeItemLike.mockResolvedValue({ ok: true });
    api.fetchMyWardrobeItems.mockResolvedValue({
      items: [
        {
          id: "wardrobe-1",
          name: "Linen Shirt",
          url: "https://example.com/1",
          imageUrl: "https://example.com/1.jpg",
        },
      ],
    });
    useI18nMock.mockReturnValue({
      locale: "en",
      t: (key: string) => translations[key] || key,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:wardrobe-upload-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(cleanup);

  test("renders toolbar, upload button, filters, and wardrobe cards", async () => {
    renderScreen();

    expect(screen.queryByText("Personal items")).not.toBeInTheDocument();
    const uploadButton = screen.getByRole("button", {
      name: "Upload item photo",
    });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toHaveClass("MuiButton-outlined");
    expect(
      screen.getByRole("button", { name: "Open Personal items menu" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Personal item source" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("wardrobe-filter-divider")).toBeInTheDocument();
    expect(screen.getByTestId("wardrobe-placeholder")).toBeInTheDocument();

    expect(
      await screen.findByTestId("wardrobe-card-wardrobe-1"),
    ).toHaveTextContent("Linen Shirt");
    expect(screen.getByTestId("wardrobe-card-wardrobe-1")).toHaveAttribute(
      "data-show-product-menu",
      "true",
    );
    expect(api.fetchMyWardrobeItems).toHaveBeenCalledWith({
      source: null,
      force: false,
    });
  });

  test("moves mobile source and liked filters into the action menu", async () => {
    useMediaQueryMock.mockReturnValue(true);
    const user = userEvent.setup();
    renderScreen();

    const uploadButton = screen.getByRole("button", {
      name: "Upload item photo",
    });
    expect(uploadButton).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Personal items menu" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Personal item source" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", {
        name: "Personal item source",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Liked only" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("wardrobe-filter-divider"),
    ).not.toBeInTheDocument();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(
      screen.getByRole("button", { name: "Open Personal items menu" }),
    );

    expect(
      screen.getByRole("radiogroup", {
        name: "Personal item source",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", {
        name: "All",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Liked only" }),
    ).not.toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Uploaded" }));

    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
        force: false,
      });
    });
    expect(
      JSON.parse(
        window.localStorage.getItem(WARDROBE_FILTERS_STORAGE_KEY) || "{}",
      ),
    ).toEqual({ filter: "uploaded", likedOnly: false });
  });

  test("combines mobile action-menu source and liked-only filters", async () => {
    useMediaQueryMock.mockReturnValue(true);
    const user = userEvent.setup();
    api.fetchMyWardrobeItems
      .mockResolvedValueOnce({
        items: [
          {
            id: "liked-catalog",
            name: "Liked Catalog Jacket",
            source: "from_catalog",
            url: "https://example.com/liked-catalog",
            imageUrl: "https://example.com/liked-catalog.jpg",
            isLiked: true,
          },
          {
            id: "plain-catalog",
            name: "Plain Catalog Jacket",
            source: "from_catalog",
            url: "https://example.com/plain-catalog",
            imageUrl: "https://example.com/plain-catalog.jpg",
            isLiked: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "liked-uploaded",
            name: "Liked Uploaded Shirt",
            source: "uploaded",
            imageUrl: "https://example.com/liked-uploaded.jpg",
            isLiked: true,
          },
          {
            id: "plain-uploaded",
            name: "Plain Uploaded Shirt",
            source: "uploaded",
            imageUrl: "https://example.com/plain-uploaded.jpg",
            isLiked: false,
          },
        ],
      });

    renderScreen();

    await screen.findByTestId("wardrobe-card-liked-catalog");
    await user.click(
      screen.getByRole("button", { name: "Open Personal items menu" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Liked only" }));
    await user.click(screen.getByRole("radio", { name: "Uploaded" }));

    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
        force: false,
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Liked Uploaded Shirt")).toBeInTheDocument();
      expect(
        screen.queryByText("Plain Uploaded Shirt"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Liked Catalog Jacket"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("checkbox", { name: "Liked only" })).toBeChecked();
    expect(
      JSON.parse(
        window.localStorage.getItem(WARDROBE_FILTERS_STORAGE_KEY) || "{}",
      ),
    ).toEqual({ filter: "uploaded", likedOnly: true });
  });

  test("restores wardrobe source and liked-only filters from local storage", async () => {
    window.localStorage.setItem(
      WARDROBE_FILTERS_STORAGE_KEY,
      JSON.stringify({ filter: "uploaded", likedOnly: true }),
    );
    api.fetchMyWardrobeItems.mockResolvedValueOnce({
      items: [
        {
          id: "liked-uploaded",
          name: "Liked Uploaded Shirt",
          source: "uploaded",
          imageUrl: "https://example.com/liked-uploaded.jpg",
          isLiked: true,
        },
        {
          id: "plain-uploaded",
          name: "Plain Uploaded Shirt",
          source: "uploaded",
          imageUrl: "https://example.com/plain-uploaded.jpg",
          isLiked: false,
        },
      ],
    });

    renderScreen();

    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenCalledWith({
        source: "uploaded",
        force: false,
      });
    });
    expect(await screen.findByText("Liked Uploaded Shirt")).toBeInTheDocument();
    expect(screen.queryByText("Plain Uploaded Shirt")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uploaded" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Liked only" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("combines desktop source and liked-only filters", async () => {
    const user = userEvent.setup();
    api.fetchMyWardrobeItems
      .mockResolvedValueOnce({
        items: [
          {
            id: "liked-uploaded",
            name: "Liked Uploaded Shirt",
            source: "uploaded",
            imageUrl: "https://example.com/liked-uploaded.jpg",
            isLiked: true,
          },
          {
            id: "plain-uploaded",
            name: "Plain Uploaded Shirt",
            source: "uploaded",
            imageUrl: "https://example.com/plain-uploaded.jpg",
            isLiked: false,
          },
          {
            id: "liked-catalog",
            name: "Liked Catalog Jacket",
            source: "from_catalog",
            url: "https://example.com/liked-catalog",
            imageUrl: "https://example.com/liked-catalog.jpg",
            isLiked: true,
          },
          {
            id: "plain-catalog",
            name: "Plain Catalog Jacket",
            source: "from_catalog",
            url: "https://example.com/plain-catalog",
            imageUrl: "https://example.com/plain-catalog.jpg",
            isLiked: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "liked-uploaded",
            name: "Liked Uploaded Shirt",
            source: "uploaded",
            imageUrl: "https://example.com/liked-uploaded.jpg",
            isLiked: true,
          },
          {
            id: "plain-uploaded",
            name: "Plain Uploaded Shirt",
            source: "uploaded",
            imageUrl: "https://example.com/plain-uploaded.jpg",
            isLiked: false,
          },
        ],
      });

    renderScreen();

    await screen.findByTestId("wardrobe-card-liked-uploaded");
    await user.click(screen.getByRole("button", { name: "Liked only" }));

    expect(screen.getByText("Liked Uploaded Shirt")).toBeInTheDocument();
    expect(screen.getByText("Liked Catalog Jacket")).toBeInTheDocument();
    expect(screen.queryByText("Plain Uploaded Shirt")).not.toBeInTheDocument();
    expect(screen.queryByText("Plain Catalog Jacket")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Uploaded" }));

    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
        force: false,
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Liked Uploaded Shirt")).toBeInTheDocument();
      expect(
        screen.queryByText("Liked Catalog Jacket"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Plain Uploaded Shirt"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Liked only" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("keeps the mobile wardrobe surface from creating horizontal page overflow", async () => {
    useMediaQueryMock.mockReturnValue(true);
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");

    expect(
      getComputedStyle(screen.getByTestId("wardrobe-screen")).overflowX,
    ).toBe("hidden");
    expect(
      getComputedStyle(screen.getByTestId("wardrobe-content")).boxSizing,
    ).toBe("border-box");
  });

  test("extends the sticky toolbar surface above the controls while scrolling", async () => {
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");

    const toolbar = screen.getByTestId("wardrobe-toolbar");

    expect(toolbar).not.toBeNull();
    expect(getComputedStyle(toolbar).clipPath).toBe(
      "inset(-100vmax -100vmax 0)",
    );
  });

  test("opens upload dialog as a full-screen mobile picker", async () => {
    useMediaQueryMock.mockReturnValue(true);
    const user = userEvent.setup();
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(screen.getByRole("button", { name: "Upload item photo" }));

    const dialog = screen.getByRole("dialog", {
      name: "Upload personal item photos",
    });
    expect(dialog).toHaveClass("MuiDialog-paperFullScreen");
    expect(within(dialog).getByText("Upload photos")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Tap to browse. JPEG, PNG, or WebP. Up to 5 files, 10 MB each.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("Drop images here"),
    ).not.toBeInTheDocument();
  });

  test("opens upload URL dialog as a full-screen mobile form", async () => {
    useMediaQueryMock.mockReturnValue(true);
    const user = userEvent.setup();
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(
      screen.getByRole("button", { name: "Choose upload method" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Upload URL" }));

    const dialog = screen.getByRole("dialog", {
      name: "Upload product image URLs",
    });
    expect(dialog).toHaveClass("MuiDialog-paperFullScreen");
    expect(
      within(dialog).getByLabelText("Product image URL 1"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Add links to commercial product images where the item is clearly visible and laid flat. Each accepted image becomes an uploaded personal item.",
      ),
    ).toBeInTheDocument();
  });

  test("sorts wardrobe cards with the same order as capsule items", async () => {
    api.fetchMyWardrobeItems.mockResolvedValueOnce({
      items: [
        {
          id: "wardrobe-bag",
          name: "Canvas Bag",
          category: "bag",
        },
        {
          id: "wardrobe-bottom",
          name: "Trousers",
          category: "bottom",
        },
        {
          id: "wardrobe-top-z",
          name: "Zulu Shirt",
          category: "top",
        },
        {
          id: "wardrobe-top-a",
          name: "Alpha Shirt",
          category: "top",
        },
      ],
    });
    const { container } = renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-top-a");

    expect(
      Array.from(container.querySelectorAll("[data-testid^='wardrobe-card-']"))
        .map((card) => card.textContent)
        .map((text) => text?.replace("open product menu", "")),
    ).toEqual(["Alpha Shirt", "Zulu Shirt", "Trousers", "Canvas Bag"]);
  });

  test("clears liked-only after upload so new uploaded items stay visible", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      WARDROBE_FILTERS_STORAGE_KEY,
      JSON.stringify({ filter: "all", likedOnly: true }),
    );
    api.fetchMyWardrobeItems.mockResolvedValueOnce({
      items: [
        {
          id: "liked-shirt",
          name: "Liked Shirt",
          url: "https://example.com/liked-shirt",
          imageUrl: "https://example.com/liked-shirt.jpg",
          isLiked: true,
        },
      ],
    });

    renderScreen();

    await screen.findByTestId("wardrobe-card-liked-shirt");
    expect(screen.getByRole("button", { name: "Liked only" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Upload item photo" }));
    const file = new File(["image"], "linen-shirt.png", { type: "image/png" });
    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [file] },
    });
    await user.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
        force: true,
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByText("Upload personal item photos"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Liked only" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      JSON.parse(
        window.localStorage.getItem(WARDROBE_FILTERS_STORAGE_KEY) || "{}",
      ),
    ).toEqual({ filter: "uploaded", likedOnly: false });
  });

  test("uploads selected wardrobe photos and refreshes uploaded items", async () => {
    const user = userEvent.setup();
    let resolveUpload: (value: unknown) => void = () => {};
    api.uploadWardrobeImages.mockImplementationOnce(
      (_files, options) =>
        new Promise((resolve) => {
          options.onProgress({
            total: 1,
            uploaded: 1,
            completedSteps: 1,
            metadataProcessed: 0,
            imageProcessed: 0,
            failed: 0,
          });
          resolveUpload = resolve;
        }),
    );
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(screen.getByRole("button", { name: "Upload item photo" }));

    expect(screen.getByText("Upload personal item photos")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use one image per garment. Photograph the item laid flat or neatly hung, fully visible, with no other clothing in frame, against a plain, even background.",
      ),
    ).toBeInTheDocument();

    const file = new File(["image"], "linen-shirt.png", { type: "image/png" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("linen-shirt.png")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Upload" }));

    expect(api.uploadWardrobeImages).toHaveBeenCalledWith(
      [file],
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    expect(screen.getByText("Upload personal item photos")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "33",
    );
    expect(screen.getByText("Uploaded: 1")).toBeInTheDocument();
    expect(screen.getByText("Metadata processed: 0")).toBeInTheDocument();
    expect(screen.getByText("Images processed: 0")).toBeInTheDocument();
    expect(screen.getByText("Failed: 0")).toBeInTheDocument();

    resolveUpload({ ok: true, items: [] });
    await waitFor(() => {
      expect(
        screen.queryByText("Upload personal item photos"),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
        force: true,
      });
    });
  });

  test("validates upload dialog file count, type, size, and removal", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(screen.getByRole("button", { name: "Upload item photo" }));
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(["text"], "notes.txt", { type: "text/plain" })],
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use JPEG, PNG, or WebP images.",
    );

    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", {
            type: "image/png",
          }),
        ],
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Each image must be 10 MB or less.",
    );

    fireEvent.change(input, {
      target: {
        files: Array.from(
          { length: 6 },
          (_value, index) =>
            new File(["image"], `shirt-${index}.png`, { type: "image/png" }),
        ),
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Upload up to 5 files.",
    );

    const file = new File(["image"], "shirt.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText("shirt.png")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove shirt.png" }));

    expect(screen.queryByText("shirt.png")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  });

  test("uploads product URLs from the split upload menu", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(
      screen.getByRole("button", { name: "Choose upload method" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Upload URL" }));

    const dialog = screen.getByRole("dialog", {
      name: "Upload product image URLs",
    });
    const uploadButton = within(dialog).getByRole("button", {
      name: "Upload URLs",
    });
    expect(uploadButton).toBeDisabled();

    const firstUrlInput = within(dialog).getByLabelText("Product image URL 1");
    await user.type(firstUrlInput, "example.com/product");
    expect(
      within(dialog).getByText(
        "Enter a URL that starts with http:// or https://.",
      ),
    ).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();

    await user.clear(firstUrlInput);
    await user.type(firstUrlInput, "https://shop.example.com/product-1");
    expect(
      within(dialog).getByLabelText("Product image URL 2"),
    ).toBeInTheDocument();
    expect(uploadButton).toBeEnabled();

    await user.type(
      within(dialog).getByLabelText("Product image URL 2"),
      "http://shop.example.com/product-2",
    );
    await user.type(
      within(dialog).getByLabelText("Product image URL 3"),
      "https://shop.example.com/product-3",
    );
    await user.type(
      within(dialog).getByLabelText("Product image URL 4"),
      "https://shop.example.com/product-4",
    );
    await user.type(
      within(dialog).getByLabelText("Product image URL 5"),
      "https://shop.example.com/product-5",
    );
    expect(
      within(dialog).queryByLabelText("Product image URL 6"),
    ).not.toBeInTheDocument();

    await user.click(uploadButton);

    expect(api.uploadWardrobeUrls).toHaveBeenCalledWith(
      [
        "https://shop.example.com/product-1",
        "http://shop.example.com/product-2",
        "https://shop.example.com/product-3",
        "https://shop.example.com/product-4",
        "https://shop.example.com/product-5",
      ],
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    await waitFor(() => {
      expect(
        screen.queryByText("Upload product image URLs"),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
        force: true,
      });
    });
  });

  test("exports the current filtered wardrobe as PDF from the action menu", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(screen.getByRole("button", { name: "Uploaded" }));
    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
        force: false,
      });
    });
    await user.click(
      screen.getByRole("button", { name: "Open Personal items menu" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Export as PDF" }));

    expect(api.downloadMyWardrobePdf).toHaveBeenCalledWith({
      source: "uploaded",
    });
  });

  test("shows mobile card layout controls and updates wardrobe columns", async () => {
    useMediaQueryMock.mockReturnValue(true);
    const user = userEvent.setup();
    renderScreen();

    expect(
      await screen.findByTestId("wardrobe-card-wardrobe-1"),
    ).toHaveAttribute("data-mobile-columns", "2");

    await user.click(
      screen.getByRole("button", { name: "Open Personal items menu" }),
    );
    expect(screen.getByText("Card layout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "3 columns" }));

    expect(screen.getByTestId("wardrobe-card-wardrobe-1")).toHaveAttribute(
      "data-mobile-columns",
      "3",
    );
    expect(window.localStorage.getItem("wardrobe.mobileCardColumns")).toBe("3");
  });

  test("removes an item from the card product menu", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      await screen.findByRole("button", { name: "open product menu" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Remove from Personal items" }),
    );
    expect(api.removeCatalogItemFromMyWardrobe).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(api.removeCatalogItemFromMyWardrobe).toHaveBeenCalledWith(
      "https://example.com/1",
    );
    await waitFor(() => {
      expect(
        screen.queryByTestId("wardrobe-card-wardrobe-1"),
      ).not.toBeInTheDocument();
    });
  });

  test("likes an item from the card product menu", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      await screen.findByRole("button", { name: "open product menu" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Like" }));

    expect(likedApi.likeItem).toHaveBeenCalledWith("https://example.com/1");
  });

  test("removes an unliked item from the visible list while liked-only is active", async () => {
    const user = userEvent.setup();
    api.fetchMyWardrobeItems.mockResolvedValueOnce({
      items: [
        {
          id: "liked-shirt",
          name: "Liked Shirt",
          url: "https://example.com/liked-shirt",
          imageUrl: "https://example.com/liked-shirt.jpg",
          isLiked: true,
        },
        {
          id: "plain-shirt",
          name: "Plain Shirt",
          url: "https://example.com/plain-shirt",
          imageUrl: "https://example.com/plain-shirt.jpg",
          isLiked: false,
        },
      ],
    });
    renderScreen();

    await screen.findByTestId("wardrobe-card-liked-shirt");
    await user.click(screen.getByRole("button", { name: "Liked only" }));

    expect(screen.getByText("Liked Shirt")).toBeInTheDocument();
    expect(screen.queryByText("Plain Shirt")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "open product menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove like" }));

    expect(likedApi.removeItemLike).toHaveBeenCalledWith(
      "https://example.com/liked-shirt",
    );
    await waitFor(() => {
      expect(screen.queryByText("Liked Shirt")).not.toBeInTheDocument();
    });
    expect(screen.getByText("No liked items here")).toBeInTheDocument();
  });

  test("restores the previous item list when liking fails", async () => {
    const user = userEvent.setup();
    likedApi.likeItem.mockRejectedValueOnce(new Error("network"));
    renderScreen();

    await user.click(
      await screen.findByRole("button", { name: "open product menu" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Like" }));

    expect(
      await screen.findByText("Failed to update like."),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Like" })).toBeInTheDocument();
  });

  test("deletes an uploaded item from the card product menu", async () => {
    const user = userEvent.setup();
    api.fetchMyWardrobeItems.mockResolvedValueOnce({
      items: [
        {
          id: "wardrobe-uploaded",
          name: "Uploaded shirt",
          source: "uploaded",
          imageUrl: "https://example.com/uploaded.jpg",
        },
      ],
    });
    renderScreen();

    await user.click(
      await screen.findByRole("button", { name: "open product menu" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete item" }));
    expect(api.deleteUploadedWardrobeItem).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deleteUploadedWardrobeItem).toHaveBeenCalledWith(
      "wardrobe-uploaded",
    );
    expect(api.removeCatalogItemFromMyWardrobe).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByTestId("wardrobe-card-wardrobe-uploaded"),
      ).not.toBeInTheDocument();
    });
  });

  test("opens product details from a wardrobe card", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByTestId("wardrobe-card-wardrobe-1"));

    expect(screen.getByTestId("product-detail-dialog")).toHaveTextContent(
      "Linen Shirt",
    );

    await user.click(
      screen.getByRole("button", { name: "dialog remove product" }),
    );
    expect(api.removeCatalogItemFromMyWardrobe).toHaveBeenCalledWith(
      "https://example.com/1",
    );
  });

  test("opens complete uploaded product details in read mode and edits from detail action", async () => {
    const user = userEvent.setup();
    api.fetchMyWardrobeItems.mockResolvedValueOnce({
      items: [
        {
          id: "wardrobe-uploaded",
          name: "Uploaded shirt",
          source: "uploaded",
          imageUrl: "https://example.com/uploaded.jpg",
          processingStatus: "ready",
          audience: "all",
          category: "top",
          season: ["summer"],
        },
      ],
    });
    renderScreen();

    await user.click(
      await screen.findByTestId("wardrobe-card-wardrobe-uploaded"),
    );
    expect(screen.getByTestId("product-detail-dialog")).toHaveTextContent(
      "Uploaded shirt",
    );
    expect(
      screen.queryByTestId("uploaded-product-detail-dialog"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "edit uploaded product" }),
    );
    expect(
      screen.getByTestId("uploaded-product-detail-dialog"),
    ).toHaveTextContent("Uploaded shirt");

    await user.click(
      screen.getByRole("button", { name: "cancel uploaded product" }),
    );
    expect(screen.getByTestId("product-detail-dialog")).toHaveTextContent(
      "Uploaded shirt",
    );
    expect(
      screen.queryByTestId("uploaded-product-detail-dialog"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "edit uploaded product" }),
    );
    await user.click(
      screen.getByRole("button", { name: "apply uploaded product" }),
    );

    expect(api.updateUploadedWardrobeItem).toHaveBeenCalledWith(
      "wardrobe-uploaded",
      expect.objectContaining({
        audience: "all",
        composition: "linen",
        name: "Updated uploaded shirt",
      }),
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("wardrobe-card-wardrobe-uploaded"),
      ).toHaveTextContent("Updated uploaded shirt");
    });
    expect(screen.getByTestId("product-detail-dialog")).toHaveTextContent(
      "Updated uploaded shirt",
    );
  });

  test("opens needs-review uploaded product details directly in edit mode", async () => {
    const user = userEvent.setup();
    api.fetchMyWardrobeItems.mockResolvedValueOnce({
      items: [
        {
          id: "wardrobe-uploaded",
          name: "",
          source: "uploaded",
          imageUrl: "https://example.com/uploaded.jpg",
          processingStatus: "needs_review",
          audience: null,
          category: null,
          season: [],
        },
      ],
    });
    renderScreen();

    await user.click(
      await screen.findByTestId("wardrobe-card-wardrobe-uploaded"),
    );

    expect(
      screen.getByTestId("uploaded-product-detail-dialog"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("product-detail-dialog"),
    ).not.toBeInTheDocument();
  });

  test("reloads when source filter changes", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(screen.getByRole("button", { name: "Uploaded" }));

    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
        force: false,
      });
    });
  });

  test("renders empty and error states", async () => {
    api.fetchMyWardrobeItems.mockResolvedValueOnce({ items: [] });
    renderScreen();

    expect(await screen.findByText("No saved items yet")).toBeInTheDocument();

    cleanup();
    api.fetchMyWardrobeItems.mockRejectedValueOnce(new Error("down"));
    renderScreen();

    expect(
      await screen.findByText("Failed to load Personal items."),
    ).toBeInTheDocument();
  });
});
