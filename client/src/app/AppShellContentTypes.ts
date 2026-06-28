import type { ReactNode } from "react";
import type { SettingsSavePayload } from "../components/SettingsDialog";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleMeta,
  CapsulePagination,
  OutfitMeta,
  ProfileSettings,
  UserLike,
} from "./appTypes";

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

export type AppShellContentProps = {
  activeCapsuleId: string;
  activeCapsuleMeta: CapsuleMeta | null;
  activeJobEntityKeys: string[];
  activeOutfitId?: string;
  activeOutfitMeta?: OutfitMeta | null;
  appRoute: AppRoute;
  capsuleRouteId: string;
  outfitRouteId?: string;
  capsuleList: CapsuleMeta[];
  capsulePagination: CapsulePagination;
  outfitList?: OutfitMeta[];
  outfitPagination?: CapsulePagination;
  cardPadding: number;
  children: ReactNode;
  currentView: string;
  hasBrandedPanelHeader: boolean;
  isContentBusy: boolean;
  isLarge: boolean;
  isMainScreenView: boolean;
  isWardrobeView: boolean;
  isSearchView: boolean;
  isSignInView: boolean;
  isStatisticsView: boolean;
  sessionInitialized: boolean;
  settingsProfile: ProfileSettings;
  t: TranslationFn;
  user: UserLike | null;
  onCreateCapsuleFromSidebar: (onComplete?: () => void) => Promise<void>;
  onCreateOutfitFromSidebar?: (onComplete?: () => void) => Promise<void>;
  onDeleteCapsule: (capsuleId?: string) => Promise<void>;
  onDeleteOutfit?: (outfitId?: string) => Promise<void>;
  onDownloadOutfitPdf?: (outfitId?: string) => Promise<void>;
  onDeleteProfile: () => Promise<void>;
  onDownloadWardrobePdf: (capsuleId?: string) => Promise<void>;
  onDuplicateCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onDuplicateOutfit?: (name: string, outfitId?: string) => Promise<void>;
  onNavigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  onLoadMoreCapsules: () => Promise<void>;
  onLoadMoreOutfits?: () => Promise<void>;
  onOpenCapsuleFromSidebar: (
    capsuleId: string,
    onComplete?: () => void,
  ) => Promise<void>;
  onOpenOutfitFromSidebar?: (
    outfitId: string,
    onComplete?: () => void,
  ) => Promise<void>;
  onRenameCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onRenameOutfit?: (name: string, outfitId?: string) => Promise<void>;
  onRevertCapsule: (capsuleId?: string) => Promise<void>;
  onRevertOutfit?: (outfitId?: string) => Promise<void>;
  onSaveCapsule: (capsuleId?: string) => Promise<void>;
  onSaveOutfit?: (outfitId?: string) => Promise<void>;
  onSetCapsulePin: (
    capsuleId: string | undefined,
    pin: boolean,
  ) => Promise<void>;
  onSetOutfitPin?: (
    outfitId: string | undefined,
    pin: boolean,
  ) => Promise<void>;
  onSearchCapsules: (query: string) => Promise<CapsuleMeta[]> | CapsuleMeta[];
  onSearchOutfits?: (query: string) => Promise<OutfitMeta[]> | OutfitMeta[];
  onShareCapsule: (capsuleId?: string) => Promise<{
    url?: string;
    expiresAt?: string | Date;
    blockedReason?: "personal_uploaded_items";
  } | void>;
  onRequestSignOut: () => void;
  onSaveSettings: (nextSettings: SettingsSavePayload) => Promise<void>;
  openSearchDialog: () => void;
};
