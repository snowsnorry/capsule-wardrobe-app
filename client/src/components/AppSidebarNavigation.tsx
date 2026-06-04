import { useState, type ReactElement } from "react";
import { List, Stack } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import {
  CapsuleSection,
  CatalogSection,
  OutfitsRow,
  PersonalItemsRow,
  useCapsuleNavigationState,
} from "./AppSidebarNavigationSections";
import type {
  AppId,
  AppSidebarNavigationProps,
} from "./AppSidebarNavigationTypes";

type SidebarNavigationListProps = AppSidebarNavigationProps & {
  handleLoadMoreCapsules: () => Promise<void>;
  handleNavigateApp: (nextApp: AppId) => void;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  isLoadingMore: boolean;
  navState: ReturnType<typeof useCapsuleNavigationState>;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function SidebarNavigationList({
  activeApp,
  activeCapsule,
  activeCapsuleId,
  capsuleHasUnsavedChanges,
  desktopSidebarRailWidth,
  handleLoadMoreCapsules,
  handleNavigateApp,
  isCollapsedDesktop,
  isInteractionDisabled,
  isLoadingMore,
  isOverlaySidebar,
  navState,
  onCreateCapsule,
  onOpenCapsule,
  onOpenCapsuleActions,
  onSearchCapsules,
  personalItemsCount,
  t,
}: SidebarNavigationListProps) {
  return (
    <List
      data-testid="sidebar-navigation-list"
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: isCollapsedDesktop ? "hidden" : "auto",
        px: isCollapsedDesktop ? 0 : 1.5,
        py: 0.5,
      }}
    >
      <PersonalItemsRow
        activeApp={activeApp}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        handleNavigateApp={handleNavigateApp}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        personalItemsCount={personalItemsCount}
        t={t}
      />
      <OutfitsRow
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        t={t}
      />
      <CapsuleSection
        activeApp={activeApp}
        activeCapsule={activeCapsule}
        activeCapsuleId={activeCapsuleId}
        capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        handleLoadMoreCapsules={handleLoadMoreCapsules}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        isLoadingMore={isLoadingMore}
        isOverlaySidebar={isOverlaySidebar}
        navState={navState}
        onCreateCapsule={onCreateCapsule}
        onOpenCapsule={onOpenCapsule}
        onOpenCapsuleActions={onOpenCapsuleActions}
        onSearchCapsules={onSearchCapsules}
        t={t}
      />
      <CatalogSection
        activeApp={activeApp}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        handleNavigateApp={handleNavigateApp}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        t={t}
      />
    </List>
  );
}

function AppSidebarNavigation({
  activeApp,
  isOverlaySidebar,
  isSidebarCollapsed,
  desktopSidebarRailWidth,
  isInteractionDisabled = false,
  personalItemsCount = null,
  capsuleList = [],
  capsulePagination,
  activeCapsuleId = "",
  activeCapsule = null,
  onNavigateApp,
  onLoadMoreCapsules,
  onCreateCapsule,
  onSearchCapsules,
  onOpenCapsule,
  onOpenCapsuleActions,
  capsuleHasUnsavedChanges = () => false,
  onExpandedAction,
  collapsedExpandHitbox = null,
}: AppSidebarNavigationProps): ReactElement {
  const { t } = useI18n();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isCollapsedDesktop = isSidebarCollapsed && !isOverlaySidebar;
  const navState = useCapsuleNavigationState({
    capsuleList,
    capsulePagination,
    isLoadingMore,
    onLoadMoreCapsules,
  });

  const handleNavigateApp = (nextApp: AppId) => {
    onNavigateApp(nextApp);
    onExpandedAction?.();
  };
  const handleLoadMoreCapsules = async () => {
    if (!navState.shouldLoadMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMoreCapsules();
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <Stack sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
      <SidebarNavigationList
        activeApp={activeApp}
        activeCapsule={activeCapsule}
        activeCapsuleId={activeCapsuleId}
        capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        handleLoadMoreCapsules={handleLoadMoreCapsules}
        handleNavigateApp={handleNavigateApp}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        isLoadingMore={isLoadingMore}
        isOverlaySidebar={isOverlaySidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        navState={navState}
        onCreateCapsule={onCreateCapsule}
        onLoadMoreCapsules={onLoadMoreCapsules}
        onNavigateApp={onNavigateApp}
        onOpenCapsule={onOpenCapsule}
        onOpenCapsuleActions={onOpenCapsuleActions}
        onSearchCapsules={onSearchCapsules}
        personalItemsCount={personalItemsCount}
        t={t}
      />
      {isCollapsedDesktop ? collapsedExpandHitbox : null}
    </Stack>
  );
}

export default AppSidebarNavigation;
