import { useState } from "react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMainScreenProps,
  fetchUploadedWardrobeItemDetailMock,
  renderWithTheme,
  resetMainScreenTestMocks,
  theme,
} from "./MainScreen.testUtils";
import MainScreenDialogs from "./MainScreenDialogs";

type DialogsProps = ComponentProps<typeof MainScreenDialogs>;
type ConfirmState = DialogsProps["confirm"];
type NameDialogState = DialogsProps["nameDialog"];
type SearchState = DialogsProps["search"];
type ShareState = DialogsProps["share"];

function DialogHarness({
  activeImageSrc = "",
  activeSetLabel = 1,
  initialConfirm = { action: "", capsuleId: "", outfitSetIndex: -1 },
  initialFiltersOpen = false,
  initialImageDialogOpen = false,
  initialNameDialog = { type: "", capsuleId: "", value: "" },
  initialProductDetailItem = null,
  initialSearch = { open: false, query: "", results: [], loading: false },
  initialShare = {
    open: false,
    url: "",
    expiresAt: null,
    name: "",
    copied: false,
    loading: false,
  },
  interactionDisabled = false,
  isOverlay = false,
  onCloseRowMenu = vi.fn(),
  propsOverrides = {},
}: {
  activeImageSrc?: string;
  activeSetLabel?: number;
  initialConfirm?: ConfirmState;
  initialFiltersOpen?: boolean;
  initialImageDialogOpen?: boolean;
  initialNameDialog?: NameDialogState;
  initialProductDetailItem?: DialogsProps["productDetailItem"];
  initialSearch?: SearchState;
  initialShare?: ShareState;
  interactionDisabled?: boolean;
  isOverlay?: boolean;
  onCloseRowMenu?: () => void;
  propsOverrides?: Partial<DialogsProps["props"]>;
}) {
  const [confirm, setConfirm] = useState(initialConfirm);
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);
  const [imageDialogOpen, setImageDialogOpen] = useState(
    initialImageDialogOpen,
  );
  const [nameDialog, setNameDialog] = useState(initialNameDialog);
  const [productDetailItem, setProductDetailItem] = useState<
    DialogsProps["productDetailItem"]
  >(initialProductDetailItem);
  const [search, setSearch] = useState(initialSearch);
  const [share, setShare] = useState<ShareState>({
    loading: false,
    ...initialShare,
  });
  const props = createMainScreenProps(propsOverrides);

  return (
    <MainScreenDialogs
      activeImageSrc={activeImageSrc}
      activeSetLabel={activeSetLabel}
      confirm={confirm}
      filtersOpen={filtersOpen}
      imageDialogOpen={imageDialogOpen}
      interactionDisabled={interactionDisabled}
      isOverlay={isOverlay}
      nameDialog={nameDialog}
      productDetailItem={productDetailItem}
      props={props}
      search={search}
      share={share}
      setConfirm={setConfirm}
      setFiltersOpen={setFiltersOpen}
      setImageDialogOpen={setImageDialogOpen}
      setNameDialog={setNameDialog}
      setProductDetailItem={setProductDetailItem}
      setSearch={setSearch}
      setShare={setShare}
      onOpenCapsule={props.onOpenCapsule}
      onCloseRowMenu={onCloseRowMenu}
    />
  );
}

function renderDialogs(props: ComponentProps<typeof DialogHarness>) {
  return renderWithTheme(<DialogHarness {...props} />);
}

