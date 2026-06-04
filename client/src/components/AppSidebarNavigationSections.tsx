import { useMemo } from "react";
import CheckroomOutlinedIcon from "@mui/icons-material/CheckroomOutlined";
import ManageSearchRoundedIcon from "@mui/icons-material/ManageSearchRounded";
import { GiClothes } from "react-icons/gi";
import { PiDresser } from "react-icons/pi";
import { SearchAddActions } from "./AppSidebarNavigationActions";
import {
  CapsuleRows,
  sortCapsulesByUpdated,
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
  const remainingCapsuleCount = totalCapsuleCount - visibleCapsuleCount;

  return {
    hasMoreCapsules,
    remainingCapsuleCount,
    shouldLoadMore: Boolean(onLoadMoreCapsules) && !isLoadingMore,
    sortedCapsules,
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

export function OutfitsRow({
  desktopSidebarRailWidth,
  isCollapsedDesktop,
  isInteractionDisabled,
  t,
}: {
  desktopSidebarRailWidth: number;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  t: Translate;
}) {
  return (
    <TopLevelRow
      label={t("sidebar.outfits")}
      icon={<GiClothes />}
      isActive={false}
      isInteractionDisabled={isInteractionDisabled}
      isCollapsedDesktop={isCollapsedDesktop}
      desktopSidebarRailWidth={desktopSidebarRailWidth}
      actions={
        <SearchAddActions
          searchLabel={t("wardrobe.searchOutfits")}
          addLabel={t("wardrobe.newOutfit")}
          isInteractionDisabled
        />
      }
    />
  );
}

export function CapsuleSection({
  activeApp,
  activeCapsule,
  activeCapsuleId,
  capsuleHasUnsavedChanges,
  desktopSidebarRailWidth,
  handleLoadMoreCapsules,
  isCollapsedDesktop,
  isInteractionDisabled,
  isLoadingMore,
  isOverlaySidebar,
  navState,
  onCreateCapsule,
  onOpenCapsule,
  onOpenCapsuleActions,
  onSearchCapsules,
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
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
  isLoadingMore: boolean;
  isOverlaySidebar: boolean;
  navState: ReturnType<typeof useCapsuleNavigationState>;
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
        actions={
          <SearchAddActions
            searchLabel={t("capsule.search")}
            addLabel={t("capsule.new")}
            isInteractionDisabled={isInteractionDisabled}
            onSearch={onSearchCapsules}
            onAdd={() => void onCreateCapsule?.()}
          />
        }
      />
      {isCollapsedDesktop ? null : (
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
          remainingCount={navState.remainingCapsuleCount}
          t={t}
        />
      )}
    </>
  );
}

export function CatalogSection({
  activeApp,
  desktopSidebarRailWidth,
  handleNavigateApp,
  isCollapsedDesktop,
  isInteractionDisabled,
  t,
}: {
  activeApp: AppId;
  desktopSidebarRailWidth: number;
  handleNavigateApp: (nextApp: AppId) => void;
  isCollapsedDesktop: boolean;
  isInteractionDisabled: boolean;
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
      />
      {isCollapsedDesktop ? null : (
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
