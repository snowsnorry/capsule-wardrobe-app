import {
  Box,
  Divider,
  IconButton,
  ListItemButton,
  ListItemText,
  Tooltip,
} from "@mui/material";
import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { RiPushpinFill, RiPushpinLine } from "react-icons/ri";
import {
  getCapsuleId,
  getCapsuleName,
} from "./AppSidebarNavigationCapsuleRowHelpers";
import { capsuleRowSx } from "./AppSidebarNavigationCapsuleRowStyles";
import type {
  CapsuleRowProps,
  SetCapsulePinHandler,
} from "./AppSidebarNavigationCapsuleRowTypes";
import type {
  AppSidebarNavigationProps,
  CapsuleNavItem,
} from "./AppSidebarNavigationTypes";
import type { Translate } from "./AppSidebarNavigationRows";
import { useMobileLongPressContextMenu } from "./MobileLongPressContextMenu";
import { useOverflowTooltip } from "./useOverflowTooltip";

function CapsulePinButton({
  capsuleId,
  isInteractionDisabled,
  isPinned,
  label,
  onSetPin,
}: {
  capsuleId: string;
  isInteractionDisabled: boolean;
  isPinned: boolean;
  label: string;
  onSetPin?: SetCapsulePinHandler;
}) {
  if (!capsuleId || !onSetPin) return null;

  return (
    <Box
      className="capsule-row-pin-slot"
      data-pinned={isPinned ? "true" : "false"}
    >
      <Tooltip title={label}>
        <Box component="span">
          <IconButton
            className="capsule-row-pin"
            aria-label={label}
            size="small"
            disabled={isInteractionDisabled}
            onClick={(event) => {
              event.stopPropagation();
              void onSetPin(capsuleId, !isPinned);
            }}
          >
            {isPinned ? <RiPushpinFill /> : <RiPushpinLine />}
          </IconButton>
        </Box>
      </Tooltip>
    </Box>
  );
}

