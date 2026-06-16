import type { MouseEvent, ReactNode } from "react";

type AppId = "capsule" | "outfit" | "explore" | "wardrobe" | "statistics";

type CapsuleNavItem = {
  id?: string;
  name?: string;
  pin?: boolean;
  updatedAt?: string;
  [key: string]: unknown;
};

type CapsuleNavPagination = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

type OutfitNavItem = CapsuleNavItem;
type OutfitNavPagination = CapsuleNavPagination;

type AppSidebarNavigationProps = {
  activeApp: AppId;
  isOverlaySidebar: boolean;
  isSidebarCollapsed: boolean;
  desktopSidebarRailWidth: number;
  isInteractionDisabled?: boolean;
  personalItemsCount?: number | null;
  capsuleList?: CapsuleNavItem[];
  capsulePagination?: CapsuleNavPagination;
  outfitList?: OutfitNavItem[];
  outfitPagination?: OutfitNavPagination;
  activeCapsuleId?: string;
  activeCapsule?: CapsuleNavItem | null;
  activeOutfitId?: string;
  activeOutfit?: OutfitNavItem | null;
  onNavigateApp: (nextApp: AppId) => void;
  onLoadMoreCapsules?: () => Promise<void> | void;
  onLoadMoreOutfits?: () => Promise<void> | void;
  onCreateCapsule?: () => Promise<void> | void;
  onCreateOutfit?: () => Promise<void> | void;
  onSearchCapsules?: () => void;
  onSearchOutfits?: () => void;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenOutfit?: (outfitId: string) => void;
  onOpenCapsuleActions?: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleNavItem,
  ) => void;
  onOpenOutfitActions?: (
    event: MouseEvent<HTMLElement>,
    outfit: OutfitNavItem,
  ) => void;
  capsuleHasUnsavedChanges?: (capsule: CapsuleNavItem) => boolean;
  outfitHasUnsavedChanges?: (outfit: OutfitNavItem) => boolean;
  onSetCapsulePin?: (capsuleId: string, pin: boolean) => Promise<void> | void;
  onSetOutfitPin?: (outfitId: string, pin: boolean) => Promise<void> | void;
  onExpandedAction?: () => void;
  collapsedExpandHitbox?: ReactNode;
};

export type {
  AppId,
  AppSidebarNavigationProps,
  CapsuleNavItem,
  CapsuleNavPagination,
  OutfitNavItem,
  OutfitNavPagination,
};
