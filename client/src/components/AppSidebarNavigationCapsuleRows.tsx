import {
  ActiveCapsuleAppend,
  CapsuleRow,
} from "./AppSidebarNavigationCapsuleRow";
import {
  getCapsuleId,
  getShowMoreCount,
  sortCapsulesByUpdated,
  sortOutfitsByUpdated,
} from "./AppSidebarNavigationCapsuleRowHelpers";
import type {
  PinCopyPrefix,
  SetCapsulePinHandler,
} from "./AppSidebarNavigationCapsuleRowTypes";
import { ShowMoreRow } from "./AppSidebarNavigationShowMoreRow";
import type {
  AppSidebarNavigationProps,
  CapsuleNavItem,
  OutfitNavItem,
} from "./AppSidebarNavigationTypes";
import type { Translate } from "./AppSidebarNavigationRows";

export { sortCapsulesByUpdated, sortOutfitsByUpdated };

type CapsuleRowsProps = {
  activeCapsule?: CapsuleNavItem | null;
  activeCapsuleId: string;
  capsuleHasUnsavedChanges: (capsule: CapsuleNavItem) => boolean;
  capsuleList: CapsuleNavItem[];
  hasMore: boolean;
  isInteractionDisabled: boolean;
  isOverlaySidebar: boolean;
  isLoadingMore: boolean;
  onLoadMoreCapsules?: () => Promise<void> | void;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenCapsuleActions?: AppSidebarNavigationProps["onOpenCapsuleActions"];
  onSetCapsulePin?: SetCapsulePinHandler;
  pinCopyPrefix?: PinCopyPrefix;
  t: Translate;
  totalCount: number;
};

export function CapsuleRows({
  activeCapsule,
  activeCapsuleId,
  capsuleHasUnsavedChanges,
  capsuleList,
  hasMore,
  isInteractionDisabled,
  isOverlaySidebar,
  isLoadingMore,
  onLoadMoreCapsules,
  onOpenCapsule,
  onOpenCapsuleActions,
  onSetCapsulePin,
  pinCopyPrefix = "capsule",
  t,
  totalCount,
}: CapsuleRowsProps) {
  const visibleCapsuleIds = new Set(capsuleList.map(getCapsuleId));
  const shouldAppendActiveCapsule =
    Boolean(activeCapsuleId) &&
    Boolean(activeCapsule) &&
    !visibleCapsuleIds.has(activeCapsuleId);
  const showMoreCount = getShowMoreCount({
    capsuleListLength: capsuleList.length,
    shouldAppendActiveCapsule,
    totalCount,
  });

  return (
    <>
      {capsuleList.map((capsule) => (
        <CapsuleRow
          key={getCapsuleId(capsule)}
          capsule={capsule}
          activeCapsuleId={activeCapsuleId}
          isInteractionDisabled={isInteractionDisabled}
          isOverlaySidebar={isOverlaySidebar}
          capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
          onOpenCapsule={onOpenCapsule}
          onOpenCapsuleActions={onOpenCapsuleActions}
          onSetCapsulePin={onSetCapsulePin}
          pinCopyPrefix={pinCopyPrefix}
          t={t}
        />
      ))}
      {shouldAppendActiveCapsule && activeCapsule ? (
        <ActiveCapsuleAppend
          activeCapsule={activeCapsule}
          activeCapsuleId={activeCapsuleId}
          capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
          isInteractionDisabled={isInteractionDisabled}
          isOverlaySidebar={isOverlaySidebar}
          onOpenCapsule={onOpenCapsule}
          onOpenCapsuleActions={onOpenCapsuleActions}
          onSetCapsulePin={onSetCapsulePin}
          pinCopyPrefix={pinCopyPrefix}
          t={t}
        />
      ) : null}
      {hasMore && showMoreCount > 0 ? (
        <ShowMoreRow
          count={showMoreCount}
          disabled={
            isInteractionDisabled || isLoadingMore || !onLoadMoreCapsules
          }
          onClick={() => {
            void onLoadMoreCapsules?.();
          }}
          t={t}
        />
      ) : null}
    </>
  );
}

export function OutfitRows({
  activeOutfit,
  activeOutfitId,
  outfitHasUnsavedChanges,
  outfitList,
  hasMore,
  isInteractionDisabled,
  isOverlaySidebar,
  isLoadingMore,
  onLoadMoreOutfits,
  onOpenOutfit,
  onOpenOutfitActions,
  onSetOutfitPin,
  t,
  totalCount,
}: {
  activeOutfit?: OutfitNavItem | null;
  activeOutfitId: string;
  outfitHasUnsavedChanges: (outfit: OutfitNavItem) => boolean;
  outfitList: OutfitNavItem[];
  hasMore: boolean;
  isInteractionDisabled: boolean;
  isOverlaySidebar: boolean;
  isLoadingMore: boolean;
  onLoadMoreOutfits?: () => Promise<void> | void;
  onOpenOutfit?: (outfitId: string) => void;
  onOpenOutfitActions?: AppSidebarNavigationProps["onOpenOutfitActions"];
  onSetOutfitPin?: (outfitId: string, pin: boolean) => Promise<void> | void;
  t: Translate;
  totalCount: number;
}) {
  return (
    <CapsuleRows
      activeCapsule={activeOutfit}
      activeCapsuleId={activeOutfitId}
      capsuleHasUnsavedChanges={outfitHasUnsavedChanges}
      capsuleList={outfitList}
      hasMore={hasMore}
      isInteractionDisabled={isInteractionDisabled}
      isOverlaySidebar={isOverlaySidebar}
      isLoadingMore={isLoadingMore}
      onLoadMoreCapsules={onLoadMoreOutfits}
      onOpenCapsule={onOpenOutfit}
      onOpenCapsuleActions={onOpenOutfitActions}
      onSetCapsulePin={onSetOutfitPin}
      pinCopyPrefix="outfit"
      t={t}
      totalCount={totalCount}
    />
  );
}
