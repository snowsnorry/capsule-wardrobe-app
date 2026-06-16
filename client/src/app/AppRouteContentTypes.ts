import type { Dispatch, FormEvent, MouseEvent, SetStateAction } from "react";
import type {
  AppNavigationOptions,
  AnchorItemRef,
  AppRoute,
  CapsuleMeta,
  CapsuleSourceMode,
  CapsuleSidebarActions,
  OutfitItemSnapshot,
  OutfitMeta,
  OutfitSetSnapshot,
  ProfileSettings,
  StatusState,
  UserLike,
  WardrobeItem,
} from "./appTypes";
import type { SettingsSavePayload } from "../components/SettingsDialog";
import type { UploadedWardrobeItemUpdatePayload } from "../api/personalItems";
import type { MainScreenItem } from "../screens/mainScreen/MainScreenTypes";

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;
type ToggleSelectionFn = (
  value: string,
  selected: string[],
  setter: Dispatch<SetStateAction<string[]>>,
) => void;
type OutfitSetIndex = number | string | null | undefined;

type SharedFilterProps = {
  styleOptions: { core: string[]; aesthetics: string[] };
  occasionOptions: string[];
  orderedSeasonOptions: string[];
  audienceOptions: string[];
  patternOptions: string[];
  selectedFormalityLevel: string;
  selectedStyle: string | null;
  selectedOccasions: string[];
  selectedSeason: string[];
  selectedAudience: string;
  selectedColor: string | null;
  selectedPattern: string;
  selectedText: string;
  selectedSourceMode: CapsuleSourceMode;
  selectedAnchorItemRefs: AnchorItemRef[];
  setSelectedFormalityLevel: (value: string) => void;
  setSelectedStyle: (value: string | null) => void;
  setSelectedOccasions: Dispatch<SetStateAction<string[]>>;
  setSelectedSeason: Dispatch<SetStateAction<string[]>>;
  setSelectedAudience: (value: string) => void;
  setSelectedColor: (value: string | null) => void;
  setSelectedPattern: (value: string) => void;
  setSelectedText: (value: string) => void;
  setSelectedSourceMode: (value: CapsuleSourceMode) => void;
  setSelectedAnchorItemRefs: (value: AnchorItemRef[]) => void;
  toggleSelection: ToggleSelectionFn;
};

export type AppRouteContentProps = SharedFilterProps & {
  appRoute: AppRoute;
  currentView: string;
  hasFilterChanges: boolean;
  hasPendingAdditionalItems: boolean;
  hasProfile: boolean;
  isCheckingSession: boolean;
  isCapsuleReportPending: boolean;
  isContentBusy: boolean;
  isDownloadingWardrobePdf: boolean;
  isLoadingItems: boolean;
  isOutfitImagePending: boolean;
  isOutfitReportPending: boolean;
  isPartialRegenerationLoading: boolean;
  isSigningOut: boolean;
  partialRegenerationPendingUrls: string[];
  pendingImageSetIndexes: number[];
  profileCreated: boolean;
  profileItems: WardrobeItem[] | null;
  profileOutfitSets: OutfitSetSnapshot[];
  searchAutoOpenProductDetail: boolean;
  searchInitialQuery: string;
  selectedRegenerationUrls: string[];
  sessionInitialized: boolean;
  settingsProfile: ProfileSettings;
  status: StatusState;
  t: TranslationFn;
  user: UserLike | null;
  step: "email" | "code";
  email: string;
  code: string;
  activeCapsuleMeta: CapsuleMeta | null;
  activeOutfitMeta: OutfitMeta | null;
  capsuleList: CapsuleMeta[];
  onApplyCapsuleFilters: () => Promise<void>;
  onBackToMain: () => void;
  onCancelRegenerationSelection: () => void;
  onCreateCapsule: () => Promise<void>;
  onCreateOutfit: () => Promise<void>;
  onCopyOutfitSetToOutfits: (
    name: string,
    items: MainScreenItem[],
    source?: { capsuleId?: string; setIndex?: number | string },
  ) => Promise<OutfitMeta | null>;
  onDeleteCapsule: (capsuleId?: string) => Promise<void>;
  onDeleteCapsuleReport: (capsuleId?: string) => Promise<void>;
  onDeleteOutfit: (outfitId?: string) => Promise<void>;
  onDeleteOutfitImage: (outfitId?: string) => Promise<void>;
  onDeleteOutfitReport: (outfitId?: string) => Promise<void>;
  onDeleteOutfitSetImage: (setIndex: OutfitSetIndex) => Promise<void>;
  onDeleteProfile: () => Promise<void>;
  onDownloadWardrobePdf: (capsuleId?: string) => Promise<void>;
  onDownloadOutfitPdf: (outfitId?: string) => Promise<void>;
  onDuplicateCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onDuplicateOutfit: (name: string, outfitId?: string) => Promise<void>;
  onGenerateOutfitSetImage: (setIndex: OutfitSetIndex) => Promise<void>;
  onGenerateCapsuleReport: (capsuleId?: string) => Promise<void>;
  onGenerateOutfitImage: (outfitId?: string) => Promise<void>;
  onGenerateOutfitReport: (outfitId?: string) => Promise<void>;
  onGoogleCredential: (idToken: string) => Promise<void>;
  onNavigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  onOpenCapsule: (capsuleId: string) => Promise<void>;
  onOpenOutfit: (outfitId: string) => Promise<void>;
  onPasskeySignIn: () => Promise<void>;
  onRefreshWardrobe: () => Promise<void>;
  onRegenerateSelectedItems: () => Promise<void>;
  onRenameCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onRenameOutfit: (name: string, outfitId?: string) => Promise<void>;
  onRequestCode: (
    event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
  ) => Promise<void>;
  onRequestSignOut: () => void;
  onResetEmail: () => void;
  onResetProfileFilters: () => Promise<void>;
  onRevertCapsule: (capsuleId?: string) => Promise<void>;
  onRevertOutfit: (outfitId?: string) => Promise<void>;
  onSaveCapsule: (capsuleId?: string) => Promise<void>;
  onSaveOutfit: (outfitId?: string) => Promise<void>;
  onSetCapsulePin: (
    capsuleId: string | undefined,
    pin: boolean,
  ) => Promise<void>;
  onSetOutfitPin: (outfitId: string | undefined, pin: boolean) => Promise<void>;
  onReplaceOutfitItems: (
    outfitId: string,
    items: OutfitItemSnapshot[],
  ) => Promise<void>;
  onRemoveFromPersonalItems: (item: WardrobeItem) => Promise<void>;
  onSaveToPersonalItems: (item: WardrobeItem) => Promise<void>;
  onSetItemLike: (item: WardrobeItem, isLiked: boolean) => Promise<void>;
  onUpdateUploadedWardrobeItem: (
    item: WardrobeItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => Promise<WardrobeItem>;
  onSaveProfile: () => Promise<void>;
  onSaveSettings: (nextSettings: SettingsSavePayload) => Promise<void>;
  onSearchCapsules: (query: string) => Promise<CapsuleMeta[]>;
  onShareCapsule: (
    capsuleId?: string,
  ) => Promise<{ url?: string; expiresAt?: string | Date }>;
  onToggleRegenerationSelection: (item: WardrobeItem) => void;
  onVerifyCode: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  registerCapsuleSidebarActions: (
    actions: CapsuleSidebarActions | null,
  ) => void;
  setCode: (value: string) => void;
  setEmail: (value: string) => void;
};
