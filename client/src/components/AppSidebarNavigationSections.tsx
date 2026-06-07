/* eslint-disable max-lines */
import { useMemo } from "react";
import CheckroomOutlinedIcon from "@mui/icons-material/CheckroomOutlined";
import ManageSearchRoundedIcon from "@mui/icons-material/ManageSearchRounded";
import { GiClothes } from "react-icons/gi";
import { PiDresser } from "react-icons/pi";
import { SearchAddActions } from "./AppSidebarNavigationActions";
import {
  CapsuleRows,
  OutfitRows,
  sortCapsulesByUpdated,
  sortOutfitsByUpdated,
} from "./AppSidebarNavigationCapsuleRows";
import {
  ChildRow,
  TopLevelRow,
  type Translate,
} from "./AppSidebarNavigationRows";
import type {
  AppId,
  AppSidebarNavigationProps,
  CapsuleNavItem,
  CapsuleNavPagination,
  OutfitNavItem,
  OutfitNavPagination,
} from "./AppSidebarNavigationTypes";

function isCatalogApp(activeApp: AppId) {
  return activeApp === "explore" || activeApp === "statistics";
}

export function useCapsuleNavigationState({
  capsuleList,
  capsulePagination,
  isLoadingMore,
  onLoadMoreCapsules,
}: {
  capsuleList: CapsuleNavItem[];
  capsulePagination?: CapsuleNavPagination;
  isLoadingMore: boolean;
  onLoadMoreCapsules?: () => Promise<void> | void;
}) {
  const sortedCapsules = useMemo(
    () => sortCapsulesByUpdated(capsuleList),
    [capsuleList],
  );
  const visibleCapsuleCount = sortedCapsules.length;
  const totalCapsuleCount = Math.max(
    capsulePagination?.total ?? visibleCapsuleCount,
    visibleCapsuleCount,
  );
  const hasMoreCapsules =
    Boolean(capsulePagination?.hasMore) &&
    visibleCapsuleCount < totalCapsuleCount;

  return {
    hasMoreCapsules,
    shouldLoadMore: Boolean(onLoadMoreCapsules) && !isLoadingMore,
    sortedCapsules,
    totalCapsuleCount,
  };
}

export function useOutfitNavigationState({
  outfitList,
  outfitPagination,
  isLoadingMore,
  onLoadMoreOutfits,
}: {
  outfitList: OutfitNavItem[];
  outfitPagination?: OutfitNavPagination;
  isLoadingMore: boolean;
  onLoadMoreOutfits?: () => Promise<void> | void;
}) {
  const sortedOutfits = useMemo(
    () => sortOutfitsByUpdated(outfitList),
    [outfitList],
  );
  const visibleOutfitCount = sortedOutfits.length;
  const totalOutfitCount = Math.max(
    outfitPagination?.total ?? visibleOutfitCount,
    visibleOutfitCount,
  );
  const hasMoreOutfits =
    Boolean(outfitPagination?.hasMore) && visibleOutfitCount < totalOutfitCount;

  return {
    hasMoreOutfits,
    shouldLoadMore: Boolean(onLoadMoreOutfits) && !isLoadingMore,
    sortedOutfits,
    totalOutfitCount,
  };
}

export function PersonalItemsRow({
  activeApp,
  desktopSidebarRailWidth,
  handleNavigateApp,
  isCollapsedDesktop,
  isInteractionDisabled,
  personalItemsCount,
  t,
}: {
  activeApp: AppId;
  desktopSidebarRailWidth: number;
  handleNavigateApp: (nextApp: AppId) => void;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  personalItemsCount?: number | null;
  t: Translate;
}) {
  return (
    <TopLevelRow
      label={t("launcher.wardrobe")}
      icon={<PiDresser />}
      isActive={activeApp === "wardrobe"}
      isInteractionDisabled={isInteractionDisabled}
      isCollapsedDesktop={isCollapsedDesktop}
      desktopSidebarRailWidth={desktopSidebarRailWidth}
      onClick={() => handleNavigateApp("wardrobe")}
      countBadge={personalItemsCount}
      showActiveBackground
    />
  );
}

