import type { MouseEvent } from "react";
import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import type { CapsuleNavItem } from "./AppSidebarNavigationTypes";

const naturalEase = "cubic-bezier(0.2, 0, 0, 1)";
const motionTransition = `grid-template-rows 240ms ${naturalEase}, max-height 240ms ${naturalEase}, opacity 180ms ease-in-out`;
const expandedCapsuleChildrenMaxHeight = "calc(100vh - 260px)";
const capsuleRailOffset = "30px";

type Translate = (key: string) => string;

const capsulePrimaryActionSx = {
  justifyContent: "flex-start",
  minHeight: 44,
  ml: -1.5,
  pl: 1.5,
  pr: 0,
  borderRadius: 999,
  color: "primary.main",
} as const;

function getCapsuleRowSx(isOverlaySidebar: boolean) {
  return {
    borderRadius: 999,
    mb: 0.5,
    px: 2,
    minHeight: 48,
    "& .capsule-row-unsaved-dot": {
      opacity: 1,
      transition: "opacity 120ms ease",
    },
    "& .capsule-row-actions": {
      opacity: isOverlaySidebar ? 1 : 0,
      width: isOverlaySidebar ? 32 : 0,
      height: 32,
      minWidth: 0,
      p: isOverlaySidebar ? 0.5 : 0,
      overflow: "hidden",
      pointerEvents: isOverlaySidebar ? "auto" : "none",
      transition: "opacity 160ms ease, width 160ms ease, padding 160ms ease",
    },
    ...(!isOverlaySidebar
      ? {
          "&:hover .capsule-row-unsaved-dot, &:focus-within .capsule-row-unsaved-dot":
            {
              opacity: 0,
            },
        }
      : {}),
    "&:hover .capsule-row-actions": {
      opacity: 1,
      width: 32,
      p: 0.5,
      pointerEvents: "auto",
    },
    "&:focus-within .capsule-row-actions": {
      opacity: 1,
      width: 32,
      p: 0.5,
      pointerEvents: "auto",
    },
  } as const;
}

function CapsuleUnsavedDot({
  isVisible,
  label,
}: {
  isVisible: boolean;
  label: string;
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <Tooltip title={label}>
      <FiberManualRecordRoundedIcon
        className="capsule-row-unsaved-dot"
        sx={{ fontSize: 10, color: "#2f8f58", mr: 0.75, flexShrink: 0 }}
      />
    </Tooltip>
  );
}

function CapsuleActionsButton({
  capsule,
  capsuleName,
  capsuleChildTabIndex,
  isInteractionDisabled,
  onOpenCapsuleActions,
}: {
  capsule: CapsuleNavItem;
  capsuleName: string;
  capsuleChildTabIndex: number;
  isInteractionDisabled: boolean;
  onOpenCapsuleActions?: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleNavItem,
  ) => void;
}) {
  if (!onOpenCapsuleActions) {
    return null;
  }

  return (
    <IconButton
      className="capsule-row-actions"
      aria-label={`Capsule actions ${capsuleName}`}
      size="small"
      tabIndex={capsuleChildTabIndex}
      disabled={isInteractionDisabled}
      onClick={(event) => {
        event.stopPropagation();
        onOpenCapsuleActions(event, capsule);
      }}
    >
      <MoreVertRoundedIcon fontSize="small" />
    </IconButton>
  );
}

function CapsuleRow({
  capsule,
  activeCapsuleId,
  capsuleChildTabIndex,
  isInteractionDisabled,
  isOverlaySidebar,
  capsuleHasUnsavedChanges,
  onOpenCapsule,
  onOpenCapsuleActions,
  notSavedLabel,
}: {
  capsule: CapsuleNavItem;
  activeCapsuleId: string;
  capsuleChildTabIndex: number;
  isInteractionDisabled: boolean;
  isOverlaySidebar: boolean;
  capsuleHasUnsavedChanges: (capsule: CapsuleNavItem) => boolean;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenCapsuleActions?: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleNavItem,
  ) => void;
  notSavedLabel: string;
}) {
  const capsuleId = String(capsule.id || "");
  const capsuleName = String(capsule.name || "");
  const isActive = capsuleId === activeCapsuleId;

  return (
    <Tooltip title={capsuleName} placement="right">
      <ListItemButton
        tabIndex={capsuleChildTabIndex}
        selected={isActive}
        disabled={isInteractionDisabled}
        onClick={() => (capsuleId ? onOpenCapsule?.(capsuleId) : undefined)}
        sx={getCapsuleRowSx(isOverlaySidebar)}
      >
        <ListItemText
          primary={capsuleName}
          primaryTypographyProps={{
            noWrap: true,
            fontWeight: isActive ? 700 : 500,
          }}
        />
        <CapsuleUnsavedDot
          isVisible={capsuleHasUnsavedChanges(capsule)}
          label={notSavedLabel}
        />
        <CapsuleActionsButton
          capsule={capsule}
          capsuleName={capsuleName}
          capsuleChildTabIndex={capsuleChildTabIndex}
          isInteractionDisabled={isInteractionDisabled}
          onOpenCapsuleActions={onOpenCapsuleActions}
        />
      </ListItemButton>
    </Tooltip>
  );
}

