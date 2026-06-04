import type { MouseEvent, ReactNode } from "react";
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { CapsulePrimaryActions } from "./AppSidebarCapsuleActions";
import {
  getCapsuleChildrenSx,
  getCapsuleRowSx,
} from "./AppSidebarCapsuleNavigationStyles";
import type { CapsuleNavItem } from "./AppSidebarNavigationTypes";

const capsuleChildrenInlineEndInset = 1.5;
const capsuleHighlightInlineStartInset = 1.5;

type Translate = (key: string, params?: Record<string, unknown>) => string;

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
        sx={{ fontSize: 10, color: "success.main", mr: 0.75, flexShrink: 0 }}
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
  t,
}: {
  capsule: CapsuleNavItem;
  capsuleName: string;
  capsuleChildTabIndex: number;
  isInteractionDisabled: boolean;
  onOpenCapsuleActions?: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleNavItem,
  ) => void;
  t: Translate;
}) {
  if (!onOpenCapsuleActions) {
    return null;
  }

  return (
    <Box className="capsule-row-actions-slot">
      <IconButton
        className="capsule-row-actions"
        aria-label={t("capsule.openCapsuleActions", { name: capsuleName })}
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
    </Box>
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
  t,
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
  t: Translate;
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
          slotProps={{
            primary: {
              noWrap: true,
              sx: {
                fontSize: "14px",
                fontWeight: isActive ? 700 : 500,
              },
            },
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
          t={t}
        />
      </ListItemButton>
    </Tooltip>
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
    <List
      sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 0, pt: 0, pb: 1 }}
    >
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
          t={t}
        />
      ))}
    </List>
  );
}

function SidebarSectionLabel({
  label,
  actions,
}: {
  label: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        minHeight: 40,
        pt: 1.5,
        pb: 0.5,
        pl: "10px",
        pr: 0,
      }}
    >
      <Typography
        sx={{
          color: "text.secondary",
          flex: 1,
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          lineHeight: 1.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Typography>
      {actions}
    </Stack>
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
      sx={getCapsuleChildrenSx(showCapsuleChildren)}
    >
      <Stack
        sx={{
          minHeight: 0,
          overflow: "hidden",
          ml: 0,
          mr: capsuleChildrenInlineEndInset,
          pl: capsuleHighlightInlineStartInset,
        }}
      >
        <SidebarSectionLabel
          label={t("capsule.yourCapsules")}
          actions={
            <CapsulePrimaryActions
              capsuleChildTabIndex={capsuleChildTabIndex}
              isInteractionDisabled={isInteractionDisabled}
              onCreateCapsule={onCreateCapsule}
              onSearchCapsules={onSearchCapsules}
              t={t}
            />
          }
        />
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

export { CapsuleChildren, SidebarSectionLabel };
