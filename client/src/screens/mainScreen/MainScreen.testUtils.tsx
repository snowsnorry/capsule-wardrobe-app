import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { vi } from "vitest";
import type { MainScreenItem, MainScreenProps, MobileCardColumns } from "./MainScreenTypes";

const mediaQueryMock = vi.hoisted(() => vi.fn());
const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock
}));

vi.mock("../../i18n/useI18n", () => ({
  useI18n: useI18nMock
}));

vi.mock("../../components/ProfileFiltersSidebar", () => ({
  default: ({
    onApply,
    onReset,
    onSignOut,
    isInteractionDisabled
  }: {
    onApply: () => void;
    onReset: () => void;
    onSignOut?: (() => void) | null;
    isInteractionDisabled?: boolean;
  }) => (
    <div data-testid="profile-filters-sidebar">
      <button type="button" onClick={onApply} disabled={isInteractionDisabled}>apply-filters</button>
      <button type="button" onClick={onReset} disabled={isInteractionDisabled}>reset-filters</button>
      {typeof onSignOut === "function" ? (
        <button type="button" onClick={onSignOut}>sign-out</button>
      ) : null}
    </div>
  )
}));

vi.mock("../../components/ClothingGridPlaceholder", () => ({
  default: ({
    count,
    inline,
    mobileColumns
  }: {
    count: number;
    inline?: boolean;
    mobileColumns?: MobileCardColumns;
  }) => (
    <div
      data-testid={inline ? `inline-placeholder-${count}` : "loading-placeholder"}
      data-mobile-columns={String(mobileColumns ?? 2)}
    />
  ),
  ClothingPlaceholderCard: ({
    placeholderKey,
    mobileColumns
  }: {
    placeholderKey: string;
    mobileColumns?: MobileCardColumns;
  }) => (
    <div
      data-testid={`placeholder-card-${placeholderKey}`}
      data-mobile-columns={String(mobileColumns ?? 2)}
    />
  ),
  buildClothingGridTemplateColumns: (mobileColumns: MobileCardColumns = 2) => ({
    xs: `repeat(${mobileColumns}, minmax(0, 1fr))`,
    sm: "repeat(2, minmax(0, 1fr))",
    lg: "repeat(2, minmax(0, 1fr))"
  }),
  buildClothingGridGap: (mobileColumns: MobileCardColumns = 2) => ({
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

vi.mock("../../components/ClothingCard", () => ({
  default: ({
    item,
    isSelected,
    isSelectable,
    isSelectionMode,
    isRegenerating,
    mobileColumns,
    onToggleSelected,
    onProductMenuClick
  }: {
    item: MainScreenItem;
    isSelected?: boolean;
    isSelectable?: boolean;
    isSelectionMode?: boolean;
    isRegenerating?: boolean;
    mobileColumns?: MobileCardColumns;
    onToggleSelected: (item: MainScreenItem) => void;
    onProductMenuClick?: (
      event: React.MouseEvent<HTMLButtonElement>,
      url: string,
      item: MainScreenItem
    ) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid={`clothing-card-${item.url}`}
        data-selected={String(isSelected)}
        data-selectable={String(isSelectable)}
        data-selection-mode={String(isSelectionMode)}
        data-regenerating={String(isRegenerating)}
        data-mobile-columns={String(mobileColumns ?? 2)}
        disabled={isRegenerating}
        onClick={() => onToggleSelected(item)}
      >
        {item.name}
      </button>
      {!isSelectionMode ? (
        <button
          type="button"
          data-testid={`product-menu-${item.url}`}
          data-selection-mode={String(isSelectionMode)}
          onClick={(event) => onProductMenuClick?.(event, String(item.url || ""), item)}
        >
          menu
        </button>
      ) : null}
    </div>
  )
}));

export const theme = createTheme();

type TranslationParams = Record<string, unknown> | undefined;

export function t(key: string, params?: TranslationParams) {
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
      share: "Share",
      shareTitle: "Share capsule",
      shareReady: "Your share link is ready.",
      copyShareLink: "Copy share link",
      shareCopied: "Copied",
      shareExpires: "Expires {date}",
      renameTitle: "Rename capsule",
      deleteTitle: "Delete capsule",
      deleteOutfitSetImageTitle: "Delete image",
      revertTitle: "Revert changes",
      deleteConfirmBody: "Are you sure you want to delete this capsule? This action cannot be undone.",
      deleteOutfitSetImage: "Delete image",
      deleteOutfitSetImageConfirmBody: "Are you sure you want to delete this image? This action cannot be undone.",
      outfitSetImageObsolete: "This image may no longer match the current outfit. Remove it and generate a new one if needed.",
      revertConfirmBody: "Discard the current unsaved changes and restore the last saved version of this capsule?",
      regenerateAllTitle: "Regenerate capsule?",
      regenerateAllConfirmBody: "This will replace the current items in this capsule. Continue?",
      regenerateAllConfirm: "Regenerate",
      regenerateWithFilterChangesTitle: "Apply updated filters?",
      regenerateWithFilterChangesBody: "Your filter changes have not been applied yet. Apply them and generate a new capsule with the updated settings?",
      regenerateWithFilterChangesConfirm: "Apply and regenerate",
      deleteConfirm: "Delete",
      revertConfirm: "Revert",
      searchPlaceholder: "Search capsules...",
      searchPrevious7Days: "Previous 7 Days",
      searchPrevious30Days: "Previous 30 Days",
      searchEarlier: "Earlier",
      itemsCount: "{count} items",
      outfitsCount: "{count} outfits",
      outfitSet: "Outfit {number}",
      closeFilters: "Close filters",
      openMenu: "Open capsule menu",
      openProductMenu: "Open product menu",
      selectProductForRegeneration: "Select",
      cardLayout: "Card layout",
      cardColumnsOne: "1 column",
      cardColumnsTwo: "2 columns",
      cardColumnsThree: "3 columns",
      copyProductLinkAddress: "Copy Link Address",
      showProductInfo: "Show Product Info"
    },
    search: {
      all: "All"
    },
    main: {
      cancelSelection: "Cancel",
      regenerateSelected: `Regenerate Selected (${String(params?.count ?? 0)})`,
      download: "Download capsule PDF",
      refresh: "Refresh wardrobe"
    },
    settings: { title: "Settings", saved: "Settings saved." }
  };

  const value = key.split(".").reduce<unknown>((current, part) => (
    current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined
  ), labels);
  return typeof value === "string"
    ? value.replace(/\{(\w+)\}/g, (_match, token: string) => String(params?.[token] ?? `{${token}}`))
    : key;
}

export function resetMainScreenTestMocks() {
  window.localStorage.clear();
  mediaQueryMock.mockReset();
  useI18nMock.mockReset();
  useI18nMock.mockReturnValue({ t, locale: "en" });
}

export function setMainScreenLayout(layoutMode: "overlay" | "medium" | "large" = "medium") {
  mediaQueryMock.mockImplementation((query: string) => {
    if (String(query).includes("max-width: 1279.95px")) {
      return layoutMode === "overlay";
    }
    if (String(query).includes("min-width: 1680px")) {
      return layoutMode === "large";
    }
    return false;
  });
}

export function renderWithTheme(children: ReactNode) {
  return render(<ThemeProvider theme={theme}>{children}</ThemeProvider>);
}

export function createMainScreenProps(overrides: Partial<MainScreenProps> = {}): MainScreenProps {
  return {
    activeCapsule: { id: "capsule-1", name: "Spring edit", draft: null, saved: null, status: "new" },
    capsuleList: [{ id: "capsule-1", name: "Spring edit", status: "new" }],
    userEmail: "person@example.com",
    userName: "",
    settingsProfile: {
      fullname: "",
      email: "person@example.com",
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.5"
    },
    onSignOut: vi.fn(),
    onSaveSettings: vi.fn(() => Promise.resolve()),
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
    onShareCapsule: vi.fn(() => Promise.resolve({
      url: "https://client.example/share/share-1",
      expiresAt: new Date(60_000).toISOString()
    })),
    onSearchCapsules: vi.fn(() => Promise.resolve([])),
    items: [],
    outfitSets: [],
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
    selectedPattern: "solid",
    selectedText: "",
    hasFilterChanges: false,
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn(),
    onToggleOccasion: vi.fn(),
    onToggleSeason: vi.fn(),
    onSelectAudience: vi.fn(),
    onSelectAccentColor: vi.fn(),
    onSelectPattern: vi.fn(),
    onTextChange: vi.fn(),
    onApplyFilters: vi.fn(),
    onResetFilters: vi.fn(),
    onNavigateApp: vi.fn(),
    selectedRegenerationUrls: [],
    partialRegenerationPendingUrls: [],
    pendingImageSetIndexes: [],
    onToggleRegenerationSelection: vi.fn(),
    onCancelRegenerationSelection: vi.fn(),
    onRegenerateSelectedItems: vi.fn(),
    onDeleteOutfitSetImage: vi.fn(),
    onGenerateOutfitSetImage: vi.fn(),
    isPartialRegenerationLoading: false,
    ...overrides
  };
}