function CapsulePrimaryActions({
  capsuleChildTabIndex,
  isInteractionDisabled,
  onCreateCapsule,
  onSearchCapsules,
  t,
}: {
  capsuleChildTabIndex: number;
  isInteractionDisabled: boolean;
  onCreateCapsule?: () => Promise<void> | void;
  onSearchCapsules?: () => void;
  t: Translate;
}) {
  return (
    <>
      <Button
        variant="text"
        tabIndex={capsuleChildTabIndex}
        disabled={isInteractionDisabled || !onCreateCapsule}
        onClick={() => void onCreateCapsule?.()}
        sx={capsulePrimaryActionSx}
      >
        <AddRoundedIcon sx={{ mr: 2.2 }} />
        <Box component="span" sx={{ fontWeight: 550 }}>
          {t("capsule.new")}
        </Box>
      </Button>
      <Button
        variant="text"
        tabIndex={capsuleChildTabIndex}
        disabled={isInteractionDisabled || !onSearchCapsules}
        onClick={onSearchCapsules}
        sx={capsulePrimaryActionSx}
      >
        <SearchRoundedIcon sx={{ mr: 2.2 }} />
        <Box component="span" sx={{ fontWeight: 550 }}>
          {t("capsule.search")}
        </Box>
      </Button>
    </>
  );
}

function CapsuleList({
  capsuleList,
  activeCapsuleId,
  capsuleChildTabIndex,
  isInteractionDisabled,
  isOverlaySidebar,
  capsuleHasUnsavedChanges,
  onOpenCapsule,
  onOpenCapsuleActions,
  t,
}: {
  capsuleList: CapsuleNavItem[];
  activeCapsuleId: string;
  capsuleChildTabIndex: number;
  isInteractionDisabled: boolean;
  isOverlaySidebar: boolean;
  capsuleHasUnsavedChanges: (capsule: CapsuleNavItem) => boolean;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenCapsuleActions?: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleNavItem,
  ) => void;
  t: Translate;
}) {
  return (
    <List sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 0, pb: 1 }}>
      {capsuleList.map((capsule) => (
        <CapsuleRow
          key={String(capsule.id || "")}
          capsule={capsule}
          activeCapsuleId={activeCapsuleId}
          capsuleChildTabIndex={capsuleChildTabIndex}
          isInteractionDisabled={isInteractionDisabled}
          isOverlaySidebar={isOverlaySidebar}
          capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
          onOpenCapsule={onOpenCapsule}
          onOpenCapsuleActions={onOpenCapsuleActions}
          notSavedLabel={t("capsule.notSaved")}
        />
      ))}
    </List>
  );
}

function CapsuleChildren({
  showCapsuleChildren,
  capsuleChildTabIndex,
  isInteractionDisabled,
  isOverlaySidebar,
  capsuleList,
  activeCapsuleId,
  onCreateCapsule,
  onSearchCapsules,
  onOpenCapsule,
  onOpenCapsuleActions,
  capsuleHasUnsavedChanges,
  t,
}: {
  showCapsuleChildren: boolean;
  capsuleChildTabIndex: number;
  isInteractionDisabled: boolean;
  isOverlaySidebar: boolean;
  capsuleList: CapsuleNavItem[];
  activeCapsuleId: string;
  onCreateCapsule?: () => Promise<void> | void;
  onSearchCapsules?: () => void;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenCapsuleActions?: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleNavItem,
  ) => void;
  capsuleHasUnsavedChanges: (capsule: CapsuleNavItem) => boolean;
  t: Translate;
}) {
  return (
    <Box
      data-testid="capsule-sidebar-children"
      aria-hidden={!showCapsuleChildren}
      sx={{
        display: "grid",
        flex: "0 1 auto",
        minHeight: 0,
        maxHeight: showCapsuleChildren
          ? expandedCapsuleChildrenMaxHeight
          : "0px",
        gridTemplateRows: showCapsuleChildren ? "minmax(0, 1fr)" : "0fr",
        opacity: showCapsuleChildren ? 1 : 0,
        overflow: "hidden",
        transition: motionTransition,
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
        },
      }}
    >
      <Stack
        sx={{
          minHeight: 0,
          overflow: "hidden",
          ml: capsuleRailOffset,
          mr: 1.5,
          pl: 2.5,
          borderLeft: "2px solid",
          borderColor: "divider",
        }}
      >
        <CapsulePrimaryActions
          capsuleChildTabIndex={capsuleChildTabIndex}
          isInteractionDisabled={isInteractionDisabled}
          onCreateCapsule={onCreateCapsule}
          onSearchCapsules={onSearchCapsules}
          t={t}
        />
        <Stack
          direction="row"
          alignItems="center"
          sx={{ pt: 2, pb: 1, minHeight: 40 }}
        >
          <Typography
            sx={{ color: "text.secondary", fontSize: "0.95rem", flex: 1 }}
          >
            {t("capsule.yourCapsules")}
          </Typography>
        </Stack>
        <CapsuleList
          capsuleList={capsuleList}
          activeCapsuleId={activeCapsuleId}
          capsuleChildTabIndex={capsuleChildTabIndex}
          isInteractionDisabled={isInteractionDisabled}
          isOverlaySidebar={isOverlaySidebar}
          capsuleHasUnsavedChanges={capsuleHasUnsavedChanges}
          onOpenCapsule={onOpenCapsule}
          onOpenCapsuleActions={onOpenCapsuleActions}
          t={t}
        />
      </Stack>
    </Box>
  );
}

export { CapsuleChildren };
