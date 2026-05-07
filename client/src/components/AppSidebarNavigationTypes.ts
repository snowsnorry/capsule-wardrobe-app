import type { MouseEvent, ReactNode } from "react";

type AppId = "capsule" | "explore" | "statistics";

type CapsuleNavItem = {
  id?: string;
  name?: string;
  [key: string]: unknown;
};

type AppSidebarNavigationProps = {
  activeApp: AppId;
  isOverlaySidebar: boolean;
  isSidebarCollapsed: boolean;
  desktopSidebarRailWidth: number;
  isInteractionDisabled?: boolean;
  capsuleList?: CapsuleNavItem[];
  activeCapsuleId?: string;
  onNavigateApp: (nextApp: AppId) => void;
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

export type { AppId, AppSidebarNavigationProps, CapsuleNavItem };
