import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithTheme,
  resetMainScreenTestMocks,
} from "./MainScreen.testUtils";
import MainScreenHeader from "./MainScreenHeader";

type HeaderProps = ComponentProps<typeof MainScreenHeader>;

function createHeaderProps(overrides: Partial<HeaderProps> = {}): HeaderProps {
  return {
    activeCapsule: {
      id: "capsule-1",
      name: "Spring edit",
      draft: null,
      saved: null,
      status: "saved",
    },
    activeName: "Spring edit",
    disabled: false,
    inlineRename: {
      active: false,
      value: "Spring edit",
      setValue: vi.fn(),
      start: vi.fn(),
      cancel: vi.fn(),
      submit: vi.fn(() => Promise.resolve()),
    },
    isOverlay: false,
    selectedCount: 0,
    summary: ["3 items", "1 outfits", "Formal"],
    onCancelSelection: vi.fn(),
    onOpenFilters: vi.fn(),
    onOpenMenu: vi.fn(),
    onRegenerateAll: vi.fn(),
    onRegenerateSelected: vi.fn(),
    ...overrides,
  };
}

function renderHeader(overrides: Partial<HeaderProps> = {}) {
  const props = createHeaderProps(overrides);
  return { props, ...renderWithTheme(<MainScreenHeader {...props} />) };
}

describe("MainScreenHeader", () => {
  beforeEach(() => {
    resetMainScreenTestMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("shows desktop title, summary, regenerate action, and menu trigger", async () => {
    const user = userEvent.setup();
    const onRegenerateAll = vi.fn();
    const onOpenMenu = vi.fn();
    renderHeader({ onRegenerateAll, onOpenMenu });

    expect(
      screen.getByRole("button", { name: "Rename capsule Spring edit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 items")).toBeInTheDocument();
    expect(screen.getByText("1 outfits")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Regenerate all" }));
    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));

    expect(onRegenerateAll).toHaveBeenCalledTimes(1);
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  test("shows selection actions instead of normal capsule actions", async () => {
    const user = userEvent.setup();
    const onCancelSelection = vi.fn();
    const onRegenerateSelected = vi.fn();
    renderHeader({ selectedCount: 2, onCancelSelection, onRegenerateSelected });

    expect(
      screen.queryByRole("button", { name: "Regenerate all" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open capsule menu" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      screen.getByRole("button", { name: "Regenerate Selected (2)" }),
    );

    expect(onCancelSelection).toHaveBeenCalledTimes(1);
    expect(onRegenerateSelected).toHaveBeenCalledTimes(1);
  });

  test("enters inline rename from title and pencil, then submits or cancels through input events", async () => {
    const user = userEvent.setup();
    const start = vi.fn();
    const setValue = vi.fn();
    const submit = vi.fn(() => Promise.resolve());
    const cancel = vi.fn();
    renderHeader({
      inlineRename: {
        active: false,
        value: "Spring edit",
        setValue,
        start,
        submit,
        cancel,
      },
    });

    await user.click(
      screen.getByRole("button", { name: "Rename capsule Spring edit" }),
    );
    await user.click(screen.getByRole("button", { name: "Edit capsule name" }));
    expect(start).toHaveBeenCalledTimes(2);

    cleanup();
    renderHeader({
      inlineRename: {
        active: true,
        value: "Spring edit",
        setValue,
        start,
        submit,
        cancel,
      },
    });
    const input = screen.getByRole("textbox", { name: "Capsule name" });
    fireEvent.change(input, { target: { value: "Summer edit" } });
    await user.keyboard("{Enter}");

    expect(setValue).toHaveBeenCalledWith("Summer edit");
    expect(submit).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("submits inline rename on blur", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(() => Promise.resolve());
    renderHeader({
      inlineRename: {
        ...createHeaderProps().inlineRename,
        active: true,
        submit,
      },
    });

    await user.click(screen.getByRole("textbox", { name: "Capsule name" }));
    await user.tab();

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });
  });

  test("keeps mobile filters button and summary out while selection is active", () => {
    renderHeader({ isOverlay: true, selectedCount: 1 });

    expect(
      screen.queryByRole("button", { name: "Open filters" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Spring edit")).not.toBeInTheDocument();
    expect(screen.queryByText("3 items")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Regenerate Selected (1)" }),
    ).toBeInTheDocument();
  });

  test("shows mobile filters button and summary when selection is inactive", () => {
    renderHeader({ isOverlay: true, selectedCount: 0 });

    expect(
      screen.getByRole("button", { name: "Open filters" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 items")).toBeInTheDocument();
    expect(screen.getByText("1 outfits")).toBeInTheDocument();
  });

  test("keeps unsaved dot before the pencil trigger in the desktop header", () => {
    renderHeader({
      activeCapsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: { filters: { locale: "en" }, data: {} },
        saved: null,
        status: "new",
      },
    });

    const renameButton = screen.getByRole("button", {
      name: "Edit capsule name",
    });
    const renameContainer = renameButton.parentElement?.parentElement;
    const unsavedDot = renameContainer?.querySelector(
      "svg[data-testid='FiberManualRecordRoundedIcon']",
    );

    expect(unsavedDot).not.toBeNull();
    expect(
      unsavedDot?.compareDocumentPosition(renameButton.parentElement),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
