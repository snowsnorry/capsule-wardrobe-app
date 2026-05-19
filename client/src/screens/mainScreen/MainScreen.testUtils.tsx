import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { vi } from "vitest";
import type {
  MainScreenItem,
  MainScreenProps,
  MobileCardColumns,
} from "./MainScreenTypes";
import { t as translateForMainScreenTests } from "./MainScreenTestTranslations";

const mediaQueryMock = vi.hoisted(() => vi.fn());
const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock,
}));

vi.mock("../../i18n/useI18n", () => ({
  useI18n: useI18nMock,
}));

vi.mock("../../components/ProfileFiltersSidebar", () => ({
  default: ({
    onApply,
    onReset,
    onSignOut,
    isInteractionDisabled,
    showFooterActions = true,
  }: {
    onApply: () => void;
    onReset: () => void;
    onSignOut?: (() => void) | null;
    isInteractionDisabled?: boolean;
    showFooterActions?: boolean;
  }) => (
    <div data-testid="profile-filters-sidebar">
      {showFooterActions ? (
        <>
          <button
            type="button"
            onClick={onReset}
            disabled={isInteractionDisabled}
          >
            reset-filters
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={isInteractionDisabled}
          >
            apply-filters
          </button>
        </>
      ) : null}
      {typeof onSignOut === "function" ? (
        <button type="button" onClick={onSignOut}>
          sign-out
        </button>
      ) : null}
    </div>
  ),
  ProfileFiltersActions: ({
    onApply,
    onReset,
    isInteractionDisabled,
  }: {
    onApply: () => void;
    onReset: () => void;
    isInteractionDisabled?: boolean;
  }) => (
    <div data-testid="profile-filters-actions">
      <button type="button" onClick={onReset} disabled={isInteractionDisabled}>
        reset-filters
      </button>
      <button type="button" onClick={onApply} disabled={isInteractionDisabled}>
        apply-filters
      </button>
    </div>
  ),
}));

vi.mock("../../components/ClothingGridPlaceholder", () => ({
  default: ({
    count,
    inline,
    mobileColumns,
  }: {
    count: number;
    inline?: boolean;
    mobileColumns?: MobileCardColumns;
  }) => (
    <div
      data-testid={
        inline ? `inline-placeholder-${count}` : "loading-placeholder"
      }
      data-mobile-columns={String(mobileColumns ?? 2)}
    />
  ),
  ClothingPlaceholderCard: ({
    placeholderKey,
    mobileColumns,
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
    lg: "repeat(2, minmax(0, 1fr))",
  }),
  buildClothingGridGap: (mobileColumns: MobileCardColumns = 2) => ({
    xs: mobileColumns === 1 ? 1.25 : 0,
    sm: 2.5,
  }),
  clothingGridTemplateColumns: {
    xs: "repeat(2, minmax(0, 1fr))",
    sm: "repeat(2, minmax(0, 1fr))",
    lg: "repeat(2, minmax(0, 1fr))",
  },
  clothingGridGap: {
    xs: 1.25,
    sm: 2.5,
  },
}));

vi.mock("../../components/ClothingCard", () => ({
  default: ({
    item,
    isSelected,
    isSelectable,
    isSelectionMode,
    isRegenerating,
    allowProductMenuWithoutUrl,
    mobileColumns,
    onToggleSelected,
    onProductClick,
    onProductMenuClick,
  }: {
    item: MainScreenItem;
    isSelected?: boolean;
    isSelectable?: boolean;
    isSelectionMode?: boolean;
    isRegenerating?: boolean;
    allowProductMenuWithoutUrl?: boolean;
    mobileColumns?: MobileCardColumns;
    onToggleSelected: (item: MainScreenItem) => void;
    onProductClick?: (item: MainScreenItem) => void;
    onProductMenuClick?: (
      event: React.MouseEvent<HTMLButtonElement>,
      url: string,
      item: MainScreenItem,
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
        onClick={() => {
          if (isSelectionMode) {
            onToggleSelected(item);
            return;
          }
          onProductClick?.(item);
        }}
      >
        {item.name}
      </button>
      {!isSelectionMode ? (
        <button
          type="button"
          data-testid={`product-menu-${item.url}`}
          data-allow-product-menu-without-url={String(
            allowProductMenuWithoutUrl,
          )}
          data-selection-mode={String(isSelectionMode)}
          onClick={(event) =>
            onProductMenuClick?.(event, String(item.url || ""), item)
          }
        >
          menu
        </button>
      ) : null}
    </div>
  ),
}));

export const theme = createTheme();

export const t = translateForMainScreenTests;

export function resetMainScreenTestMocks() {
  window.localStorage.clear();
  mediaQueryMock.mockReset();
  useI18nMock.mockReset();
  useI18nMock.mockReturnValue({ t: translateForMainScreenTests, locale: "en" });
}

export function setMainScreenLayout(
  layoutMode: "overlay" | "medium" | "large" = "medium",
) {
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

export function createMainScreenProps(
  overrides: Partial<MainScreenProps> = {},
): MainScreenProps {
  return {
    activeCapsule: {
      id: "capsule-1",
      name: "Spring edit",
      draft: null,
      saved: null,
      status: "new",
    },
    capsuleList: [{ id: "capsule-1", name: "Spring edit", status: "new" }],
    userEmail: "person@example.com",
    userName: "",
    settingsProfile: {
      fullname: "",
      email: "person@example.com",
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.5",
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
    onShareCapsule: vi.fn(() =>
      Promise.resolve({
        url: "https://client.example/share/share-1",
        expiresAt: new Date(60_000).toISOString(),
      }),
    ),
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
    selectedSourceMode: "catalog_only",
    selectedText: "",
    selectedAnchorWardrobeItemIds: [],
    hasFilterChanges: false,
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn(),
    onToggleOccasion: vi.fn(),
    onToggleSeason: vi.fn(),
    onSelectAudience: vi.fn(),
    onSelectAccentColor: vi.fn(),
    onSelectPattern: vi.fn(),
    onSelectSourceMode: vi.fn(),
    onTextChange: vi.fn(),
    onSelectAnchorWardrobeItemIds: vi.fn(),
    onApplyFilters: vi.fn(),
    onResetFilters: vi.fn(),
    onNavigateApp: vi.fn(),
    onUpdateUploadedWardrobeItem: vi.fn((item) => Promise.resolve(item)),
    selectedRegenerationUrls: [],
    partialRegenerationPendingUrls: [],
    pendingImageSetIndexes: [],
    onToggleRegenerationSelection: vi.fn(),
    onCancelRegenerationSelection: vi.fn(),
    onRegenerateSelectedItems: vi.fn(),
    onDeleteOutfitSetImage: vi.fn(),
    onGenerateOutfitSetImage: vi.fn(),
    isPartialRegenerationLoading: false,
    ...overrides,
  };
}