function CapsulePinnedIndicator({ isPinned }: { isPinned: boolean }) {
  if (!isPinned) return null;

  return (
    <Box
      aria-hidden="true"
      className="capsule-row-pin-slot capsule-row-pin-indicator"
      data-pinned="true"
    >
      <Box component="span" className="capsule-row-pin">
        <RiPushpinFill />
      </Box>
    </Box>
  );
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
  pinCopyPrefix,
  t,
}: {
  capsule: CapsuleNavItem;
  capsuleName: string;
  isInteractionDisabled: boolean;
  onOpenCapsuleActions?: AppSidebarNavigationProps["onOpenCapsuleActions"];
  pinCopyPrefix: "capsule" | "outfit";
  t: Translate;
}) {
  if (!onOpenCapsuleActions) return null;
  const label =
    pinCopyPrefix === "outfit"
      ? t("outfit.openActions")
      : t("capsule.openCapsuleActions", { name: capsuleName });
  return (
    <Box className="capsule-row-actions-slot">
      <IconButton
        className="capsule-row-actions"
        aria-label={label}
        size="small"
        disabled={isInteractionDisabled}
        onClick={(event) => {
          event.stopPropagation();
          onOpenCapsuleActions(event.currentTarget, capsule, {
            presentation: "anchored",
          });
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
  const { hideTooltip, isTooltipOpen, showTooltipIfOverflowing } =
    useOverflowTooltip();

  return (
    <ListItemText
      className="capsule-row-text"
      primary={
        <Tooltip
          title={capsuleName}
          placement="right"
          open={isTooltipOpen}
          disableInteractive
          onClose={hideTooltip}
        >
          <Box
            component="span"
            className="capsule-row-label"
            onFocus={(event) => showTooltipIfOverflowing(event.currentTarget)}
            onBlur={hideTooltip}
            onMouseEnter={(event) =>
              showTooltipIfOverflowing(event.currentTarget)
            }
            onMouseLeave={hideTooltip}
            sx={{
              display: "inline-block",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              verticalAlign: "bottom",
              whiteSpace: "nowrap",
            }}
          >
            {capsuleName}
          </Box>
        </Tooltip>
      }
      slotProps={{
        primary: {
          sx: {
            fontSize: "14px",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "primary.main" : "text.secondary",
            minWidth: 0,
          },
        },
      }}
    />
  );
}

function useCapsuleRowMobileContextMenu({
  capsule,
  isInteractionDisabled,
  isOverlaySidebar,
  onOpenCapsuleActions,
}: Pick<
  CapsuleRowProps,
  | "capsule"
  | "isInteractionDisabled"
  | "isOverlaySidebar"
  | "onOpenCapsuleActions"
>) {
  const enabled =
    isOverlaySidebar &&
    !isInteractionDisabled &&
    typeof onOpenCapsuleActions === "function";
  const mobileLongPress = useMobileLongPressContextMenu({
    enabled,
    shouldStart: shouldStartSidebarRowLongPress,
    onOpen: (anchor, originRect) =>
      onOpenCapsuleActions?.(anchor, capsule, {
        presentation: "mobile-context",
        ...(originRect ? { originRect } : {}),
      }),
  });
  const openMobileContextMenu = (anchor: HTMLElement) => {
    if (enabled) {
      mobileLongPress.openMobileMenu(anchor);
    }
  };

  return {
    hasMobileContextMenu: enabled,
    isPressing: mobileLongPress.isPressing,
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
      if (!enabled) {
        return;
      }
      event.preventDefault();
      openMobileContextMenu(event.currentTarget);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (isKeyboardContextMenuEvent(event) && enabled) {
        event.preventDefault();
        openMobileContextMenu(event.currentTarget);
      }
    },
    pointerHandlers: mobileLongPress.pointerHandlers,
    shouldSuppressClick: mobileLongPress.shouldSuppressClick,
  };
}

export function CapsuleRow({
  capsule,
  activeCapsuleId,
  isInteractionDisabled,
  isOverlaySidebar,
  capsuleHasUnsavedChanges,
  onOpenCapsule,
  onOpenCapsuleActions,
  onSetCapsulePin,
  pinCopyPrefix,
  t,
}: CapsuleRowProps) {
  const capsuleId = getCapsuleId(capsule);
  const capsuleName = getCapsuleName(capsule);
  const isActive = capsuleId === activeCapsuleId;
  const isPinned = Boolean(capsule.pin);
  const pinLabel = t(`${pinCopyPrefix}.${isPinned ? "unpin" : "pin"}`);
  const showInlinePin = !isOverlaySidebar;
  const mobileContextMenu = useCapsuleRowMobileContextMenu({
    capsule,
    isInteractionDisabled,
    isOverlaySidebar,
    onOpenCapsuleActions,
  });
  const handleClick = () => {
    if (mobileContextMenu.shouldSuppressClick()) {
      return;
    }
    if (capsuleId) {
      onOpenCapsule?.(capsuleId);
    }
  };

  return (
    <ListItemButton
      aria-label={capsuleName}
      aria-haspopup={
        mobileContextMenu.hasMobileContextMenu ? "menu" : undefined
      }
      aria-keyshortcuts={
        mobileContextMenu.hasMobileContextMenu ? "Shift+F10" : undefined
      }
      selected={isActive}
      disabled={isInteractionDisabled}
      onClick={handleClick}
      onContextMenu={mobileContextMenu.onContextMenu}
      onKeyDown={mobileContextMenu.onKeyDown}
      {...mobileContextMenu.pointerHandlers}
      sx={capsuleRowSx(isOverlaySidebar, mobileContextMenu.isPressing)}
    >
      {showInlinePin ? (
        <CapsulePinButton
          capsuleId={capsuleId}
          isInteractionDisabled={isInteractionDisabled}
          isPinned={isPinned}
          label={pinLabel}
          onSetPin={onSetCapsulePin}
        />
      ) : (
        <CapsulePinnedIndicator isPinned={isPinned} />
      )}
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
        pinCopyPrefix={pinCopyPrefix}
        t={t}
      />
    </ListItemButton>
  );
}

export function CapsuleRowPreview({
  capsule,
  activeCapsuleId,
}: {
  capsule: CapsuleNavItem;
  activeCapsuleId: string;
}) {
  const capsuleId = getCapsuleId(capsule);
  const capsuleName = getCapsuleName(capsule);
  const isActive = capsuleId === activeCapsuleId;
  const isPinned = Boolean(capsule.pin);
  const hasUnsavedChanges =
    capsule.status === "new" || capsule.status === "modified";
  const t = (key: string) => key;

  return (
    <ListItemButton
      aria-hidden="true"
      component="div"
      selected={isActive}
      tabIndex={-1}
      sx={{
        ...capsuleRowSx(true, false),
        mb: 0,
        pointerEvents: "none",
      }}
    >
      <CapsulePinnedIndicator isPinned={isPinned} />
      <CapsuleRowText capsuleName={capsuleName} isActive={isActive} />
      <CapsuleUnsavedDot
        isVisible={hasUnsavedChanges}
        label={t("capsule.notSaved")}
      />
    </ListItemButton>
  );
}

function shouldStartSidebarRowLongPress(event: ReactPointerEvent<HTMLElement>) {
  const target = event.target;
  return !(
    target instanceof Element &&
    target.closest(".capsule-row-actions, .capsule-row-pin")
  );
}

function isKeyboardContextMenuEvent(event: KeyboardEvent<HTMLElement>) {
  return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

export function ActiveCapsuleAppend({
  activeCapsule,
  activeCapsuleId,
  capsuleHasUnsavedChanges,
  isInteractionDisabled,
  isOverlaySidebar,
  onOpenCapsule,
  onOpenCapsuleActions,
  onSetCapsulePin,
  pinCopyPrefix,
  t,
}: Omit<CapsuleRowProps, "capsule"> & {
  activeCapsule: CapsuleNavItem;
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
        onSetCapsulePin={onSetCapsulePin}
        pinCopyPrefix={pinCopyPrefix}
        t={t}
      />
    </>
  );
}
