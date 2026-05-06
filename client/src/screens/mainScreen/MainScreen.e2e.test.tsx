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
vi.mock("../i18n/useI18n", () => ({
  useI18n: useI18nMock
}));
vi.mock("../components/AppLauncher", () => ({
  default: ({ currentApp }) => <div data-testid="app-launcher">{currentApp}</div>
}));
vi.mock("../components/LocaleSwitcher", () => ({
  default: () => <div data-testid="locale-switcher">locale-switcher</div>
}));
vi.mock("../components/ProfileFiltersSidebar", () => ({
  default: ({ onApply, onReset }) => (
    <div data-testid="profile-filters-sidebar">
      <button type="button" onClick={onApply}>apply-filters</button>
      <button type="button" onClick={onReset}>reset-filters</button>
    </div>
  )
}));
vi.mock("../components/ClothingGridPlaceholder", () => ({
  default: ({ count, inline, mobileColumns }) => (
    <div
      data-testid={inline ? `inline-placeholder-${count}` : "loading-placeholder"}
      data-mobile-columns={String(mobileColumns ?? 2)}
    />
  ),
  ClothingPlaceholderCard: ({ placeholderKey, mobileColumns }) => (
    <div
      data-testid={`placeholder-card-${placeholderKey}`}
      data-mobile-columns={String(mobileColumns ?? 2)}
    />
  ),
  buildClothingGridTemplateColumns: (mobileColumns = 2) => ({
    xs: `repeat(${mobileColumns}, minmax(0, 1fr))`,
    sm: "repeat(2, minmax(0, 1fr))",
    lg: "repeat(2, minmax(0, 1fr))"
  }),
  buildClothingGridGap: (mobileColumns = 2) => ({
    xs: mobileColumns === 1 ? 1.25 : 0,
    sm: 2.5
  }),
  clothingGridTemplateColumns: {
    xs: "repeat(2, minmax(0, 1fr))",
    sm: "repeat(2, minmax(0, 1fr))",
    lg: "repeat(2, minmax(0, 1fr))"
  },
  clothingGridGap: {
    xs: 1.25,
    sm: 2.5
  }
}));
vi.mock("../components/ClothingCard", () => ({
  default: ({ item, isSelectionMode, onToggleSelected, onProductMenuClick }) => (
    <button
      type="button"
      data-testid={`clothing-card-${item.url}`}
      data-selection-mode={String(isSelectionMode)}
      onClick={(event) => (
        isSelectionMode
          ? onToggleSelected(item)
          : onProductMenuClick?.(event, item.url, item)
      )}
    >
      {item.name}
    </button>
  )
}));

import MainScreen from "./MainScreen";

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
      deleteConfirmBody: "Are you sure you want to delete this capsule? This action cannot be undone.",
      revertConfirmBody: "Discard the current unsaved changes and restore the last saved version of this capsule?",
      regenerateAllTitle: "Regenerate capsule?",
      regenerateAllConfirmBody: "This will replace the current items in this capsule. Continue?",
      regenerateAllConfirm: "Regenerate",
      deleteConfirm: "Delete",
      revertConfirm: "Revert",
      searchPlaceholder: "Search capsules...",
      searchPrevious7Days: "Previous 7 Days",
      searchPrevious30Days: "Previous 30 Days",
      searchEarlier: "Earlier",
      closeFilters: "Close filters",
      openMenu: "Open capsule menu",
      selectProductForRegeneration: "Select",
      cardLayout: "Card layout",
      cardColumnsOne: "1 column",
      cardColumnsTwo: "2 columns",
      cardColumnsThree: "3 columns",
      copyProductLinkAddress: "Copy Link Address",
      showProductInfo: "Show Product Info"
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

