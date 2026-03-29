import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
      <button type="button" onClick={onSignOut}>sign-out</button>
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
      data-testid={`clothing-card-${item.id}`}
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
      cancel: "Cancel"
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

function renderScreen(props = {}, { mobile = false } = {}) {
  mediaQueryMock.mockReturnValue(mobile);
  useI18nMock.mockReturnValue({ t });

  const defaults = {
    onSignOut: vi.fn(),
    isSigningOut: false,
    onRefreshItems: vi.fn(),
    onDownloadPdf: vi.fn(),
    items: [],
    isLoadingItems: false,
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
    selectedRegenerationIds: [],
    partialRegenerationPendingIds: [],
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
      isDownloadingPdf: true
    });

    expect(screen.getByTestId("loading-placeholder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download capsule PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh wardrobe" })).toBeDisabled();
  });

  test("renders grid items, pending placeholders, and regeneration actions when selection exists", async () => {
    const user = userEvent.setup();
    const onToggleRegenerationSelection = vi.fn();
    const onCancelRegenerationSelection = vi.fn();
    const onRegenerateSelectedItems = vi.fn();

    renderScreen({
      items: [
        { id: "b", name: "Blazer", category: "outerwear" },
        { id: "a", name: "Shirt", category: "top" },
        { id: "c", name: "Trousers", category: "bottom" }
      ],
      selectedRegenerationIds: ["a"],
      partialRegenerationPendingIds: ["b"],
      showAdditionalItemPlaceholder: true,
      onToggleRegenerationSelection,
      onCancelRegenerationSelection,
      onRegenerateSelectedItems
    });

    expect(screen.getByTestId("placeholder-card-pending-b")).toBeInTheDocument();
    expect(screen.getByTestId("clothing-card-a")).toHaveAttribute("data-selected", "true");
    expect(screen.queryByRole("button", { name: "Download capsule PDF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh wardrobe" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate Selected (1)" })).toBeInTheDocument();
    expect(screen.getByTestId("inline-placeholder-1")).toBeInTheDocument();

    await user.click(screen.getByTestId("clothing-card-c"));
    expect(onToggleRegenerationSelection).toHaveBeenCalledWith({ id: "c", name: "Trousers", category: "bottom" });

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

    await user.click(screen.getByLabelText("Open filters"));
    expect(screen.getAllByText("apply-filters").length).toBeGreaterThan(0);
    expect(screen.getAllByText("reset-filters").length).toBeGreaterThan(0);

    await user.click(screen.getAllByText("apply-filters").at(-1));
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryAllByTestId("profile-filters-sidebar").length).toBe(1);
    });

    await user.click(screen.getByLabelText("Open filters"));
    await user.click(screen.getAllByText("reset-filters").at(-1));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryAllByTestId("profile-filters-sidebar").length).toBe(1);
    });
  });

  test("shows sign-out confirmation and respects cancel and confirm actions", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderScreen({ onSignOut });

    await user.click(screen.getByText("sign-out"));
    expect(screen.getByText("Are you sure you want to sign out?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSignOut).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText("Are you sure you want to sign out?")).not.toBeInTheDocument();
    });

    await user.click(screen.getByText("sign-out"));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
