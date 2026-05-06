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
});
