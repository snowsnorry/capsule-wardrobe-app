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
import MyWardrobeScreen from "./MyWardrobeScreen";

const api = vi.hoisted(() => ({
  deleteUploadedWardrobeItem: vi.fn(),
  downloadMyWardrobePdf: vi.fn(),
  fetchMyWardrobeItems: vi.fn(),
  removeCatalogItemFromMyWardrobe: vi.fn(),
  updateUploadedWardrobeItem: vi.fn(),
  uploadWardrobeImages: vi.fn(),
  uploadWardrobeUrls: vi.fn(),
}));
const useI18nMock = vi.hoisted(() => vi.fn());
const useMediaQueryMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("../api/myWardrobe", () => api);
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
    onProductMenuClick,
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
            onProductMenuClick?.(
              event,
              item.url || (allowProductMenuWithoutUrl ? item.id : ""),
              item,
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
  "myWardrobe.title": "My Wardrobe",
  "myWardrobe.subtitle":
    "Saved catalog pieces and uploaded items in one place.",
  "myWardrobe.upload": "Upload item photo",
  "myWardrobe.uploadMenu": "Choose upload method",
  "myWardrobe.uploadMenuLabel": "Upload methods",
  "myWardrobe.uploadPhoto": "Upload photo",
  "myWardrobe.uploadUrl": "Upload URL",
  "myWardrobe.openMenu": "Open My Wardrobe menu",
  "myWardrobe.downloadFailed": "Failed to export My Wardrobe PDF.",
  "myWardrobe.filterLabel": "My Wardrobe source",
  "myWardrobe.loadFailed": "Failed to load My Wardrobe.",
  "myWardrobe.removeFailed": "Failed to remove from My Wardrobe.",
  "myWardrobe.updateFailed": "Failed to update the item.",
  "myWardrobe.uploadFailed": "Failed to upload wardrobe photos.",
  "myWardrobe.urlUploadFailed": "Failed to upload product URLs.",
  "myWardrobe.failedUploadBadge": "Failed",
  "myWardrobe.noCategoryBadge": "No category",
  "myWardrobe.needsReviewBadge": "Needs review",
  "myWardrobe.deleteUploaded": "Delete item",
  "myWardrobe.deleteUploadedConfirmTitle": "Delete uploaded item?",
  "myWardrobe.deleteUploadedConfirmBody":
    "This uploaded item and its images will be permanently deleted.",
  "myWardrobe.deleteUploadedConfirm": "Delete",
  "myWardrobe.removeConfirmTitle": "Remove from My Wardrobe?",
  "myWardrobe.removeConfirmBody":
    "This product will be removed from My Wardrobe.",
  "myWardrobe.removeConfirm": "Remove",
  "myWardrobe.emptyTitle": "No saved items yet",
  "myWardrobe.emptyBody":
    "Save products from a capsule or upload item photos later.",
  "myWardrobe.filters.all": "All",
  "myWardrobe.filters.uploaded": "Uploaded",
  "myWardrobe.filters.fromCatalog": "From Catalog",
  "myWardrobe.uploadDialog.title": "Upload wardrobe photos",
  "myWardrobe.uploadDialog.body":
    "Use one image per garment. Photograph the item laid flat or neatly hung, fully visible, with no other clothing in frame, against a plain, even background.",
  "myWardrobe.uploadDialog.dropzoneLabel": "Choose wardrobe photos",
  "myWardrobe.uploadDialog.dropzoneTitle": "Drop images here",
  "myWardrobe.uploadDialog.dropzoneHint": "JPEG, PNG, or WebP. Up to 5 files.",
  "myWardrobe.uploadDialog.mobileDropzoneTitle": "Choose photos",
  "myWardrobe.uploadDialog.mobileDropzoneHint":
    "JPEG, PNG, or WebP. Up to 5 files, 10 MB each.",
  "myWardrobe.uploadDialog.fileList": "Selected files",
  "myWardrobe.uploadDialog.selectedSummary": "{count} files, {size}",
  "myWardrobe.uploadDialog.removeFile": "Remove {name}",
  "myWardrobe.uploadDialog.upload": "Upload",
  "myWardrobe.uploadDialog.uploadedStatus": "Uploaded: {image_count}",
  "myWardrobe.uploadDialog.metadataProcessedStatus":
    "Metadata processed: {image_count}",
  "myWardrobe.uploadDialog.imageProcessedStatus":
    "Images processed: {image_count}",
  "myWardrobe.uploadDialog.failedStatus": "Failed: {image_count}",
  "myWardrobe.uploadDialog.tooManyFiles": "Upload up to 5 files.",
  "myWardrobe.uploadDialog.invalidType": "Use JPEG, PNG, or WebP images.",
  "myWardrobe.uploadDialog.fileTooLarge": "Each image must be 10 MB or less.",
  "myWardrobe.urlUploadDialog.title": "Upload product URLs",
  "myWardrobe.urlUploadDialog.body":
    "Add product page links from online stores. Each accepted product becomes an uploaded wardrobe item.",
  "myWardrobe.urlUploadDialog.fieldLabel": "Product URL {index}",
  "myWardrobe.urlUploadDialog.placeholder": "https://shop.example.com/product",
  "myWardrobe.urlUploadDialog.helperText":
    "Use a product page URL starting with http:// or https://.",
  "myWardrobe.urlUploadDialog.invalidUrl":
    "Enter a URL that starts with http:// or https://.",
  "myWardrobe.urlUploadDialog.upload": "Upload URLs",
  "capsule.exportPdf": "Export as PDF",
  "capsule.cardLayout": "Card layout",
  "capsule.cardColumnsOne": "1 column",
  "capsule.cardColumnsTwo": "2 columns",
  "capsule.cardColumnsThree": "3 columns",
  "capsule.removeFromMyWardrobe": "Remove from My Wardrobe",
  "actions.cancel": "Cancel",
  "actions.edit": "Edit",
};