function OutfitsRow({
  desktopSidebarRailWidth,
  isActive,
  isExpanded,
  isCollapsedDesktop,
  isInteractionDisabled,
  onAdd,
  onSearch,
  onToggle,
  t,
}: {
  desktopSidebarRailWidth: number;
  isActive: boolean;
  isExpanded: boolean;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  onAdd?: () => void;
  onSearch?: () => void;
  onToggle: () => void;
  t: Translate;
}) {
  return (
    <TopLevelRow
      label={t("sidebar.outfits")}
      icon={<GiClothes />}
      isActive={isActive}
      isInteractionDisabled={isInteractionDisabled}
      isCollapsedDesktop={isCollapsedDesktop}
      desktopSidebarRailWidth={desktopSidebarRailWidth}
      ariaExpanded={isExpanded}
      onClick={onToggle}
      suppressHoverBackground
      actions={
        isExpanded ? (
          <SearchAddActions
            searchLabel={t("wardrobe.searchOutfits")}
            addLabel={t("wardrobe.newOutfit")}
            isInteractionDisabled={isInteractionDisabled}
            onSearch={onSearch}
            onAdd={onAdd}
          />
        ) : undefined
      }
    />
  );
}

export function OutfitsSection({
  activeApp,
  activeOutfit,
  activeOutfitId,
  desktopSidebarRailWidth,
  handleLoadMoreOutfits,
  isExpanded,
  isCollapsedDesktop,
  isInteractionDisabled,
  isLoadingMore,
  isOverlaySidebar,
  navState,
  onCreateOutfit,
  onOpenOutfit,
  onOpenOutfitActions,
  onSearchOutfits,
  onToggle,
  outfitHasUnsavedChanges,
  t,
}: Pick<
  AppSidebarNavigationProps,
  | "activeOutfit"
  | "activeOutfitId"
  | "outfitHasUnsavedChanges"
  | "onCreateOutfit"
  | "onOpenOutfit"
  | "onOpenOutfitActions"
  | "onSearchOutfits"
> & {
  activeApp: AppId;
  desktopSidebarRailWidth: number;
  handleLoadMoreOutfits: () => Promise<void>;
  isExpanded: boolean;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  isLoadingMore: boolean;
  isOverlaySidebar: boolean;
  navState: ReturnType<typeof useOutfitNavigationState>;
  onToggle: () => void;
  t: Translate;
}) {
  return (
    <>
      <OutfitsRow
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        isActive={activeApp === "outfit"}
        isExpanded={isExpanded}
        isCollapsedDesktop={isCollapsedDesktop}
        isInteractionDisabled={isInteractionDisabled}
        onAdd={() => void onCreateOutfit?.()}
        onSearch={onSearchOutfits}
        onToggle={onToggle}
        t={t}
      />
      {isCollapsedDesktop || !isExpanded ? null : (
        <OutfitRows
          activeOutfit={activeOutfit}
          activeOutfitId={activeApp === "outfit" ? activeOutfitId || "" : ""}
          outfitHasUnsavedChanges={outfitHasUnsavedChanges || (() => false)}
          outfitList={navState.sortedOutfits}
          hasMore={navState.hasMoreOutfits}
          isInteractionDisabled={isInteractionDisabled}
          isOverlaySidebar={isOverlaySidebar}
          isLoadingMore={isLoadingMore}
          onLoadMoreOutfits={handleLoadMoreOutfits}
          onOpenOutfit={onOpenOutfit}
          onOpenOutfitActions={onOpenOutfitActions}
          t={t}
          totalCount={navState.totalOutfitCount}
        />
      )}
    </>
  );
}

