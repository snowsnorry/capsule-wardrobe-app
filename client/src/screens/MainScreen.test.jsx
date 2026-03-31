import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const mediaQueryMock = vi.hoisted(() => vi.fn());
const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock
}));
vi.mock("../i18n/useI18n.js", () => ({
  useI18n: useI18nMock
}));
vi.mock("../components/AppLauncher.jsx", () => ({
  default: ({ currentApp }) => <div data-testid="app-launcher">{currentApp}</div>
}));
vi.mock("../components/LocaleSwitcher.jsx", () => ({
  default: () => <div data-testid="locale-switcher">locale-switcher</div>
}));
vi.mock("../components/ProfileFiltersSidebar.jsx", () => ({
  default: ({ onApply, onReset, onSignOut }) => (
    <div data-testid="profile-filters-sidebar">
      <button type="button" onClick={onApply}>apply-filters</button>
      <button type="button" onClick={onReset}>reset-filters</button>
      {typeof onSignOut === "function" ? (
        <button type="button" onClick={onSignOut}>sign-out</button>
      ) : null}
    </div>
  )
}));
vi.mock("../components/ClothingGridPlaceholder.jsx", () => ({
  default: ({ count, inline }) => (
    <div data-testid={inline ? `inline-placeholder-${count}` : "loading-placeholder"} />
  ),
  ClothingPlaceholderCard: ({ placeholderKey }) => (
    <div data-testid={`placeholder-card-${placeholderKey}`} />
  )
}));
vi.mock("../components/ClothingCard.jsx", () => ({
  default: ({ item, isSelected, isSelectable, isRegenerating, onToggleSelected }) => (
    <button
      type="button"
      data-testid={`clothing-card-${item.url}`}
      data-selected={String(isSelected)}
      data-selectable={String(isSelectable)}
      data-regenerating={String(isRegenerating)}
      onClick={() => onToggleSelected(item)}
    >
      {item.name}
    </button>
  )
}));

import MainScreen from "./MainScreen.jsx";

const theme = createTheme();

function t(key, params) {
  const labels = {
    appName: "Capsule Wardrobe",
    filters: {
      open: "Open filters",
      apply: "Apply",
      cancel: "Cancel",
      title: "Filters"
    },
    actions: {
      signOut: "Sign out",
      cancel: "Cancel",
      ok: "OK",
      delete: "Delete",
      save: "Save",
      close: "Close"
    },
    capsule: {
      new: "New capsule",
      search: "Search capsules",
      yourCapsules: "Your capsules",
      notSaved: "Not saved",
      regenerateAll: "Regenerate all",
      exportPdf: "Export as PDF",
      rename: "Rename",
      revert: "Revert",
      saveAs: "Save as...",
      saveAsTitle: "Save as",
      renameTitle: "Rename capsule",
      deleteTitle: "Delete capsule",
      revertTitle: "Revert changes",
      deleteConfirm: "Delete",
      revertConfirm: "Revert",
      searchPlaceholder: "Search capsules...",
      searchPrevious7Days: "Previous 7 Days",
      searchPrevious30Days: "Previous 30 Days",
      searchEarlier: "Earlier",
      closeFilters: "Close filters",
      openMenu: "Open capsule menu"
    },
    main: {
      cancelSelection: "Cancel",
      regenerateSelected: `Regenerate Selected (${params?.count ?? 0})`,
      download: "Download capsule PDF",
      refresh: "Refresh wardrobe"
    },
    dialogs: {
      signOutTitle: "Sign out",
      signOutBody: "Are you sure you want to sign out?",
      signOutCancel: "Cancel",
      signOutConfirm: "Sign out"
    }
  };

  return key.split(".").reduce((current, part) => current?.[part], labels) || key;
}