describe("MainScreenDialogs", () => {
  beforeEach(() => {
    resetMainScreenTestMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("closes mobile filters dialog through apply and reset actions", async () => {
    const user = userEvent.setup();
    const onApplyFilters = vi.fn(() => Promise.resolve());
    const onResetFilters = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialFiltersOpen: true,
      isOverlay: true,
      propsOverrides: { onApplyFilters, onResetFilters },
    });

    expect(screen.getAllByTestId("profile-filters-sidebar")).toHaveLength(1);
    const content = screen
      .getByTestId("profile-filters-sidebar")
      .closest(".MuiDialogContent-root");
    const footer = screen
      .getByTestId("profile-filters-actions")
      .closest(".MuiDialogActions-root");
    expect(footer).not.toBeNull();
    expect(content!.contains(footer)).toBe(false);
    expect(getComputedStyle(footer!).justifyContent).toBe("flex-end");
    expect(
      screen
        .getByText("reset-filters")
        .compareDocumentPosition(screen.getByText("apply-filters")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await user.click(screen.getByText("apply-filters"));
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.queryByTestId("profile-filters-sidebar"),
      ).not.toBeInTheDocument();
    });

    cleanup();
    renderDialogs({
      initialFiltersOpen: true,
      isOverlay: true,
      propsOverrides: { onApplyFilters, onResetFilters },
    });
    await user.click(screen.getByText("reset-filters"));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.queryByTestId("profile-filters-sidebar"),
      ).not.toBeInTheDocument();
    });
  });

  test("opens and closes the product detail dialog", async () => {
    const user = userEvent.setup();
    renderDialogs({
      initialProductDetailItem: {
        id: "shirt",
        name: "Linen Shirt",
        url: "https://example.com/shirt",
        imageUrl: "https://example.com/shirt.jpg",
        price: 79,
        currency: "EUR",
      },
    });

    expect(screen.getByText("Linen Shirt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /linen shirt/i })).toHaveAttribute(
      "href",
      "https://example.com/shirt",
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByText("Linen Shirt")).not.toBeInTheDocument();
    });
  });

  test("shows blocked share dialog without copy controls", () => {
    renderDialogs({
      initialShare: {
        open: true,
        url: "",
        expiresAt: null,
        name: "Private capsule",
        copied: false,
        loading: false,
        blockedReason: "personal_uploaded_items",
      },
    });

    expect(
      screen.getByRole("dialog", { name: "Can't share this capsule" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/personal uploaded wardrobe items can't be shared/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy share link" }),
    ).not.toBeInTheDocument();
  });

  test("keeps mobile share dialog close action at the header edge", () => {
    renderDialogs({
      isOverlay: true,
      initialShare: {
        open: true,
        url: "https://client.example/share/share-1",
        expiresAt: null,
        name: "Spring edit",
        copied: false,
        loading: false,
      },
    });

    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    expect(closeButtons).toHaveLength(1);
    const closeButton = closeButtons[0];
    expect(closeButton.closest(".MuiStack-root")).toHaveStyle({
      width: "100%",
    });
  });

  test("opens needs-review uploaded capsule item directly in mobile edit mode with standard header", () => {
    const onUpdateUploadedWardrobeItem = vi.fn((item) => Promise.resolve(item));
    renderDialogs({
      isOverlay: true,
      initialProductDetailItem: {
        id: "Wuploaded-1",
        name: "",
        source: "uploaded",
        url: "wardrobe://uploaded-1",
        imageUrl: "https://example.com/uploaded.jpg",
        processingStatus: "needs_review",
        audience: "",
        category: "",
        season: [],
      },
      propsOverrides: { onUpdateUploadedWardrobeItem },
    });

    const title = screen.getByText("Product details");
    expect(title.closest(".MuiDialogTitle-root")).toHaveStyle({
      backgroundColor: theme.palette.background.paper,
      minHeight: "60px",
      paddingTop: "12px",
      paddingBottom: "8px",
    });
    expect(document.querySelector(".MuiDialogContent-root")).toHaveStyle({
      backgroundColor: theme.palette.background.default,
      paddingLeft: "24px",
      paddingRight: "24px",
      paddingTop: "8px",
      paddingBottom: "24px",
    });
    const content = document.querySelector(".MuiDialogContent-root");
    const footer = screen
      .getByRole("button", { name: "Apply" })
      .closest(".MuiDialogActions-root");
    const applyButton = screen.getByRole("button", { name: "Apply" });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(footer).not.toBeNull();
    expect(content!.contains(footer)).toBe(false);
    expect(getComputedStyle(footer!).justifyContent).toBe("flex-end");
    expect(
      cancelButton.compareDocumentPosition(applyButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByLabelText(/Name/).closest(".MuiStack-root")).toHaveStyle(
      {
        paddingTop: "6px",
      },
    );
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Product actions" }),
    ).toBeNull();
    expect(
      document.querySelector(".uploaded-detail-camera-icon"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Select a product")).not.toBeInTheDocument();
  });

  test("switches uploaded capsule item from read mode to edit mode", async () => {
    const user = userEvent.setup();
    const onUpdateUploadedWardrobeItem = vi.fn((_item, payload) =>
      Promise.resolve({
        id: "Wuploaded-1",
        name: payload.name,
        source: "uploaded",
        url: "wardrobe://uploaded-1",
        imageUrl: "https://example.com/uploaded.jpg",
        processingStatus: "ready",
        audience: payload.audience,
        category: payload.category,
        season: payload.season,
      }),
    );
    renderDialogs({
      initialProductDetailItem: {
        id: "Wuploaded-1",
        name: "Uploaded shirt",
        source: "uploaded",
        url: "wardrobe://uploaded-1",
        imageUrl: "https://example.com/uploaded.jpg",
        processingStatus: "ready",
        audience: "all",
        category: "top",
        season: ["summer"],
      },
      propsOverrides: { onUpdateUploadedWardrobeItem },
    });

    expect(screen.getByText("Uploaded shirt")).toBeInTheDocument();
    expect(
      screen.getByTestId("product-detail-dialog-image-pane"),
    ).toBeVisible();
    await user.click(
      await screen.findByRole("button", { name: "Product actions" }),
    );
    expect(
      screen.queryByRole("menuitem", { name: "Save to Wardrobe" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(screen.getByText("Product details")).toBeInTheDocument();
    expect(
      screen.getByTestId("product-detail-dialog-image-pane"),
    ).toBeVisible();
    const editFormScroll = screen.getByTestId(
      "uploaded-capsule-edit-form-scroll",
    );
    const editActions = screen
      .getByRole("button", { name: "Apply" })
      .closest(".MuiDialogActions-root");
    expect(editFormScroll).toHaveStyle({
      flex: "1",
      minHeight: "0",
      overflowY: "auto",
    });
    expect(editActions).not.toBeNull();
    expect(getComputedStyle(editActions!).flexShrink).toBe("0");
    expect(editActions!.closest(".MuiDialogContent-root")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Product details")).not.toBeInTheDocument();
    expect(screen.getByText("Uploaded shirt")).toBeInTheDocument();
    expect(
      screen.getByTestId("product-detail-dialog-image-pane"),
    ).toBeVisible();

    await user.click(
      await screen.findByRole(
        "button",
        { name: "Product actions" },
        { timeout: 5000 },
      ),
    );
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(screen.queryByText("Product details")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Uploaded shirt")).toBeInTheDocument();
    expect(onUpdateUploadedWardrobeItem).toHaveBeenCalledTimes(1);
  });

  test("switches wardrobe-url capsule item to edit mode after fetched uploaded detail", async () => {
    const user = userEvent.setup();
    fetchUploadedWardrobeItemDetailMock.mockResolvedValueOnce({
      item: {
        id: "uploaded-1",
        name: "Uploaded shirt",
        source: "uploaded",
        url: "wardrobe://uploaded-1",
        imageUrl: "https://example.com/uploaded.jpg",
        processingStatus: "ready",
        audience: "all",
        category: "top",
        season: ["summer"],
      },
    });
    renderDialogs({
      initialProductDetailItem: {
        id: "Wuploaded-1",
        name: "Uploaded shirt",
        url: "wardrobe://uploaded-1",
        imageUrl: "https://example.com/uploaded.jpg",
      },
    });

    await waitFor(() => {
      expect(fetchUploadedWardrobeItemDetailMock).toHaveBeenCalledWith(
        "uploaded-1",
      );
    });
    await user.click(screen.getByRole("button", { name: "Product actions" }));
    expect(
      screen.queryByRole("menuitem", { name: "Save to Wardrobe" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(screen.getByText("Product details")).toBeInTheDocument();
    expect(screen.queryByText("Select a product")).not.toBeInTheDocument();
  });

  test("closes rename dialog immediately and calls rename callback", async () => {
    const user = userEvent.setup();
    let resolveRename: (() => void) | undefined;
    const onRenameCapsule = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRename = resolve;
        }),
    );
    renderDialogs({
      initialNameDialog: {
        type: "rename",
        capsuleId: "capsule-1",
        value: "Spring edit",
      },
      propsOverrides: { onRenameCapsule },
    });

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const okButton = screen.getByRole("button", { name: "OK" });
    expect(okButton).toHaveClass("MuiButton-contained");
    expect(
      cancelButton.compareDocumentPosition(okButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(okButton);

    expect(onRenameCapsule).toHaveBeenCalledWith("Spring edit", "capsule-1");
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Rename capsule" }),
      ).not.toBeInTheDocument();
    });
    resolveRename?.();
  });

  test("save-as dialog calls duplicate callback with entered name", async () => {
    const user = userEvent.setup();
    const onDuplicateCapsule = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialNameDialog: {
        type: "save-as",
        capsuleId: "capsule-1",
        value: "Spring copy",
      },
      propsOverrides: { onDuplicateCapsule },
    });

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(onDuplicateCapsule).toHaveBeenCalledWith("Spring copy", "capsule-1");
  });

  test("updates and cancels name dialog without submitting", async () => {
    const user = userEvent.setup();
    const onRenameCapsule = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialNameDialog: {
        type: "rename",
        capsuleId: "capsule-1",
        value: "Spring edit",
      },
      propsOverrides: { onRenameCapsule },
    });

    await user.clear(screen.getByRole("textbox"));
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
    await user.type(screen.getByRole("textbox"), "Travel edit");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRenameCapsule).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Rename capsule" }),
      ).not.toBeInTheDocument();
    });
  });

  test("runs regenerate and apply-filter confirm actions", async () => {
    const user = userEvent.setup();
    const onRefreshItems = vi.fn(() => Promise.resolve());
    const onApplyFilters = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialConfirm: {
        action: "regenerate-all",
        capsuleId: "",
        outfitSetIndex: -1,
      },
      propsOverrides: { onRefreshItems, onApplyFilters },
    });

    expect(
      screen.getByText(
        "This will replace the current items in this capsule. Continue?",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRefreshItems).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Regenerate capsule?" }),
      ).not.toBeInTheDocument();
    });

    cleanup();
    renderDialogs({
      initialConfirm: {
        action: "regenerate-with-filter-changes",
        capsuleId: "",
        outfitSetIndex: -1,
      },
      propsOverrides: { onRefreshItems, onApplyFilters },
    });
    await user.click(
      screen.getByRole("button", { name: "Apply and regenerate" }),
    );
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
  });

  test("runs image delete and row delete/revert confirm actions with explicit ids", async () => {
    const user = userEvent.setup();
    const onDeleteOutfitSetImage = vi.fn(() => Promise.resolve());
    const onDeleteCapsule = vi.fn(() => Promise.resolve());
    const onRevertCapsule = vi.fn(() => Promise.resolve());
    const onCloseRowMenu = vi.fn();
    renderDialogs({
      initialConfirm: {
        action: "delete-outfit-set-image",
        capsuleId: "",
        outfitSetIndex: 2,
      },
      propsOverrides: {
        onDeleteOutfitSetImage,
        onDeleteCapsule,
        onRevertCapsule,
      },
      onCloseRowMenu,
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteOutfitSetImage).toHaveBeenCalledWith(2);

    cleanup();
    renderDialogs({
      initialConfirm: {
        action: "delete-row",
        capsuleId: "capsule-2",
        outfitSetIndex: -1,
      },
      propsOverrides: {
        onDeleteOutfitSetImage,
        onDeleteCapsule,
        onRevertCapsule,
      },
      onCloseRowMenu,
    });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteCapsule).toHaveBeenCalledWith("capsule-2");
    expect(onCloseRowMenu).toHaveBeenCalledTimes(1);

    cleanup();
    renderDialogs({
      initialConfirm: {
        action: "revert-row",
        capsuleId: "capsule-2",
        outfitSetIndex: -1,
      },
      propsOverrides: {
        onDeleteOutfitSetImage,
        onDeleteCapsule,
        onRevertCapsule,
      },
      onCloseRowMenu,
    });
    await user.click(screen.getByRole("button", { name: "Revert" }));
    expect(onRevertCapsule).toHaveBeenCalledWith("capsule-2");
    expect(onCloseRowMenu).toHaveBeenCalledTimes(2);
  });

  test("runs capsule-level delete and revert confirm actions", async () => {
    const user = userEvent.setup();
    const onDeleteCapsule = vi.fn(() => Promise.resolve());
    const onRevertCapsule = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialConfirm: { action: "delete", capsuleId: "", outfitSetIndex: -1 },
      propsOverrides: { onDeleteCapsule, onRevertCapsule },
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteCapsule).toHaveBeenCalledWith();

    cleanup();
    renderDialogs({
      initialConfirm: { action: "revert", capsuleId: "", outfitSetIndex: -1 },
      propsOverrides: { onDeleteCapsule, onRevertCapsule },
    });
    await user.click(screen.getByRole("button", { name: "Revert" }));
    expect(onRevertCapsule).toHaveBeenCalledWith();
  });

  test("ignores image delete confirm without a valid outfit set index", async () => {
    const user = userEvent.setup();
    const onDeleteOutfitSetImage = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialConfirm: {
        action: "delete-outfit-set-image",
        capsuleId: "",
        outfitSetIndex: -1,
      },
      propsOverrides: { onDeleteOutfitSetImage },
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDeleteOutfitSetImage).not.toHaveBeenCalled();
  });

  test("updates search dialog query, opens a result, and closes the dialog", async () => {
    const user = userEvent.setup();
    const onOpenCapsule = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialSearch: {
        open: true,
        query: "spring",
        loading: true,
        results: [
          { id: "capsule-1", name: "Spring edit", status: "new" },
          { id: "capsule-2", name: "Earlier travel", status: "modified" },
        ],
      },
      propsOverrides: { onOpenCapsule },
    });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText("Search capsules..."));
    await user.type(
      screen.getByPlaceholderText("Search capsules..."),
      "travel",
    );
    await user.click(screen.getByRole("button", { name: /Earlier travel/ }));

    expect(onOpenCapsule).toHaveBeenCalledWith("capsule-2");
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("Search capsules..."),
      ).not.toBeInTheDocument();
    });
  });

  test("renders share dialog link and copies its URL", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderDialogs({
      initialShare: {
        open: true,
        url: "https://client.example/share/share-1",
        expiresAt: new Date(60_000).toISOString(),
        name: "Spring edit",
        copied: false,
        loading: false,
      },
    });

    expect(
      screen.getByRole("dialog", { name: "Share capsule" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Spring edit" })).toHaveAttribute(
      "href",
      "https://client.example/share/share-1",
    );
    await user.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(writeText).toHaveBeenCalledWith(
      "https://client.example/share/share-1",
    );
  });

  test("opens and closes full-size outfit set image dialog", async () => {
    const user = userEvent.setup();
    renderDialogs({
      activeImageSrc: "data:image/png;base64,abc123",
      initialImageDialogOpen: true,
    });

    expect(screen.getByTestId("outfit-set-image-dialog")).toBeInTheDocument();
    expect(
      screen.getByTestId("outfit-set-image-dialog-paper"),
    ).toBeInTheDocument();
    expect(document.head.textContent).toContain(
      "background-color:transparent;box-shadow:none;",
    );
    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(
        screen.queryByTestId("outfit-set-image-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  test("keeps disabled media dialogs open and handles missing image sources", async () => {
    renderDialogs({
      initialFiltersOpen: true,
      initialImageDialogOpen: true,
      interactionDisabled: true,
      activeImageSrc: "",
      activeSetLabel: undefined,
    });

    expect(screen.getByTestId("profile-filters-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("outfit-set-image-dialog")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    expect(closeButtons.at(-1)).toBeDisabled();

    expect(screen.getByTestId("outfit-set-image-dialog")).toBeInTheDocument();
  });

  test("respects disabled state when dialogs receive backdrop or escape close events", async () => {
    renderDialogs({
      initialFiltersOpen: true,
      initialImageDialogOpen: true,
      interactionDisabled: true,
      activeImageSrc: "data:image/png;base64,abc123",
    });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByTestId("profile-filters-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("outfit-set-image-dialog")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });
});