function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MyWardrobeScreen />
    </ThemeProvider>,
  );
}

describe("MyWardrobeScreen", () => {
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

    expect(screen.queryByText("My Wardrobe")).not.toBeInTheDocument();
    const uploadButton = screen.getByRole("button", {
      name: "Upload item photo",
    });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toHaveClass("MuiButton-outlined");
    expect(
      screen.getByRole("button", { name: "Open My Wardrobe menu" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "My Wardrobe source" }),
    ).toBeInTheDocument();
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

  test("uses a compact source dropdown on mobile", async () => {
    useMediaQueryMock.mockReturnValue(true);
    const user = userEvent.setup();
    renderScreen();

    const uploadButton = screen.getByRole("button", {
      name: "Upload item photo",
    });
    expect(uploadButton).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open My Wardrobe menu" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "My Wardrobe source" }),
    ).not.toBeInTheDocument();

    const sourceSelect = screen.getByRole("combobox", {
      name: "My Wardrobe source",
    });
    expect(sourceSelect).toHaveTextContent("All");

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(sourceSelect);
    await user.click(screen.getByRole("option", { name: "Uploaded" }));

    await waitFor(() => {
      expect(api.fetchMyWardrobeItems).toHaveBeenLastCalledWith({
        source: "uploaded",
        force: false,
      });
    });
  });

  test("keeps the mobile wardrobe surface from creating horizontal page overflow", async () => {
    useMediaQueryMock.mockReturnValue(true);
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");

    expect(
      getComputedStyle(screen.getByTestId("my-wardrobe-screen")).overflowX,
    ).toBe("hidden");
    expect(
      getComputedStyle(screen.getByTestId("my-wardrobe-content")).boxSizing,
    ).toBe("border-box");
  });

  test("opens upload dialog as a full-screen mobile picker", async () => {
    useMediaQueryMock.mockReturnValue(true);
    const user = userEvent.setup();
    renderScreen();

    await screen.findByTestId("wardrobe-card-wardrobe-1");
    await user.click(screen.getByRole("button", { name: "Upload item photo" }));

    const dialog = screen.getByRole("dialog", {
      name: "Upload wardrobe photos",
    });
    expect(dialog).toHaveClass("MuiDialog-paperFullScreen");
    expect(within(dialog).getByText("Choose photos")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "JPEG, PNG, or WebP. Up to 5 files, 10 MB each.",
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
      name: "Upload product URLs",
    });
    expect(dialog).toHaveClass("MuiDialog-paperFullScreen");
    expect(within(dialog).getByLabelText("Product URL 1")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Add product page links from online stores. Each accepted product becomes an uploaded wardrobe item.",
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

    expect(screen.getByText("Upload wardrobe photos")).toBeInTheDocument();
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
    expect(screen.getByText("Upload wardrobe photos")).toBeInTheDocument();
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
        screen.queryByText("Upload wardrobe photos"),
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
      name: "Upload product URLs",
    });
    const uploadButton = within(dialog).getByRole("button", {
      name: "Upload URLs",
    });
    expect(uploadButton).toBeDisabled();

    const firstUrlInput = within(dialog).getByLabelText("Product URL 1");
    await user.type(firstUrlInput, "example.com/product");
    expect(
      within(dialog).getByText(
        "Enter a URL that starts with http:// or https://.",
      ),
    ).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();

    await user.clear(firstUrlInput);
    await user.type(firstUrlInput, "https://shop.example.com/product-1");
    expect(within(dialog).getByLabelText("Product URL 2")).toBeInTheDocument();
    expect(uploadButton).toBeEnabled();

    await user.type(
      within(dialog).getByLabelText("Product URL 2"),
      "http://shop.example.com/product-2",
    );
    await user.type(
      within(dialog).getByLabelText("Product URL 3"),
      "https://shop.example.com/product-3",
    );
    await user.type(
      within(dialog).getByLabelText("Product URL 4"),
      "https://shop.example.com/product-4",
    );
    await user.type(
      within(dialog).getByLabelText("Product URL 5"),
      "https://shop.example.com/product-5",
    );
    expect(
      within(dialog).queryByLabelText("Product URL 6"),
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
      expect(screen.queryByText("Upload product URLs")).not.toBeInTheDocument();
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
      screen.getByRole("button", { name: "Open My Wardrobe menu" }),
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
      screen.getByRole("button", { name: "Open My Wardrobe menu" }),
    );
    expect(screen.getByText("Card layout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "3 columns" }));

    expect(screen.getByTestId("wardrobe-card-wardrobe-1")).toHaveAttribute(
      "data-mobile-columns",
      "3",
    );
    expect(window.localStorage.getItem("myWardrobe.mobileCardColumns")).toBe(
      "3",
    );
  });

  test("removes an item from the card product menu", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      await screen.findByRole("button", { name: "open product menu" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Remove from My Wardrobe" }),
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
      await screen.findByText("Failed to load My Wardrobe."),
    ).toBeInTheDocument();
  });
});
