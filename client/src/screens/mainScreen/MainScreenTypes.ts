import type { MouseEvent } from "react";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/personalItems";
import type { CapsuleReport } from "../../app/appTypes";

export type CapsuleMenuAnchor = HTMLElement | null;

type AppNavigationOptions = {
  query?: string;
  openProductDetail?: boolean;
};

export type CapsuleLike = {
  id?: string;
  name?: string;
  status?: string;
  draft?: unknown;
  effective?: {
    report?: CapsuleReport | null;
    reportMeta?: { stale?: boolean } | null;
  } | null;
  saved?: unknown;
  updatedAt?: string;
};

export type OutfitSetLike = {
  itemIds?: string[];
  image?: string | null;
  imageObsolete?: boolean;
};

export type MainScreenItem = {
  id?: string | number;
  url?: string;
  name?: string;
  source?: "uploaded" | "from_catalog" | string;
  isLiked?: boolean | null;
  [key: string]: unknown;
};

type CapsuleSourceMode =
  | "catalog_only"
  | "wardrobe_preferred"
  | "wardrobe_only";

type AnchorItemRef = {
  source: "uploaded" | "from_catalog";
  url: string;
};

type ScreenStatus = {
  loading: boolean;
  error: string;
  infoKey: string;
  infoParams: Record<string, unknown> | null;
};

type StyleOptions = {
  core: string[];
  aesthetics: string[];
};

export type ResolvedOutfitSet = {
  id: string;
  index: number;
  label: number;
  items: MainScreenItem[];
  image: string | null;
  imageObsolete: boolean;
};

export type MobileCardColumns = 1 | 2 | 3;

export type MainScreenProps = {
  activeCapsule?: CapsuleLike | null;
  capsuleList?: CapsuleLike[];
  userEmail?: string;
  userName?: string;
  settingsProfile?: unknown;
  onSignOut?: () => void;
  onSaveSettings?: (settings: unknown) => Promise<void> | void;
  isSigningOut: boolean;
  onRefreshItems: () => Promise<void> | void;
  onDownloadPdf: (capsuleId?: string) => Promise<void> | void;
  onCreateCapsule?: () => Promise<void> | void;
  onOpenCapsule?: (capsuleId: string) => Promise<void> | void;
  onSaveCapsule?: (capsuleId?: string) => Promise<void> | void;
  onRevertCapsule?: (capsuleId?: string) => Promise<void> | void;
  onRenameCapsule?: (name: string, capsuleId?: string) => Promise<void> | void;
  onDuplicateCapsule?: (
    name: string,
    capsuleId?: string,
  ) => Promise<void> | void;
  onDeleteCapsule?: (capsuleId?: string) => Promise<void> | void;
  onDeleteCapsuleReport?: (capsuleId?: string) => Promise<void> | void;
  onGenerateCapsuleReport?: (capsuleId?: string) => Promise<void> | void;
  onShareCapsule?: (capsuleId?: string) =>
    | Promise<{
        url?: string;
        expiresAt?: string | Date;
        blockedReason?: "personal_uploaded_items";
      } | void>
    | {
        url?: string;
        expiresAt?: string | Date;
        blockedReason?: "personal_uploaded_items";
      }
    | void;
  onSearchCapsules?: (query: string) => Promise<CapsuleLike[]> | CapsuleLike[];
  onCopyOutfitSetToOutfits?: (
    name: string,
    items: MainScreenItem[],
    source?: { capsuleId?: string; setIndex?: number | string },
  ) => Promise<{ id?: string; name?: string } | null | undefined>;
  onOpenOutfit?: (outfitId: string) => Promise<void> | void;
  items: MainScreenItem[];
  outfitSets?: OutfitSetLike[];
  isLoadingItems: boolean;
  isCapsuleReportPending?: boolean;
  isContentBusy?: boolean;
  isDownloadingPdf: boolean;
  showAdditionalItemPlaceholder: boolean;
  styleOptions: StyleOptions;
  occasionOptions: string[];
  seasonOptions: string[];
  audienceOptions: string[];
  accentColorOptions: string[];
  patternOptions: string[];
  selectedStyleCore: string;
  selectedStyleAesthetic: string | null;
  selectedOccasions: string[];
  selectedSeasons: string[];
  selectedAudience: string;
  selectedAccentColor: string | null;
  selectedPattern: string | null;
  selectedSourceMode: CapsuleSourceMode;
  selectedText: string;
  selectedAnchorItemRefs: AnchorItemRef[];
  hasFilterChanges: boolean;
  status: ScreenStatus;
  onSelectStyleCore: (value: string) => void;
  onSelectStyleAesthetic: (value: string | null) => void;
  onToggleOccasion: (value: string) => void;
  onToggleSeason: (value: string) => void;
  onSelectAudience: (value: string) => void;
  onSelectAccentColor: (value: string | null) => void;
  onSelectPattern: (value: string) => void;
  onSelectSourceMode: (value: CapsuleSourceMode) => void;
  onTextChange: (value: string) => void;
  onSelectAnchorItemRefs: (value: AnchorItemRef[]) => void;
  onApplyFilters: () => Promise<void> | void;
  onResetFilters: () => Promise<void> | void;
  onNavigateApp: (
    nextApp: "capsule" | "explore" | "wardrobe" | "statistics",
    options?: AppNavigationOptions,
  ) => void;
  onRemoveFromPersonalItems?: (item: MainScreenItem) => Promise<void> | void;
  onSaveToPersonalItems?: (item: MainScreenItem) => Promise<void> | void;
  onSetItemLike?: (
    item: MainScreenItem,
    isLiked: boolean,
  ) => Promise<void> | void;
  onUpdateUploadedWardrobeItem?: (
    item: MainScreenItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => Promise<MainScreenItem> | MainScreenItem;
  selectedRegenerationUrls: string[];
  partialRegenerationPendingUrls: string[];
  pendingImageSetIndexes?: number[];
  onToggleRegenerationSelection: (item: MainScreenItem) => void;
  onCancelRegenerationSelection: () => void;
  onRegenerateSelectedItems: () => Promise<void> | void;
  onDeleteOutfitSetImage?: (setIndex: number) => Promise<void> | void;
  onGenerateOutfitSetImage?: (setIndex: number) => Promise<void> | void;
  isPartialRegenerationLoading: boolean;
  registerCapsuleSidebarActions?: (
    actions: {
      openSearchDialog: () => void;
      openCapsuleActions: (
        event: MouseEvent<HTMLElement>,
        capsule: CapsuleLike,
      ) => void;
    } | null,
  ) => void;
};
