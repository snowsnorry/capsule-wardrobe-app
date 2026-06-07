/* eslint-disable max-lines */
import {
  Box,
  Divider,
  IconButton,
  ListItemButton,
  ListItemText,
  Tooltip,
} from "@mui/material";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import type {
  AppSidebarNavigationProps,
  CapsuleNavItem,
  OutfitNavItem,
} from "./AppSidebarNavigationTypes";
import { ShowMoreRow } from "./AppSidebarNavigationShowMoreRow";
import {
  sidebarPageSize,
  topLevelIconRailWidth,
  type Translate,
} from "./AppSidebarNavigationRows";

function getCapsuleId(capsule: CapsuleNavItem | null | undefined) {
  return String(capsule?.id || "");
}

function getCapsuleName(capsule: CapsuleNavItem | null | undefined) {
  return String(capsule?.name || "");
}

function sortNavItemsByUpdated<T extends CapsuleNavItem>(items: T[]) {
  return [...items].sort((left, right) => {
    const updated = String(right.updatedAt || "").localeCompare(
      String(left.updatedAt || ""),
    );
    if (updated !== 0) return updated;
    return getCapsuleName(left).localeCompare(getCapsuleName(right));
  });
}

export function sortCapsulesByUpdated(capsules: CapsuleNavItem[]) {
  return sortNavItemsByUpdated(capsules);
}

export function sortOutfitsByUpdated(outfits: OutfitNavItem[]) {
  return sortNavItemsByUpdated(outfits);
}

function capsuleRowSx(isOverlaySidebar: boolean) {
  return {
    borderRadius: "var(--cw-radius-card)",
    mb: 0.25,
    ml: 0,
    pl: topLevelIconRailWidth,
    pr: 0,
    minHeight: 34,
    py: 0.5,
    columnGap: 0.5,
    position: "relative",
    width: "100%",
    "& .capsule-row-unsaved-dot": {
      opacity: 1,
      width: 10,
      mr: 0.75,
      transition: "opacity 160ms ease, width 180ms ease, margin 180ms ease",
    },
    "& .capsule-row-text": {
      pr: 0,
      transition: "padding-right 180ms ease",
    },
    "& .capsule-row-actions-slot": {
      display: "flex",
      position: isOverlaySidebar ? "static" : "absolute",
      right: 0,
      flex: "0 0 auto",
      opacity: isOverlaySidebar ? 1 : 0,
      width: isOverlaySidebar ? 32 : 0,
      height: 32,
      minWidth: 0,
      overflow: "hidden",
      pointerEvents: isOverlaySidebar ? "auto" : "none",
      transform: isOverlaySidebar ? "translateX(0)" : "translateX(6px)",
      transition: "opacity 160ms ease, transform 180ms ease",
    },
    "&:hover .capsule-row-unsaved-dot, &:focus-within .capsule-row-unsaved-dot":
      {
        opacity: 0,
        width: 0,
        mr: 0,
      },
    "&:hover .capsule-row-text, &:focus-within .capsule-row-text": {
      pr: 4,
    },
    "& .capsule-row-actions": {
      width: 32,
      height: 32,
      minWidth: 0,
      flexShrink: 0,
    },
    "&:hover .capsule-row-actions-slot, &:focus-within .capsule-row-actions-slot":
      {
        opacity: 1,
        width: 32,
        transform: "translateX(0)",
        pointerEvents: "auto",
      },
    "@media (prefers-reduced-motion: reduce)": {
      "& .capsule-row-unsaved-dot, & .capsule-row-text, & .capsule-row-actions-slot":
        {
          transition: "none",
          transform: "none",
        },
    },
  };
}

function CapsuleUnsavedDot({
  isVisible,
  label,
}: {
  isVisible: boolean;
  label: string;
}) {
  if (!isVisible) return null;
  return (
    <Tooltip title={label}>
      <FiberManualRecordRoundedIcon
        className="capsule-row-unsaved-dot"
        sx={{ fontSize: 10, color: "success.main", flexShrink: 0 }}
      />
    </Tooltip>
  );
}

