/* eslint-disable max-lines-per-function, complexity */
import { useState, type ReactElement } from "react";
import { List, Stack } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import {
  CapsuleSection,
  CatalogSection,
  OutfitsSection,
  PersonalItemsRow,
  useCapsuleNavigationState,
  useOutfitNavigationState,
} from "./AppSidebarNavigationSections";
import type {
  AppId,
  AppSidebarNavigationProps,
} from "./AppSidebarNavigationTypes";

type ExpandedSectionId = "outfits" | "capsules" | "catalog";

type SidebarNavigationListProps = AppSidebarNavigationProps & {
  expandedSections: Record<ExpandedSectionId, boolean>;
  handleLoadMoreCapsules: () => Promise<void>;
  handleLoadMoreOutfits: () => Promise<void>;
  handleNavigateApp: (nextApp: AppId) => void;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  isLoadingMore: boolean;
  isLoadingMoreOutfits: boolean;
  navState: ReturnType<typeof useCapsuleNavigationState>;
  outfitNavState: ReturnType<typeof useOutfitNavigationState>;
  onToggleSection: (section: ExpandedSectionId) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function SidebarNavigationList({
  activeApp,
  activeCapsule,
  activeCapsuleId,
  activeOutfit,
  activeOutfitId,
  capsuleHasUnsavedChanges,
  desktopSidebarRailWidth,
  expandedSections,
  handleLoadMoreCapsules,
  handleLoadMoreOutfits,
  handleNavigateApp,
  isCollapsedDesktop,
  isInteractionDisabled,
  isLoadingMore,
  isLoadingMoreOutfits,
  isOverlaySidebar,
  navState,
  outfitHasUnsavedChanges,
  outfitNavState,
  onCreateCapsule,
  onCreateOutfit = () => {},
  onOpenCapsule,
  onOpenCapsuleActions,
  onOpenOutfit,
  onOpenOutfitActions,
  onSearchCapsules,
  onSearchOutfits = () => {},
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
      <OutfitsSection
        activeApp={activeApp}
        activeOutfit={activeOutfit}
        activeOutfitId={activeOutfitId}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        handleLoadMoreOutfits={handleLoadMoreOutfits}
        isExpanded={expandedSections.outfits}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        isLoadingMore={isLoadingMoreOutfits}
        isOverlaySidebar={isOverlaySidebar}
        navState={outfitNavState}
        onCreateOutfit={onCreateOutfit}
        onOpenOutfit={onOpenOutfit}
        onOpenOutfitActions={onOpenOutfitActions}
        onSearchOutfits={onSearchOutfits}
        onToggle={() => onToggleSection("outfits")}
        outfitHasUnsavedChanges={outfitHasUnsavedChanges}
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
  outfitList = [],
  outfitPagination,
  activeCapsuleId = "",
  activeCapsule = null,
  activeOutfitId = "",
  activeOutfit = null,
  onNavigateApp,
  onLoadMoreCapsules,
  onLoadMoreOutfits,
  onCreateCapsule,
  onCreateOutfit,
  onSearchCapsules,
  onSearchOutfits,
  onOpenCapsule,
  onOpenCapsuleActions,
  onOpenOutfit,
  onOpenOutfitActions,
  capsuleHasUnsavedChanges = () => false,
  outfitHasUnsavedChanges = () => false,
  onExpandedAction,
  collapsedExpandHitbox = null,
}: AppSidebarNavigationProps): ReactElement {
  const { t } = useI18n();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingMoreOutfits, setIsLoadingMoreOutfits] = useState(false);
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
  const outfitNavState = useOutfitNavigationState({
    outfitList,
    outfitPagination,
    isLoadingMore: isLoadingMoreOutfits,
    onLoadMoreOutfits,
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
      await onLoadMoreCapsules?.();
    } finally {
      setIsLoadingMore(false);
    }
  };
  const handleLoadMoreOutfits = async () => {
    if (!outfitNavState.shouldLoadMore) return;
    setIsLoadingMoreOutfits(true);
    try {
      await onLoadMoreOutfits?.();
    } finally {
      setIsLoadingMoreOutfits(false);
    }
  };

  return (
    <Stack sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
      <SidebarNavigationList
        activeApp={activeApp}
        activeCapsule={activeCapsule}
        activeCapsuleId={activeCapsuleId}
        activeOutfit={activeOutfit}
        activeOutfitId={activeOutfitId}
        capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        expandedSections={expandedSections}
        handleLoadMoreCapsules={handleLoadMoreCapsules}
        handleLoadMoreOutfits={handleLoadMoreOutfits}
        handleNavigateApp={handleNavigateApp}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        isLoadingMore={isLoadingMore}
        isLoadingMoreOutfits={isLoadingMoreOutfits}
        isOverlaySidebar={isOverlaySidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        navState={navState}
        outfitHasUnsavedChanges={outfitHasUnsavedChanges}
        outfitNavState={outfitNavState}
        onCreateCapsule={onCreateCapsule}
        onCreateOutfit={onCreateOutfit}
        onLoadMoreCapsules={onLoadMoreCapsules}
        onNavigateApp={onNavigateApp}
        onOpenCapsule={onOpenCapsule}
        onOpenCapsuleActions={onOpenCapsuleActions}
        onOpenOutfit={onOpenOutfit}
        onOpenOutfitActions={onOpenOutfitActions}
        onSearchCapsules={onSearchCapsules}
        onSearchOutfits={onSearchOutfits}
        onToggleSection={handleToggleSection}
        personalItemsCount={personalItemsCount}
        t={t}
      />
      {isCollapsedDesktop ? collapsedExpandHitbox : null}
    </Stack>
  );
}

export default AppSidebarNavigation;
