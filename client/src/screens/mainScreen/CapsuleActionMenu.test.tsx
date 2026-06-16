import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithTheme,
  resetMainScreenTestMocks,
} from "./MainScreen.testUtils";
import CapsuleActionMenu from "./CapsuleActionMenu";

type CapsuleActionMenuProps = ComponentProps<typeof CapsuleActionMenu>;

function createAnchor() {
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  return anchor;
}

function createCapsuleActionMenuProps(
  overrides: Partial<CapsuleActionMenuProps> = {},
): CapsuleActionMenuProps {
  return {
    anchorEl: createAnchor(),
    open: true,
    onClose: vi.fn(),
    capsule: {
      id: "capsule-1",
      name: "Spring edit",
      draft: null,
      saved: null,
      status: "new",
    },
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
    ...overrides,
  };
}

function renderCapsuleActionMenu(
  overrides: Partial<CapsuleActionMenuProps> = {},
) {
  const props = createCapsuleActionMenuProps(overrides);
  return { props, ...renderWithTheme(<CapsuleActionMenu {...props} />) };
}

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
      onMobileCardColumnsChange,
    });

    expect(screen.getByText("Card layout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 column" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "2 columns" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

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
        status: "saved",
      },
    });

    expect(
      screen.getByRole("menuitem", { name: "Save as..." }),
    ).toBeInTheDocument();

    cleanup();
    renderCapsuleActionMenu({
      capsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: { filters: { locale: "en" }, data: {} },
        saved: null,
        status: "new",
      },
    });

    expect(
      screen.queryByRole("menuitem", { name: "Save as..." }),
    ).not.toBeInTheDocument();
  });

  test("shows share only for shareable capsules or unknown row content when allowed", () => {
    renderCapsuleActionMenu({
      capsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: {
          data: { wardrobe: { items: [{ url: "https://example.com/1" }] } },
        },
        saved: null,
        status: "new",
      },
    });

    expect(screen.getByRole("menuitem", { name: "Share" })).toBeInTheDocument();

    cleanup();
    renderCapsuleActionMenu({
      capsule: { id: "capsule-2", name: "Summer edit", status: "saved" },
      allowUnknownShareContent: true,
    });
    expect(screen.getByRole("menuitem", { name: "Share" })).toBeInTheDocument();

    cleanup();
    renderCapsuleActionMenu({
      capsule: { id: "capsule-3", name: "Empty edit", status: "new" },
    });
    expect(
      screen.queryByRole("menuitem", { name: "Share" }),
    ).not.toBeInTheDocument();
  });

  test("shows pin actions above rename and toggles capsule pin state", async () => {
    const user = userEvent.setup();
    const onSetPin = vi.fn();
    renderCapsuleActionMenu({ onSetPin });

    const menuLabels = screen
      .getAllByRole("menuitem")
      .map((item) => item.textContent || "");
    expect(menuLabels.indexOf("Pin capsule")).toBeLessThan(
      menuLabels.indexOf("Rename"),
    );

    await user.click(screen.getByRole("menuitem", { name: "Pin capsule" }));

    expect(onSetPin).toHaveBeenCalledWith(true);

    cleanup();
    const onUnpin = vi.fn();
    renderCapsuleActionMenu({
      onSetPin: onUnpin,
      pinCopyPrefix: "outfit",
      capsule: {
        id: "outfit-1",
        name: "Weekend",
        pin: true,
        draft: null,
        saved: null,
        status: "saved",
      },
    });

    await user.click(screen.getByRole("menuitem", { name: "Unpin outfit" }));

    expect(onUnpin).toHaveBeenCalledWith(false);
  });

  test("does not call action callbacks while disabled", async () => {
    const onDownloadPdf = vi.fn();
    renderCapsuleActionMenu({ disabled: true, onDownloadPdf });

    expect(
      screen.getByRole("menuitem", { name: "Export as PDF" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(onDownloadPdf).not.toHaveBeenCalled();
  });
});
