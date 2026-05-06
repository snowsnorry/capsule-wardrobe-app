import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMainScreenProps, renderWithTheme, resetMainScreenTestMocks, t } from "./MainScreen.testUtils";
import CapsuleActionMenu from "./CapsuleActionMenu";
import MainScreenMenus from "./MainScreenMenus";

type MenusProps = ComponentProps<typeof MainScreenMenus>;
type CapsuleActionMenuProps = ComponentProps<typeof CapsuleActionMenu>;

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

function createCapsuleActionMenuProps(overrides: Partial<CapsuleActionMenuProps> = {}): CapsuleActionMenuProps {
  return {
    anchorEl: createAnchor(),
    open: true,
    onClose: vi.fn(),
    capsule: { id: "capsule-1", name: "Spring edit", draft: null, saved: null, status: "new" },
    disabled: false,
    showRegenerateAll: false,
    onRegenerateAll: vi.fn(),
    onDownloadPdf: vi.fn(),
    onRename: vi.fn(),
    onRevert: vi.fn(),
    onSave: vi.fn(),
    onDuplicate: vi.fn(),
    onShare: vi.fn(),
    allowUnknownShareContent: false,
    showCardLayout: false,
    mobileCardColumns: 2,
    onMobileCardColumnsChange: vi.fn(),
    onDelete: vi.fn(),
    ...overrides
  };
}

function renderCapsuleActionMenu(overrides: Partial<CapsuleActionMenuProps> = {}) {
  const props = createCapsuleActionMenuProps(overrides);
  return { props, ...renderWithTheme(<CapsuleActionMenu {...props} />) };
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
});

describe("CapsuleActionMenu", () => {
  beforeEach(() => {
    resetMainScreenTestMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  test("shows mobile card layout controls only when requested and reports selected columns", async () => {
    const user = userEvent.setup();
    const onMobileCardColumnsChange = vi.fn();
    renderCapsuleActionMenu({
      showCardLayout: true,
      mobileCardColumns: 2,
      onMobileCardColumnsChange
    });

    expect(screen.getByText("Card layout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 column" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "2 columns" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "3 columns" }));
    expect(onMobileCardColumnsChange).toHaveBeenCalledWith(3);

    cleanup();
    renderCapsuleActionMenu({ showCardLayout: false });
    expect(screen.queryByText("Card layout")).not.toBeInTheDocument();
  });

  test("shows Save as for capsules with saved content and hides it for never-saved capsules", () => {
    renderCapsuleActionMenu({
      capsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: null,
        saved: { filters: {}, data: {} },
        status: "saved"
      }
    });

    expect(screen.getByRole("menuitem", { name: "Save as..." })).toBeInTheDocument();

    cleanup();
    renderCapsuleActionMenu({
      capsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: { filters: { locale: "en" }, data: {} },
        saved: null,
        status: "new"
      }
    });

    expect(screen.queryByRole("menuitem", { name: "Save as..." })).not.toBeInTheDocument();
  });

  test("shows share only for shareable capsules or unknown row content when allowed", () => {
    renderCapsuleActionMenu({
      capsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: { data: { wardrobe: { items: [{ url: "https://example.com/1" }] } } },
        saved: null,
        status: "new"
      }
    });

    expect(screen.getByRole("menuitem", { name: "Share" })).toBeInTheDocument();

    cleanup();
    renderCapsuleActionMenu({
      capsule: { id: "capsule-2", name: "Summer edit", status: "saved" },
      allowUnknownShareContent: true
    });
    expect(screen.getByRole("menuitem", { name: "Share" })).toBeInTheDocument();

    cleanup();
    renderCapsuleActionMenu({
      capsule: { id: "capsule-3", name: "Empty edit", status: "new" }
    });
    expect(screen.queryByRole("menuitem", { name: "Share" })).not.toBeInTheDocument();
  });

  test("does not call action callbacks while disabled", async () => {
    const onDownloadPdf = vi.fn();
    renderCapsuleActionMenu({ disabled: true, onDownloadPdf });

    expect(screen.getByRole("menuitem", { name: "Export as PDF" })).toHaveAttribute("aria-disabled", "true");
    expect(onDownloadPdf).not.toHaveBeenCalled();
  });
});
