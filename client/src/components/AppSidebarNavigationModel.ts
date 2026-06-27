import { useState } from "react";
import { useI18n } from "../i18n/useI18n";
import {
  useCapsuleNavigationState,
  useOutfitNavigationState,
} from "./AppSidebarNavigationSections";
import type {
  AppId,
  AppSidebarNavigationProps,
  CapsuleNavItem,
  OutfitNavItem,
} from "./AppSidebarNavigationTypes";

type ExpandedSectionId = "outfits" | "capsules" | "catalog";

const initialExpandedSections: Record<ExpandedSectionId, boolean> = {
  outfits: true,
  capsules: true,
  catalog: true,
};

const noop = () => {};
const hasNoUnsavedChanges = () => false;

function valueOr<T>(value: T | null | undefined, fallback: T) {
  return value ?? fallback;
}

function getCapsuleList(props: AppSidebarNavigationProps): CapsuleNavItem[] {
  return props.capsuleList || [];
}

function getOutfitList(props: AppSidebarNavigationProps): OutfitNavItem[] {
  return props.outfitList || [];
}

function useExpandedSections() {
  const [expandedSections, setExpandedSections] = useState(
    initialExpandedSections,
  );
  const handleToggleSection = (section: ExpandedSectionId) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  return { expandedSections, handleToggleSection };
}

function useLoadMoreHandler(onLoadMore?: () => Promise<void> | void) {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const handleLoadMore = async (shouldLoadMore: boolean) => {
    if (!shouldLoadMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMore?.();
    } finally {
      setIsLoadingMore(false);
    }
  };

  return { handleLoadMore, isLoadingMore };
}

export function useAppSidebarNavigationModel(props: AppSidebarNavigationProps) {
  const { t } = useI18n();
  const { expandedSections, handleToggleSection } = useExpandedSections();
  const capsuleLoadMore = useLoadMoreHandler(props.onLoadMoreCapsules);
  const outfitLoadMore = useLoadMoreHandler(props.onLoadMoreOutfits);
  const navState = useCapsuleNavigationState({
    capsuleList: getCapsuleList(props),
    capsulePagination: props.capsulePagination,
    isLoadingMore: capsuleLoadMore.isLoadingMore,
    onLoadMoreCapsules: props.onLoadMoreCapsules,
  });
  const outfitNavState = useOutfitNavigationState({
    outfitList: getOutfitList(props),
    outfitPagination: props.outfitPagination,
    isLoadingMore: outfitLoadMore.isLoadingMore,
    onLoadMoreOutfits: props.onLoadMoreOutfits,
  });
  const handleNavigateApp = (nextApp: AppId) => {
    props.onNavigateApp(nextApp);
    props.onExpandedAction?.();
  };

  return {
    ...props,
    activeCapsuleId: valueOr(props.activeCapsuleId, ""),
    activeCapsule: valueOr(props.activeCapsule, null),
    activeJobEntityKeys: props.activeJobEntityKeys || [],
    activeOutfitId: valueOr(props.activeOutfitId, ""),
    activeOutfit: valueOr(props.activeOutfit, null),
    capsuleHasUnsavedChanges: valueOr(
      props.capsuleHasUnsavedChanges,
      hasNoUnsavedChanges,
    ),
    expandedSections,
    handleLoadMoreCapsules: () =>
      capsuleLoadMore.handleLoadMore(navState.shouldLoadMore),
    handleLoadMoreOutfits: () =>
      outfitLoadMore.handleLoadMore(outfitNavState.shouldLoadMore),
    handleNavigateApp,
    isCollapsedDesktop: props.isSidebarCollapsed && !props.isOverlaySidebar,
    isInteractionDisabled: props.isInteractionDisabled === true,
    isLoadingMore: capsuleLoadMore.isLoadingMore,
    isLoadingMoreOutfits: outfitLoadMore.isLoadingMore,
    navState,
    onCreateOutfit: valueOr(props.onCreateOutfit, noop),
    onSearchOutfits: valueOr(props.onSearchOutfits, noop),
    outfitHasUnsavedChanges: valueOr(
      props.outfitHasUnsavedChanges,
      hasNoUnsavedChanges,
    ),
    outfitNavState,
    personalItemsCount: props.personalItemsCount ?? null,
    t,
    onToggleSection: handleToggleSection,
  };
}

export type AppSidebarNavigationModel = ReturnType<
  typeof useAppSidebarNavigationModel
>;