function MainScreenFlowHarness({
  onRefreshItems,
  onDownloadPdf,
  onRegenerateSelectedItems
}: {
  onRefreshItems: () => void;
  onDownloadPdf: () => void;
  onRegenerateSelectedItems: (urls: string[]) => void;
}) {
  const [selectedRegenerationUrls, setSelectedRegenerationUrls] = useState([]);
  const [partialRegenerationPendingUrls, setPartialRegenerationPendingUrls] = useState([]);

  return (
    <MainScreen
      activeCapsule={{ id: "capsule-1", name: "Spring edit", draft: null, saved: null, status: "new" }}
      capsuleList={[{ id: "capsule-1", name: "Spring edit", status: "new" }]}
      onSignOut={vi.fn()}
      isSigningOut={false}
      onRefreshItems={onRefreshItems}
      onDownloadPdf={onDownloadPdf}
      onCreateCapsule={vi.fn()}
      onOpenCapsule={vi.fn(() => Promise.resolve())}
      onSaveCapsule={vi.fn(() => Promise.resolve())}
      onRevertCapsule={vi.fn(() => Promise.resolve())}
      onRenameCapsule={vi.fn(() => Promise.resolve())}
      onDuplicateCapsule={vi.fn(() => Promise.resolve())}
      onDeleteCapsule={vi.fn(() => Promise.resolve())}
      onSearchCapsules={vi.fn(() => Promise.resolve([]))}
      items={[
        { id: "b", url: "https://example.com/b", name: "Blazer", category: "outerwear" },
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "c", url: "https://example.com/c", name: "Trousers", category: "bottom" }
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
      selectedText=""
      hasFilterChanges={false}
      status={{ loading: false, error: "", infoKey: "", infoParams: null }}
      onSelectStyleCore={vi.fn()}
      onSelectStyleAesthetic={vi.fn()}
      onToggleOccasion={vi.fn()}
      onToggleSeason={vi.fn()}
      onSelectAudience={vi.fn()}
      onSelectAccentColor={vi.fn()}
      onSelectPattern={vi.fn()}
      onTextChange={vi.fn()}
      onApplyFilters={vi.fn()}
      onResetFilters={vi.fn()}
      onNavigateApp={vi.fn()}
      selectedRegenerationUrls={selectedRegenerationUrls}
      partialRegenerationPendingUrls={partialRegenerationPendingUrls}
      onToggleRegenerationSelection={(item) => {
        const itemUrl = String(item.url);
        setSelectedRegenerationUrls((current) => (
          current.includes(itemUrl)
            ? current.filter((url) => url !== itemUrl)
            : [...current, itemUrl]
        ));
      }}
      onCancelRegenerationSelection={() => {
        setSelectedRegenerationUrls([]);
      }}
      onRegenerateSelectedItems={() => {
        onRegenerateSelectedItems(selectedRegenerationUrls);
        setPartialRegenerationPendingUrls(selectedRegenerationUrls);
        setSelectedRegenerationUrls([]);
      }}
      isPartialRegenerationLoading={false}
    />
  );
}

function renderScreen(props: Partial<{
  onRefreshItems: () => void;
  onDownloadPdf: () => void;
  onRegenerateSelectedItems: (urls: string[]) => void;
}> = {}) {
  const defaultProps = {
    onRefreshItems: () => {},
    onDownloadPdf: () => {},
    onRegenerateSelectedItems: (_urls: string[]) => {}
  };

  return render(
    <ThemeProvider theme={theme}>
      <MainScreenFlowHarness {...defaultProps} {...props} />
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

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Export as PDF" }));
    await user.click(screen.getByRole("button", { name: "Regenerate all" }));

    expect(onDownloadPdf).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Regenerate capsule?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRefreshItems).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByTestId("clothing-card-https://example.com/a"));
    await user.click(screen.getByRole("menuitem", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Regenerate Selected (1)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Regenerate Selected (1)" }));
    expect(onRegenerateSelectedItems).toHaveBeenCalledWith(["https://example.com/a"]);

    await waitFor(() => {
      expect(screen.getByTestId("placeholder-card-pending-https://example.com/a")).toBeInTheDocument();
    });
  });
});
