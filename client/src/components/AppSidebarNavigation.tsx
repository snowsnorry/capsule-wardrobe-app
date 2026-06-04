import { useEffect, useState, type ReactElement } from "react";
import { Stack } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import CatalogGroupNavigation from "./AppSidebarCatalogNavigation";
import { CapsuleChildren } from "./AppSidebarCapsuleNavigation";
import { WardrobeChildren } from "./AppSidebarWardrobeNavigation";
import {
  CapsuleTopLevelNavigation,
  SidebarNavigationDivider,
  WardrobeTopLevelNavigation,
} from "./AppSidebarNavigationParts";
import type {
  AppId,
  AppSidebarNavigationProps,
} from "./AppSidebarNavigationTypes";

type SidebarGroupId = "wardrobe" | "capsule" | "catalog";

function getActiveSidebarGroup(activeApp: AppId): SidebarGroupId {
  return activeApp === "explore" || activeApp === "statistics"
    ? "catalog"
    : activeApp;
}

function CapsuleNavigationGroup({
  activeApp,
  activeCapsuleId,
  capsuleChildTabIndex,
  capsuleHasUnsavedChanges,
  capsuleList,
  desktopSidebarRailWidth,
  isCollapsedDesktop,
  isInteractionDisabled,
  isOverlaySidebar,
  onCreateCapsule,
  onOpenCapsule,
  onOpenCapsuleActions,
  onSearchCapsules,
  onToggle,
  showCapsuleChildren,
  t,
}: Pick<
  AppSidebarNavigationProps,
  | "activeCapsuleId"
  | "capsuleHasUnsavedChanges"
  | "capsuleList"
  | "desktopSidebarRailWidth"
  | "isInteractionDisabled"
  | "isOverlaySidebar"
  | "onCreateCapsule"
  | "onOpenCapsule"
  | "onOpenCapsuleActions"
  | "onSearchCapsules"
> & {
  activeApp: AppId;
  capsuleChildTabIndex: number;
  isCollapsedDesktop: boolean;
  onToggle: () => void;
  showCapsuleChildren: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <>
      <CapsuleTopLevelNavigation
        isActive={activeApp === "capsule"}
        isExpanded={showCapsuleChildren}
        isInteractionDisabled={Boolean(isInteractionDisabled)}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        onToggle={onToggle}
        t={t}
      />
      <CapsuleChildren
        showCapsuleChildren={showCapsuleChildren}
        capsuleChildTabIndex={capsuleChildTabIndex}
        isInteractionDisabled={Boolean(isInteractionDisabled)}
        isOverlaySidebar={isOverlaySidebar}
        capsuleList={capsuleList || []}
        activeCapsuleId={activeCapsuleId || ""}
        onCreateCapsule={onCreateCapsule}
        onSearchCapsules={onSearchCapsules}
        onOpenCapsule={onOpenCapsule}
        onOpenCapsuleActions={onOpenCapsuleActions}
        capsuleHasUnsavedChanges={capsuleHasUnsavedChanges || (() => false)}
        t={t}
      />
    </>
  );
}

function WardrobeNavigationGroup({
  activeApp,
  desktopSidebarRailWidth,
  isCollapsedDesktop,
  isInteractionDisabled,
  onNavigateApp,
  onToggle,
  showWardrobeChildren,
  t,
}: Pick<
  AppSidebarNavigationProps,
  "desktopSidebarRailWidth" | "isInteractionDisabled"
> & {
  activeApp: AppId;
  isCollapsedDesktop: boolean;
  onNavigateApp: (nextApp: AppId) => void;
  onToggle: () => void;
  showWardrobeChildren: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <>
      <WardrobeTopLevelNavigation
        isActive={activeApp === "wardrobe"}
        isExpanded={showWardrobeChildren}
        isInteractionDisabled={Boolean(isInteractionDisabled)}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        onToggle={onToggle}
        t={t}
      />
      <WardrobeChildren
        showWardrobeChildren={showWardrobeChildren}
        activeApp={activeApp}
        isInteractionDisabled={Boolean(isInteractionDisabled)}
        onNavigateApp={onNavigateApp}
        t={t}
      />
    </>
  );
}

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
  collapsedExpandHitbox = null,
}: AppSidebarNavigationProps): ReactElement {
  const { t } = useI18n();
  const isCollapsedDesktop = isSidebarCollapsed && !isOverlaySidebar;
  const activeGroup = getActiveSidebarGroup(activeApp);
  const [expandedGroup, setExpandedGroup] = useState<SidebarGroupId | null>(
    activeGroup,
  );
  const showWardrobeChildren =
    expandedGroup === "wardrobe" && !isCollapsedDesktop;
  const showCapsuleChildren =
    expandedGroup === "capsule" && !isCollapsedDesktop;
  const showCatalogChildren =
    expandedGroup === "catalog" && !isCollapsedDesktop;
  const capsuleChildTabIndex = showCapsuleChildren ? 0 : -1;

  useEffect(() => {
    setExpandedGroup(activeGroup);
  }, [activeGroup]);

  const handleToggleGroup = (group: SidebarGroupId) => {
    setExpandedGroup((current) => (current === group ? null : group));
  };

  const handleNavigateApp = (nextApp: AppId) => {
    onNavigateApp(nextApp);
    onExpandedAction?.();
  };

  return (
    <Stack sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
      <WardrobeNavigationGroup
        activeApp={activeApp}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        onNavigateApp={handleNavigateApp}
        onToggle={() => handleToggleGroup("wardrobe")}
        showWardrobeChildren={showWardrobeChildren}
        t={t}
      />
      <CapsuleNavigationGroup
        activeApp={activeApp}
        activeCapsuleId={activeCapsuleId}
        capsuleChildTabIndex={capsuleChildTabIndex}
        capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
        capsuleList={capsuleList}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        isOverlaySidebar={isOverlaySidebar}
        onCreateCapsule={onCreateCapsule}
        onOpenCapsule={onOpenCapsule}
        onOpenCapsuleActions={onOpenCapsuleActions}
        onSearchCapsules={onSearchCapsules}
        onToggle={() => handleToggleGroup("capsule")}
        showCapsuleChildren={showCapsuleChildren}
        t={t}
      />
      <SidebarNavigationDivider showCapsuleChildren={showCapsuleChildren} />
      <CatalogGroupNavigation
        activeApp={activeApp}
        isInteractionDisabled={isInteractionDisabled}
        isCollapsedDesktop={isCollapsedDesktop}
        showCatalogChildren={showCatalogChildren}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        onToggle={() => handleToggleGroup("catalog")}
        onNavigateApp={handleNavigateApp}
        t={t}
      />
      {isCollapsedDesktop ? collapsedExpandHitbox : null}
    </Stack>
  );
}

export default AppSidebarNavigation;
