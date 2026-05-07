import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMainScreenProps, renderWithTheme, resetMainScreenTestMocks, t } from "./MainScreen.testUtils";
import MainScreenMenus from "./MainScreenMenus";

type MenusProps = ComponentProps<typeof MainScreenMenus>;

function createAnchor() {
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  return anchor;
}

function createMenusProps(overrides: Partial<MenusProps> = {}): MenusProps {
  const anchor = createAnchor();
  return {
    activeName: "Spring edit",
    disabled: false,
    headerMenuAnchor: null,
    isOverlay: false,
    mobileColumns: 2,
    productMenu: {
      anchor,
      url: "https://example.com/a",
      item: { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" }
    },
    props: createMainScreenProps(),
    rowMenuAnchor: null,
    rowMenuCapsule: null,
    setConfirm: vi.fn(),
    setHeaderMenuAnchor: vi.fn(),
    setNameDialog: vi.fn(),
    setProductMenu: vi.fn(),
    setRowMenuAnchor: vi.fn(),
    setRowMenuCapsule: vi.fn(),
    setSelectionMode: vi.fn(),
    onRegenerateAll: vi.fn(),
    onShareCapsule: vi.fn(),
    onUpdateColumns: vi.fn(),
    t,
    ...overrides
  };
}

function renderMenus(overrides: Partial<MenusProps> = {}) {
  const props = createMenusProps(overrides);
  return { props, ...renderWithTheme(<MainScreenMenus {...props} />) };
}

describe("MainScreenMenus", () => {
  beforeEach(() => {
    resetMainScreenTestMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  test("selects a product for regeneration from the product menu", async () => {
    const user = userEvent.setup();
    const setSelectionMode = vi.fn();
    const onToggleRegenerationSelection = vi.fn();
    renderMenus({
      props: createMainScreenProps({ onToggleRegenerationSelection }),
      setSelectionMode
    });

    await user.click(screen.getByRole("menuitem", { name: "Select" }));

    expect(setSelectionMode).toHaveBeenCalledWith(true);
    expect(onToggleRegenerationSelection).toHaveBeenCalledWith({
      id: "a",
      url: "https://example.com/a",
      name: "Shirt",
      category: "top"
    });
  });

  test("copies product URL and shows product in search from the product menu", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    const onNavigateApp = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    renderMenus({ props: createMainScreenProps({ onNavigateApp }) });

    await user.click(screen.getByRole("menuitem", { name: "Copy Link Address" }));
    expect(writeText).toHaveBeenCalledWith("https://example.com/a");

    await user.click(screen.getByRole("menuitem", { name: "Show Product Info" }));
    expect(onNavigateApp).toHaveBeenCalledWith("explore", {
      query: "https://example.com/a",
      openProductDetail: true
    });
  });

  test("runs header menu actions and mobile layout update", async () => {
    const user = userEvent.setup();
    const anchor = createAnchor();
    const onDownloadPdf = vi.fn();
    const onSaveCapsule = vi.fn(() => Promise.resolve());
    const onShareCapsule = vi.fn();
    const onUpdateColumns = vi.fn();
    const setConfirm = vi.fn();
    const setHeaderMenuAnchor = vi.fn();
    const setNameDialog = vi.fn();
    renderMenus({
      headerMenuAnchor: anchor,
      isOverlay: true,
      props: createMainScreenProps({
        activeCapsule: {
          id: "capsule-1",
          name: "Spring edit",
          status: "modified",
          saved: { data: { wardrobe: { items: [{ id: "a" }] } } },
          draft: null
        },
        onDownloadPdf,
        onSaveCapsule
      }),
      setConfirm,
      setHeaderMenuAnchor,
      setNameDialog,
      onShareCapsule,
      onUpdateColumns,
      productMenu: { anchor: null, url: "", item: null }
    });

    await user.click(screen.getByRole("menuitem", { name: "Export as PDF" }));
    expect(setHeaderMenuAnchor).toHaveBeenCalledWith(null);
    expect(onDownloadPdf).toHaveBeenCalledWith();

    await user.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(onShareCapsule).toHaveBeenCalledWith(expect.objectContaining({ id: "capsule-1" }));

    await user.click(screen.getByRole("button", { name: "3 columns" }));
    expect(onUpdateColumns).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(setNameDialog).toHaveBeenCalledWith({ type: "rename", capsuleId: "capsule-1", value: "Spring edit" });

    await user.click(screen.getByRole("menuitem", { name: "Revert" }));
    expect(setConfirm).toHaveBeenCalledWith({ action: "revert", capsuleId: "", outfitSetIndex: -1 });

    await user.click(screen.getByRole("menuitem", { name: "Save" }));
    expect(onSaveCapsule).toHaveBeenCalledWith();

    await user.click(screen.getByRole("menuitem", { name: "Save as..." }));
    expect(setNameDialog).toHaveBeenCalledWith({ type: "save-as", capsuleId: "capsule-1", value: "Spring edit" });

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(setConfirm).toHaveBeenCalledWith({ action: "delete", capsuleId: "", outfitSetIndex: -1 });
  });

  test("runs row menu actions with the row capsule id", async () => {
    const user = userEvent.setup();
    const anchor = createAnchor();
    const onDownloadPdf = vi.fn();
    const onSaveCapsule = vi.fn(() => Promise.resolve());
    const onShareCapsule = vi.fn();
    const setConfirm = vi.fn();
    const setNameDialog = vi.fn();
    const setRowMenuAnchor = vi.fn();
    const setRowMenuCapsule = vi.fn();
    renderMenus({
      rowMenuAnchor: anchor,
      rowMenuCapsule: {
        id: "capsule-2",
        name: "Travel",
        status: "modified",
        saved: { data: { wardrobe: { items: [{ id: "b" }] } } },
        draft: null
      },
      props: createMainScreenProps({ onDownloadPdf, onSaveCapsule }),
      setConfirm,
      setNameDialog,
      setRowMenuAnchor,
      setRowMenuCapsule,
      onShareCapsule,
      productMenu: { anchor: null, url: "", item: null }
    });

    await user.click(screen.getByRole("menuitem", { name: "Export as PDF" }));
    expect(setRowMenuAnchor).toHaveBeenCalledWith(null);
    expect(setRowMenuCapsule).toHaveBeenCalledWith(null);
    expect(onDownloadPdf).toHaveBeenCalledWith("capsule-2");

    await user.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(onShareCapsule).toHaveBeenCalledWith(expect.objectContaining({ id: "capsule-2" }), true);

    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(setNameDialog).toHaveBeenCalledWith({ type: "rename", capsuleId: "capsule-2", value: "Travel" });

    await user.click(screen.getByRole("menuitem", { name: "Revert" }));
    expect(setConfirm).toHaveBeenCalledWith({ action: "revert-row", capsuleId: "capsule-2", outfitSetIndex: -1 });

    await user.click(screen.getByRole("menuitem", { name: "Save" }));
    expect(onSaveCapsule).toHaveBeenCalledWith("capsule-2");

    await user.click(screen.getByRole("menuitem", { name: "Save as..." }));
    expect(setNameDialog).toHaveBeenCalledWith({ type: "save-as", capsuleId: "capsule-2", value: "Travel" });

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(setConfirm).toHaveBeenCalledWith({ action: "delete-row", capsuleId: "capsule-2", outfitSetIndex: -1 });
  });

  test("handles missing optional menu data without dispatching item actions", async () => {
    const user = userEvent.setup();
    const headerAnchor = createAnchor();
    const setNameDialog = vi.fn();
    const setSelectionMode = vi.fn();
    const onToggleRegenerationSelection = vi.fn();
    const onNavigateApp = vi.fn();
    renderMenus({
      headerMenuAnchor: headerAnchor,
      productMenu: { anchor: null, url: "", item: null },
      props: createMainScreenProps({
        activeCapsule: { id: "", name: "", status: "new", saved: null, draft: null },
        onSaveCapsule: undefined,
        onToggleRegenerationSelection,
        onNavigateApp
      }),
      setNameDialog,
      setSelectionMode
    });

    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(setNameDialog).toHaveBeenCalledWith({ type: "rename", capsuleId: "", value: "Spring edit" });

    await user.click(screen.getByRole("menuitem", { name: "Save" }));

    cleanup();
    const productAnchor = createAnchor();
    renderMenus({
      productMenu: { anchor: productAnchor, url: "", item: null },
      props: createMainScreenProps({
        onToggleRegenerationSelection,
        onNavigateApp
      }),
      setSelectionMode
    });

    await user.click(screen.getByRole("menuitem", { name: "Select" }));
    expect(setSelectionMode).not.toHaveBeenCalled();
    expect(onToggleRegenerationSelection).not.toHaveBeenCalled();

    await user.click(screen.getByRole("menuitem", { name: "Show Product Info" }));
    expect(onNavigateApp).not.toHaveBeenCalled();
  });
});