export function CapsuleSection({
  activeApp,
  activeCapsule,
  activeCapsuleId,
  capsuleHasUnsavedChanges,
  desktopSidebarRailWidth,
  handleLoadMoreCapsules,
  isExpanded,
  isCollapsedDesktop,
  isInteractionDisabled,
  isLoadingMore,
  isOverlaySidebar,
  navState,
  onCreateCapsule,
  onOpenCapsule,
  onOpenCapsuleActions,
  onSearchCapsules,
  onToggle,
  t,
}: Pick<
  AppSidebarNavigationProps,
  | "activeCapsule"
  | "activeCapsuleId"
  | "capsuleHasUnsavedChanges"
  | "onCreateCapsule"
  | "onOpenCapsule"
  | "onOpenCapsuleActions"
  | "onSearchCapsules"
> & {
  activeApp: AppId;
  desktopSidebarRailWidth: number;
  handleLoadMoreCapsules: () => Promise<void>;
  isExpanded: boolean;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  isLoadingMore: boolean;
  isOverlaySidebar: boolean;
  navState: ReturnType<typeof useCapsuleNavigationState>;
  onToggle: () => void;
  t: Translate;
}) {
  return (
    <>
      <TopLevelRow
        label={t("launcher.capsule")}
        icon={<CheckroomOutlinedIcon />}
        isActive={activeApp === "capsule"}
        isInteractionDisabled={isInteractionDisabled}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        ariaExpanded={isExpanded}
        onClick={onToggle}
        suppressHoverBackground
        actions={
          isExpanded ? (
            <SearchAddActions
              searchLabel={t("capsule.search")}
              addLabel={t("capsule.new")}
              isInteractionDisabled={isInteractionDisabled}
              onSearch={onSearchCapsules}
              onAdd={() => void onCreateCapsule?.()}
            />
          ) : undefined
        }
      />
      {isCollapsedDesktop || !isExpanded ? null : (
        <CapsuleRows
          activeCapsule={activeCapsule}
          activeCapsuleId={activeCapsuleId || ""}
          capsuleHasUnsavedChanges={capsuleHasUnsavedChanges || (() => false)}
          capsuleList={navState.sortedCapsules}
          hasMore={navState.hasMoreCapsules}
          isInteractionDisabled={isInteractionDisabled}
          isOverlaySidebar={isOverlaySidebar}
          isLoadingMore={isLoadingMore}
          onLoadMoreCapsules={handleLoadMoreCapsules}
          onOpenCapsule={onOpenCapsule}
          onOpenCapsuleActions={onOpenCapsuleActions}
          t={t}
          totalCount={navState.totalCapsuleCount}
        />
      )}
    </>
  );
}

export function CatalogSection({
  activeApp,
  desktopSidebarRailWidth,
  handleNavigateApp,
  isExpanded,
  isCollapsedDesktop,
  isInteractionDisabled,
  onToggle,
  t,
}: {
  activeApp: AppId;
  desktopSidebarRailWidth: number;
  handleNavigateApp: (nextApp: AppId) => void;
  isExpanded: boolean;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  onToggle: () => void;
  t: Translate;
}) {
  return (
    <>
      <TopLevelRow
        label={t("sidebar.catalog")}
        icon={<ManageSearchRoundedIcon />}
        isActive={isCatalogApp(activeApp)}
        isInteractionDisabled={isInteractionDisabled}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        ariaExpanded={isExpanded}
        onClick={onToggle}
        suppressHoverBackground
      />
      {isCollapsedDesktop || !isExpanded ? null : (
        <>
          <ChildRow
            label={t("sidebar.explore")}
            isActive={activeApp === "explore"}
            isInteractionDisabled={isInteractionDisabled}
            onClick={() => handleNavigateApp("explore")}
          />
          <ChildRow
            label={t("sidebar.statistics")}
            isActive={activeApp === "statistics"}
            isInteractionDisabled={isInteractionDisabled}
            onClick={() => handleNavigateApp("statistics")}
          />
        </>
      )}
    </>
  );
}