function CapsuleActionsButton({
  capsule,
  capsuleName,
  isInteractionDisabled,
  onOpenCapsuleActions,
  t,
}: {
  capsule: CapsuleNavItem;
  capsuleName: string;
  isInteractionDisabled: boolean;
  onOpenCapsuleActions?: AppSidebarNavigationProps["onOpenCapsuleActions"];
  t: Translate;
}) {
  if (!onOpenCapsuleActions) return null;
  return (
    <Box className="capsule-row-actions-slot">
      <IconButton
        className="capsule-row-actions"
        aria-label={t("capsule.openCapsuleActions", { name: capsuleName })}
        size="small"
        disabled={isInteractionDisabled}
        onClick={(event) => {
          event.stopPropagation();
          onOpenCapsuleActions(event, capsule);
        }}
      >
        <MoreVertRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function CapsuleRowText({
  capsuleName,
  isActive,
}: {
  capsuleName: string;
  isActive: boolean;
}) {
  return (
    <ListItemText
      className="capsule-row-text"
      primary={capsuleName}
      slotProps={{
        primary: {
          noWrap: true,
          sx: {
            fontSize: "14px",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "primary.main" : "text.secondary",
          },
        },
      }}
    />
  );
}

function CapsuleRow({
  capsule,
  activeCapsuleId,
  isInteractionDisabled,
  isOverlaySidebar,
  capsuleHasUnsavedChanges,
  onOpenCapsule,
  onOpenCapsuleActions,
  t,
}: {
  capsule: CapsuleNavItem;
  activeCapsuleId: string;
  isInteractionDisabled: boolean;
  isOverlaySidebar: boolean;
  capsuleHasUnsavedChanges: (capsule: CapsuleNavItem) => boolean;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenCapsuleActions?: AppSidebarNavigationProps["onOpenCapsuleActions"];
  t: Translate;
}) {
  const capsuleId = getCapsuleId(capsule);
  const capsuleName = getCapsuleName(capsule);
  const isActive = capsuleId === activeCapsuleId;

  return (
    <Tooltip title={capsuleName} placement="right">
      <ListItemButton
        selected={isActive}
        disabled={isInteractionDisabled}
        onClick={() => (capsuleId ? onOpenCapsule?.(capsuleId) : undefined)}
        sx={capsuleRowSx(isOverlaySidebar)}
      >
        <CapsuleRowText capsuleName={capsuleName} isActive={isActive} />
        <CapsuleUnsavedDot
          isVisible={capsuleHasUnsavedChanges(capsule)}
          label={t("capsule.notSaved")}
        />
        <CapsuleActionsButton
          capsule={capsule}
          capsuleName={capsuleName}
          isInteractionDisabled={isInteractionDisabled}
          onOpenCapsuleActions={onOpenCapsuleActions}
          t={t}
        />
      </ListItemButton>
    </Tooltip>
  );
}

function ActiveCapsuleAppend({
  activeCapsule,
  activeCapsuleId,
  capsuleHasUnsavedChanges,
  isInteractionDisabled,
  isOverlaySidebar,
  onOpenCapsule,
  onOpenCapsuleActions,
  t,
}: {
  activeCapsule: CapsuleNavItem;
  activeCapsuleId: string;
  capsuleHasUnsavedChanges: (capsule: CapsuleNavItem) => boolean;
  isInteractionDisabled: boolean;
  isOverlaySidebar: boolean;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenCapsuleActions?: AppSidebarNavigationProps["onOpenCapsuleActions"];
  t: Translate;
}) {
  return (
    <>
      <Divider
        aria-hidden="true"
        data-testid="sidebar-active-capsule-divider"
        sx={{ my: 0.75 }}
      />
      <CapsuleRow
        capsule={activeCapsule}
        activeCapsuleId={activeCapsuleId}
        isInteractionDisabled={isInteractionDisabled}
        isOverlaySidebar={isOverlaySidebar}
        capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
        onOpenCapsule={onOpenCapsule}
        onOpenCapsuleActions={onOpenCapsuleActions}
        t={t}
      />
    </>
  );
}

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
  t,
  totalCount,
}: {
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
  t: Translate;
  totalCount: number;
}) {
  const visibleCapsuleIds = new Set(capsuleList.map(getCapsuleId));
  const shouldAppendActiveCapsule =
    Boolean(activeCapsuleId) &&
    Boolean(activeCapsule) &&
    !visibleCapsuleIds.has(activeCapsuleId);
  const displayedCapsuleCount =
    capsuleList.length + (shouldAppendActiveCapsule ? 1 : 0);
  const adjustedRemainingCount = Math.max(
    0,
    totalCount - displayedCapsuleCount,
  );
  const showMoreCount = Math.min(sidebarPageSize, adjustedRemainingCount);

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
      t={t}
      totalCount={totalCount}
    />
  );
}
