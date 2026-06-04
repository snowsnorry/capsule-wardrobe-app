import type { MouseEvent, ReactNode } from "react";

type AppId = "capsule" | "explore" | "wardrobe" | "statistics";

type CapsuleNavItem = {
  id?: string;
  name?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type CapsuleNavPagination = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

type AppSidebarNavigationProps = {
  activeApp: AppId;
  isOverlaySidebar: boolean;
  isSidebarCollapsed: boolean;
  desktopSidebarRailWidth: number;
  isInteractionDisabled?: boolean;
  personalItemsCount?: number | null;
  capsuleList?: CapsuleNavItem[];
  capsulePagination?: CapsuleNavPagination;
  activeCapsuleId?: string;
  activeCapsule?: CapsuleNavItem | null;
  onNavigateApp: (nextApp: AppId) => void;
  onLoadMoreCapsules?: () => Promise<void> | void;
  onCreateCapsule?: () => Promise<void> | void;
  onSearchCapsules?: () => void;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenCapsuleActions?: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleNavItem,
  ) => void;
  capsuleHasUnsavedChanges?: (capsule: CapsuleNavItem) => boolean;
  onExpandedAction?: () => void;
  collapsedExpandHitbox?: ReactNode;
};

export type {
  AppId,
  AppSidebarNavigationProps,
  CapsuleNavItem,
  CapsuleNavPagination,
};