function renderScreen(props = {}, { mobile = false, layoutMode = mobile ? "overlay" : "medium" } = {}) {
  mediaQueryMock.mockImplementation((query) => {
    if (String(query).includes("max-width: 1279.95px")) {
      return layoutMode === "overlay";
    }
    if (String(query).includes("min-width: 1680px")) {
      return layoutMode === "large";
    }
    return false;
  });
  useI18nMock.mockReturnValue({ t });

  const defaults = {
    activeCapsule: { id: "capsule-1", name: "Spring edit", draft: null, saved: null, status: "new" },
    capsuleList: [{ id: "capsule-1", name: "Spring edit", status: "new" }],
    onSignOut: vi.fn(),
    isSigningOut: false,
    onRefreshItems: vi.fn(),
    onDownloadPdf: vi.fn(),
    onCreateCapsule: vi.fn(),
    onOpenCapsule: vi.fn(() => Promise.resolve()),
    onSaveCapsule: vi.fn(() => Promise.resolve()),
    onRevertCapsule: vi.fn(() => Promise.resolve()),
    onRenameCapsule: vi.fn(() => Promise.resolve()),
    onDuplicateCapsule: vi.fn(() => Promise.resolve()),
    onDeleteCapsule: vi.fn(() => Promise.resolve()),
    onSearchCapsules: vi.fn(() => Promise.resolve([])),
    items: [],
    isLoadingItems: false,
    isContentBusy: false,
    isDownloadingPdf: false,
    showAdditionalItemPlaceholder: false,
    styleOptions: { core: ["casual"], aesthetics: ["minimalistic"] },
    occasionOptions: ["office"],
    seasonOptions: ["summer"],
    audienceOptions: ["woman"],
    accentColorOptions: ["blue"],
    patternOptions: ["solid"],
    selectedStyleCore: "casual",
    selectedStyleAesthetic: null,
    selectedOccasions: ["office"],
    selectedSeasons: ["summer"],
    selectedAudience: "woman",
    selectedAccentColor: null,
    selectedPattern: null,
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn(),
    onToggleOccasion: vi.fn(),
    onToggleSeason: vi.fn(),
    onSelectAudience: vi.fn(),
    onSelectAccentColor: vi.fn(),
    onSelectPattern: vi.fn(),
    onApplyFilters: vi.fn(),
    onResetFilters: vi.fn(),
    onNavigateApp: vi.fn(),
    selectedRegenerationUrls: [],
    partialRegenerationPendingUrls: [],
    onToggleRegenerationSelection: vi.fn(),
    onCancelRegenerationSelection: vi.fn(),
    onRegenerateSelectedItems: vi.fn(),
    isPartialRegenerationLoading: false
  };

  return {
    ...defaults,
    ...props,
    ...render(
      <ThemeProvider theme={theme}>
        <MainScreen {...defaults} {...props} />
      </ThemeProvider>
    )
  };
}

