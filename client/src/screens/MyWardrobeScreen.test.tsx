import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import MyWardrobeScreen from "./MyWardrobeScreen";

const api = vi.hoisted(() => ({
  downloadMyWardrobePdf: vi.fn(),
  fetchMyWardrobeItems: vi.fn(),
  removeCatalogItemFromMyWardrobe: vi.fn(),
  uploadWardrobeImages: vi.fn(),
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
            onProductMenuClick?.(event, item.url, item);
          }}
        >
          open product menu
        </button>
      ) : null}
    </div>
  ),
}));
vi.mock("../components/productDetail/ProductDetailDialog", () => ({
  default: ({ item, open, onClose, onRemoveFromMyWardrobe }) =>
    open ? (
      <div data-testid="product-detail-dialog">
        {item?.name}
        <button type="button" onClick={onClose}>
          close product
        </button>
        <button type="button" onClick={() => onRemoveFromMyWardrobe?.(item)}>
          dialog remove product
        </button>
      </div>
    ) : null,
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
  "myWardrobe.openMenu": "Open My Wardrobe menu",
  "myWardrobe.downloadFailed": "Failed to export My Wardrobe PDF.",
  "myWardrobe.filterLabel": "My Wardrobe source",
  "myWardrobe.loadFailed": "Failed to load My Wardrobe.",
  "myWardrobe.removeFailed": "Failed to remove from My Wardrobe.",
  "myWardrobe.uploadFailed": "Failed to upload wardrobe photos.",
  "myWardrobe.failedUploadBadge": "Failed",
  "myWardrobe.noCategoryBadge": "No category",
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
  "capsule.exportPdf": "Export as PDF",
  "capsule.cardLayout": "Card layout",
  "capsule.cardColumnsOne": "1 column",
  "capsule.cardColumnsTwo": "2 columns",
  "capsule.cardColumnsThree": "3 columns",
  "capsule.removeFromMyWardrobe": "Remove from My Wardrobe",
  "actions.cancel": "Cancel",
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
    api.fetchMyWardrobeItems.mockReset();
    api.removeCatalogItemFromMyWardrobe.mockReset();
    api.removeCatalogItemFromMyWardrobe.mockResolvedValue({ ok: true });
    api.uploadWardrobeImages.mockReset();
    api.uploadWardrobeImages.mockResolvedValue({ ok: true, items: [] });
    api.fetchMyWardrobeItems.mockResolvedValue({
      items: [
        {
          id: "wardrobe-1",
          name: "Linen Shirt",
          url: "https://example.com/1",
          image_url: "https://example.com/1.jpg",
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
