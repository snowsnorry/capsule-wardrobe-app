import React, { useState } from "react";
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
  default: () => <div data-testid="profile-filters-sidebar">profile-filters-sidebar</div>
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
  default: ({ item, onToggleSelected }) => (
    <button
      type="button"
      data-testid={`clothing-card-${item.id}`}
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

function MainScreenFlowHarness({ onRefreshItems, onDownloadPdf, onRegenerateSelectedItems }) {
  const [selectedRegenerationIds, setSelectedRegenerationIds] = useState([]);
  const [partialRegenerationPendingIds, setPartialRegenerationPendingIds] = useState([]);

  return (
    <MainScreen
      onSignOut={vi.fn()}
      isSigningOut={false}
      onRefreshItems={onRefreshItems}
      onDownloadPdf={onDownloadPdf}
      items={[
        { id: "b", name: "Blazer", category: "outerwear" },
        { id: "a", name: "Shirt", category: "top" },
        { id: "c", name: "Trousers", category: "bottom" }
      ]}
      isLoadingItems={false}
      isDownloadingPdf={false}
      showAdditionalItemPlaceholder={false}
      styleOptions={{ core: ["casual"], aesthetics: ["minimalistic"] }}
      occasionOptions={["office"]}
      seasonOptions={["summer"]}
      audienceOptions={["woman"]}
      accentColorOptions={["blue"]}
      patternOptions={["solid"]}
      selectedStyleCore="casual"
      selectedStyleAesthetic={null}
      selectedOccasions={["office"]}
      selectedSeasons={["summer"]}
      selectedAudience="woman"
      selectedAccentColor={null}
      selectedPattern={null}
      status={{ loading: false, error: "", infoKey: "", infoParams: null }}
      onSelectStyleCore={vi.fn()}
      onSelectStyleAesthetic={vi.fn()}
      onToggleOccasion={vi.fn()}
      onToggleSeason={vi.fn()}
      onSelectAudience={vi.fn()}
      onSelectAccentColor={vi.fn()}
      onSelectPattern={vi.fn()}
      onApplyFilters={vi.fn()}
      onResetFilters={vi.fn()}
      onNavigateApp={vi.fn()}
      selectedRegenerationIds={selectedRegenerationIds}
      partialRegenerationPendingIds={partialRegenerationPendingIds}
      onToggleRegenerationSelection={(item) => {
        const itemId = String(item.id);
        setSelectedRegenerationIds((current) => (
          current.includes(itemId)
            ? current.filter((id) => id !== itemId)
            : [...current, itemId]
        ));
      }}
      onCancelRegenerationSelection={() => {
        setSelectedRegenerationIds([]);
      }}
      onRegenerateSelectedItems={() => {
        onRegenerateSelectedItems(selectedRegenerationIds);
        setPartialRegenerationPendingIds(selectedRegenerationIds);
        setSelectedRegenerationIds([]);
      }}
      isPartialRegenerationLoading={false}
    />
  );
}

function renderScreen(props = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MainScreenFlowHarness {...props} />
    </ThemeProvider>
  );
}

describe("MainScreen e2e-style flow", () => {
  beforeEach(() => {
    cleanup();
    mediaQueryMock.mockReset();
    mediaQueryMock.mockReturnValue(false);
    useI18nMock.mockReset();
    useI18nMock.mockReturnValue({ t });
  });

  afterEach(() => {
    cleanup();
  });

  test("covers refresh, selection, regenerate-selected, and PDF download happy path", async () => {
    const user = userEvent.setup();
    const onRefreshItems = vi.fn();
    const onDownloadPdf = vi.fn();
    const onRegenerateSelectedItems = vi.fn();

    renderScreen({
      onRefreshItems,
      onDownloadPdf,
      onRegenerateSelectedItems
    });

    await user.click(screen.getByRole("button", { name: "Download capsule PDF" }));
    await user.click(screen.getByRole("button", { name: "Refresh wardrobe" }));

    expect(onDownloadPdf).toHaveBeenCalledTimes(1);
    expect(onRefreshItems).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("clothing-card-a"));
    expect(screen.getByRole("button", { name: "Regenerate Selected (1)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Regenerate Selected (1)" }));
    expect(onRegenerateSelectedItems).toHaveBeenCalledWith(["a"]);

    await waitFor(() => {
      expect(screen.getByTestId("placeholder-card-pending-a")).toBeInTheDocument();
    });
  });
});