describe("MainScreen", () => {
  beforeEach(() => {
    cleanup();
    mediaQueryMock.mockReset();
    useI18nMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders loading placeholder and disables action buttons while loading", () => {
    renderScreen({
      items: [],
      isLoadingItems: true,
      isContentBusy: true,
      isDownloadingPdf: true
    });

    expect(screen.getByTestId("loading-placeholder")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate all" })).toBeDisabled();
  });

  test("exposes overlay, medium desktop, and large desktop sidebar modes", async () => {
    const user = userEvent.setup();

    renderScreen({}, { mobile: true });
    expect(screen.getByTestId("main-screen-shell")).toHaveAttribute("data-sidebar-mode", "overlay");
    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(await screen.findByText("New capsule")).toBeInTheDocument();

    cleanup();
    renderScreen({}, { layoutMode: "medium" });
    expect(screen.getByTestId("main-screen-shell")).toHaveAttribute("data-sidebar-mode", "desktop-medium");
    expect(screen.getAllByRole("button", { name: "Toggle sidebar" })).toHaveLength(1);

    cleanup();
    renderScreen({}, { layoutMode: "large" });
    expect(screen.getByTestId("main-screen-shell")).toHaveAttribute("data-sidebar-mode", "desktop-large");
    expect(screen.getAllByRole("button", { name: "Toggle sidebar" })).toHaveLength(1);
  });

  test("renders grid items, pending placeholders, and regeneration actions when selection exists", async () => {
    const user = userEvent.setup();
    const onToggleRegenerationSelection = vi.fn();
    const onCancelRegenerationSelection = vi.fn();
    const onRegenerateSelectedItems = vi.fn();

    renderScreen({
      items: [
        { id: "b", url: "https://example.com/b", name: "Blazer", category: "outerwear" },
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "c", url: "https://example.com/c", name: "Trousers", category: "bottom" }
      ],
      selectedRegenerationUrls: ["https://example.com/a"],
      partialRegenerationPendingUrls: ["https://example.com/b"],
      showAdditionalItemPlaceholder: true,
      onToggleRegenerationSelection,
      onCancelRegenerationSelection,
      onRegenerateSelectedItems
    });

    expect(screen.getByTestId("placeholder-card-pending-https://example.com/b")).toBeInTheDocument();
    expect(screen.getByTestId("clothing-card-https://example.com/a")).toHaveAttribute("data-selected", "true");
    expect(screen.queryByRole("button", { name: "Download capsule PDF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh wardrobe" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate Selected (1)" })).toBeInTheDocument();
    expect(screen.getByTestId("inline-placeholder-1")).toBeInTheDocument();

    await user.click(screen.getByTestId("clothing-card-https://example.com/c"));
    expect(onToggleRegenerationSelection).toHaveBeenCalledWith({ id: "c", url: "https://example.com/c", name: "Trousers", category: "bottom" });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancelRegenerationSelection).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Regenerate Selected (1)" }));
    expect(onRegenerateSelectedItems).toHaveBeenCalledTimes(1);
  });

  test("opens mobile filters dialog and closes it through apply and reset actions", async () => {
    const user = userEvent.setup();
    const onApplyFilters = vi.fn(() => Promise.resolve());
    const onResetFilters = vi.fn(() => Promise.resolve());

    renderScreen({
      onApplyFilters,
      onResetFilters
    }, { mobile: true });

    await user.click(screen.getByRole("button", { name: "Open filters" }));
    expect(screen.getAllByText("apply-filters").length).toBeGreaterThan(0);
    expect(screen.getAllByText("reset-filters").length).toBeGreaterThan(0);

    await user.click(screen.getAllByText("apply-filters").at(-1));
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryAllByTestId("profile-filters-sidebar").length).toBe(1);
    });

    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await user.click(screen.getAllByText("reset-filters").at(-1));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryAllByTestId("profile-filters-sidebar").length).toBe(1);
    });
  });

  test("moves regenerate all into the header menu on mobile", async () => {
    const user = userEvent.setup();
    const onRefreshItems = vi.fn();

    renderScreen({ onRefreshItems }, { mobile: true });

    expect(screen.queryByRole("button", { name: "Regenerate all" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Regenerate all" }));

    expect(onRefreshItems).toHaveBeenCalledTimes(1);
  });

  test("opens user menu and signs out", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderScreen({ onSignOut });

    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    await user.click(screen.getByRole("menuitem", { name: /Sign out|actions\.signOut/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test("optimistically highlights a clicked capsule before open request resolves", async () => {
    const user = userEvent.setup();
    let resolveOpen;
    const onOpenCapsule = vi.fn(() => new Promise((resolve) => {
      resolveOpen = resolve;
    }));

    renderScreen({
      activeCapsule: { id: "capsule-1", name: "Spring edit", draft: null, saved: null, status: "saved" },
      capsuleList: [
        { id: "capsule-1", name: "Spring edit", status: "saved" },
        { id: "capsule-2", name: "Summer edit", status: "saved" }
      ],
      onOpenCapsule
    });

    const capsuleList = screen.getByRole("list");
    const springRow = within(capsuleList).getByText("Spring edit").closest(".MuiListItemButton-root");
    const summerRow = within(capsuleList).getByText("Summer edit").closest(".MuiListItemButton-root");

    expect(springRow).toHaveClass("Mui-selected");
    expect(summerRow).not.toHaveClass("Mui-selected");

    await user.click(within(capsuleList).getByText("Summer edit"));

    expect(onOpenCapsule).toHaveBeenCalledWith("capsule-2");
    expect(summerRow).toHaveClass("Mui-selected");
    expect(springRow).not.toHaveClass("Mui-selected");

    resolveOpen();
  });

  test("deletes a sidebar capsule row by its explicit capsule id", async () => {
    const user = userEvent.setup();
    const onDeleteCapsule = vi.fn(() => Promise.resolve());

    renderScreen({
      activeCapsule: { id: "capsule-1", name: "Spring edit", draft: null, saved: null, status: "saved" },
      capsuleList: [
        { id: "capsule-1", name: "Spring edit", status: "saved" },
        { id: "capsule-2", name: "Summer edit", status: "new" }
      ],
      onDeleteCapsule
    });

    await user.click(screen.getByLabelText("Capsule actions Summer edit"));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1));

    expect(onDeleteCapsule).toHaveBeenCalledWith("capsule-2");
  });
});
