import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import { CapsuleChildren } from "./AppSidebarCapsuleNavigation";
import {
  CapsuleTopLevelNavigation,
  SidebarNavigationDivider,
  SidebarSecondaryNavigation
} from "./AppSidebarNavigationParts";
import type {
  AppId,
  AppSidebarNavigationProps,
  CapsuleNavItem
} from "./AppSidebarNavigationTypes";

function AppSidebarNavigation({
  activeApp,
  isOverlaySidebar,
  isSidebarCollapsed,
  desktopSidebarRailWidth,
  isInteractionDisabled = false,
  capsuleList = [],
  activeCapsuleId = "",
  onNavigateApp,
  onCreateCapsule,
  onSearchCapsules,
  onOpenCapsule,
  onOpenCapsuleActions,
  capsuleHasUnsavedChanges = () => false,
  onExpandedAction,
  collapsedExpandHitbox = null
}: AppSidebarNavigationProps): ReactElement {
  const { t } = useI18n();
  const isCollapsedDesktop = isSidebarCollapsed && !isOverlaySidebar;
  const showCapsuleChildren = activeApp === "capsule" && !isCollapsedDesktop;
  const capsuleChildTabIndex = showCapsuleChildren ? 0 : -1;

  const handleNavigateApp = (nextApp: AppId) => {
    onNavigateApp(nextApp);
    onExpandedAction?.();
  };

  return (
    <Stack sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
      <CapsuleTopLevelNavigation
        isActive={activeApp === "capsule"}
        isExpanded={showCapsuleChildren}
        isInteractionDisabled={isInteractionDisabled}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        onNavigateApp={handleNavigateApp}
        t={t}
      />
      <CapsuleChildren
        showCapsuleChildren={showCapsuleChildren}
        capsuleChildTabIndex={capsuleChildTabIndex}
        isInteractionDisabled={isInteractionDisabled}
        isOverlaySidebar={isOverlaySidebar}
        capsuleList={capsuleList}
        activeCapsuleId={activeCapsuleId}
        onCreateCapsule={onCreateCapsule}
        onSearchCapsules={onSearchCapsules}
        onOpenCapsule={onOpenCapsule}
        onOpenCapsuleActions={onOpenCapsuleActions}
        capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
        t={t}
      />
      <SidebarNavigationDivider showCapsuleChildren={showCapsuleChildren} />
      <SidebarSecondaryNavigation
        activeApp={activeApp}
        isInteractionDisabled={isInteractionDisabled}
        isCollapsedDesktop={isCollapsedDesktop}
        showCapsuleChildren={showCapsuleChildren}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        onNavigateApp={handleNavigateApp}
        t={t}
      />
      {isCollapsedDesktop ? collapsedExpandHitbox : null}
    </Stack>
  );
}

export type { AppId as AppSidebarNavigationAppId, CapsuleNavItem };
export default AppSidebarNavigation;
