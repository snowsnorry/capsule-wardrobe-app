import { Box } from "@mui/material";
import type { RefObject } from "react";
import AppSidebarNavigation from "../components/AppSidebarNavigation";
import type { AppId } from "../components/AppSidebarNavigationTypes";
import type { AppShellCapsuleActionMenuController } from "./AppShellCapsuleActionMenu";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleMeta,
  CapsulePagination,
} from "./appTypes";

type AppShellSidebarNavigationBodyProps = {
  activeCapsuleMeta: CapsuleMeta | null;
  activeSidebarApp: AppId;
  capsuleActionMenuControllerRef: RefObject<AppShellCapsuleActionMenuController | null>;
  capsuleList: CapsuleMeta[];
  capsulePagination: CapsulePagination;
  closeSidebar: () => void;
  desktopSidebarRailWidth: number;
  expandCollapsedSidebar: () => void;
  highlightedCapsuleId: string;
  isContentBusy: boolean;
  isOverlaySidebar: boolean;
  isSidebarCollapsed: boolean;
  onCreateCapsuleFromSidebar: (onComplete?: () => void) => Promise<void>;
  onLoadMoreCapsules: () => Promise<void>;
  onNavigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  onOpenCapsuleFromSidebar: (
    capsuleId: string,
    onComplete?: () => void,
  ) => Promise<void>;
  onSearchCapsules: () => void;
  personalItemsCount?: number | null;
};

function hasUnsavedCapsuleChanges(capsule: CapsuleMeta | null | undefined) {
  return capsule?.status === "new" || capsule?.status === "modified";
}

export default function AppShellSidebarNavigationBody({
  activeCapsuleMeta,
  activeSidebarApp,
  capsuleActionMenuControllerRef,
  capsuleList,
  capsulePagination,
  closeSidebar,
  desktopSidebarRailWidth,
  expandCollapsedSidebar,
  highlightedCapsuleId,
  isContentBusy,
  isOverlaySidebar,
  isSidebarCollapsed,
  onCreateCapsuleFromSidebar,
  onLoadMoreCapsules,
  onNavigateApp,
  onOpenCapsuleFromSidebar,
  onSearchCapsules,
  personalItemsCount,
}: AppShellSidebarNavigationBodyProps) {
  return (
    <AppSidebarNavigation
      activeApp={activeSidebarApp}
      isOverlaySidebar={isOverlaySidebar}
      isSidebarCollapsed={isSidebarCollapsed}
      desktopSidebarRailWidth={desktopSidebarRailWidth}
      isInteractionDisabled={activeSidebarApp === "capsule" && isContentBusy}
      personalItemsCount={personalItemsCount}
      capsuleList={capsuleList}
      capsulePagination={capsulePagination}
      activeCapsuleId={highlightedCapsuleId}
      activeCapsule={activeCapsuleMeta}
      onNavigateApp={onNavigateApp}
      onLoadMoreCapsules={onLoadMoreCapsules}
      onCreateCapsule={async () => {
        await onCreateCapsuleFromSidebar(
          isOverlaySidebar ? closeSidebar : undefined,
        );
      }}
      onSearchCapsules={onSearchCapsules}
      onOpenCapsule={(capsuleId) => {
        void onOpenCapsuleFromSidebar(
          capsuleId,
          isOverlaySidebar ? closeSidebar : undefined,
        );
      }}
      onOpenCapsuleActions={(event, capsule) => {
        capsuleActionMenuControllerRef.current?.openCapsuleActions(
          event,
          capsule,
        );
      }}
      capsuleHasUnsavedChanges={hasUnsavedCapsuleChanges}
      onExpandedAction={isOverlaySidebar ? closeSidebar : undefined}
      collapsedExpandHitbox={
        <Box
          data-testid="collapsed-sidebar-expand-hitbox"
          onClick={expandCollapsedSidebar}
          sx={{ flex: 1, minHeight: 0, cursor: "pointer" }}
        />
      }
    />
  );
}
