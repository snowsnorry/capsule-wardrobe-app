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

type ExpandedSectionId = "outfits" | "capsules" | "catalog";

type SidebarNavigationListProps = AppSidebarNavigationProps & {
  expandedSections: Record<ExpandedSectionId, boolean>;
  handleLoadMoreCapsules: () => Promise<void>;
  handleNavigateApp: (nextApp: AppId) => void;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  isLoadingMore: boolean;
  navState: ReturnType<typeof useCapsuleNavigationState>;
  onToggleSection: (section: ExpandedSectionId) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function SidebarNavigationList({
  activeApp,
  activeCapsule,
  activeCapsuleId,
  capsuleHasUnsavedChanges,
  desktopSidebarRailWidth,
  expandedSections,
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
  onToggleSection,
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
        isExpanded={expandedSections.outfits}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        onToggle={() => onToggleSection("outfits")}
        t={t}
      />
      <CapsuleSection
        activeApp={activeApp}
        activeCapsule={activeCapsule}
        activeCapsuleId={activeCapsuleId}
        capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        handleLoadMoreCapsules={handleLoadMoreCapsules}
        isExpanded={expandedSections.capsules}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        isLoadingMore={isLoadingMore}
        isOverlaySidebar={isOverlaySidebar}
        navState={navState}
        onCreateCapsule={onCreateCapsule}
        onOpenCapsule={onOpenCapsule}
        onOpenCapsuleActions={onOpenCapsuleActions}
        onSearchCapsules={onSearchCapsules}
        onToggle={() => onToggleSection("capsules")}
        t={t}
      />
      <CatalogSection
        activeApp={activeApp}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        handleNavigateApp={handleNavigateApp}
        isExpanded={expandedSections.catalog}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        onToggle={() => onToggleSection("catalog")}
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
  const [expandedSections, setExpandedSections] = useState<
    Record<ExpandedSectionId, boolean>
  >({
    outfits: true,
    capsules: true,
    catalog: true,
  });
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
  const handleToggleSection = (section: ExpandedSectionId) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
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
        expandedSections={expandedSections}
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
        onToggleSection={handleToggleSection}
        personalItemsCount={personalItemsCount}
        t={t}
      />
      {isCollapsedDesktop ? collapsedExpandHitbox : null}
    </Stack>
  );
}

export default AppSidebarNavigation;
