import { type ReactElement } from "react";
import {
  Box,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
} from "@mui/material";
import {
  getCountBadgeLabel,
  TopLevelCountBadge,
} from "./AppSidebarNavigationTopLevelBadge";

export const topLevelIconRailWidth = "40px";
export const sidebarPageSize = 10;
const topLevelIconSize = 24;

export type Translate = (
  key: string,
  params?: Record<string, unknown>,
) => string;

function TopLevelIcon({
  icon,
  label,
  isActive,
  isCollapsedDesktop,
  desktopSidebarRailWidth,
}: {
  icon: ReactElement;
  label: string;
  isActive: boolean;
  isCollapsedDesktop: boolean;
  desktopSidebarRailWidth: number;
}) {
  return (
    <Tooltip title={isCollapsedDesktop ? label : ""} placement="right">
      <Box
        aria-hidden="true"
        sx={{
          width: isCollapsedDesktop
            ? desktopSidebarRailWidth
            : topLevelIconRailWidth,
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
          color: isActive ? "primary.main" : "text.secondary",
          "& svg": { width: topLevelIconSize, height: topLevelIconSize },
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  );
}

function TopLevelActions({
  isCollapsedDesktop,
  actions,
}: {
  isCollapsedDesktop: boolean;
  actions?: ReactElement;
}) {
  if (isCollapsedDesktop || !actions) return null;
  return (
    <Box
      className="sidebar-top-level-actions"
      sx={{ display: "flex", ml: "auto", mr: 0, flexShrink: 0 }}
    >
      {actions}
    </Box>
  );
}

function TopLevelRowContent({
  label,
  icon,
  isActive,
  isCollapsedDesktop,
  desktopSidebarRailWidth,
  countBadge,
}: {
  label: string;
  icon: ReactElement;
  isActive: boolean;
  isCollapsedDesktop: boolean;
  desktopSidebarRailWidth: number;
  countBadge?: number | null;
}) {
  const countBadgeLabel = getCountBadgeLabel(countBadge);

  return (
    <>
      <TopLevelIcon
        icon={icon}
        label={label}
        isActive={isActive}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
      />
      <Box
        component="span"
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textAlign: "left",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          mr: countBadgeLabel ? 1 : 0,
          opacity: isCollapsedDesktop ? 0 : 1,
          fontSize: "0.9375rem",
          fontWeight: isActive ? 700 : 650,
          color: isActive ? "primary.main" : "text.primary",
          transition: "opacity 180ms ease",
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none",
          },
        }}
      >
        {label}
      </Box>
      {!isCollapsedDesktop && countBadgeLabel ? (
        <TopLevelCountBadge count={countBadgeLabel} isActive={isActive} />
      ) : null}
    </>
  );
}

function TopLevelStaticRow({
  label,
  icon,
  isActive,
  isCollapsedDesktop,
  desktopSidebarRailWidth,
  countBadge,
  showActiveBackground,
}: {
  label: string;
  icon: ReactElement;
  isActive: boolean;
  isCollapsedDesktop: boolean;
  desktopSidebarRailWidth: number;
  countBadge?: number | null;
  showActiveBackground?: boolean;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        borderRadius: isCollapsedDesktop ? 0 : "var(--cw-radius-card)",
        color: isActive ? "primary.main" : "text.primary",
        display: "flex",
        flex: 1,
        bgcolor:
          showActiveBackground && isActive ? "action.selected" : "transparent",
        minHeight: 44,
        minWidth: 0,
      }}
    >
      <TopLevelRowContent
        label={label}
        icon={icon}
        isActive={isActive}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        countBadge={countBadge}
      />
    </Box>
  );
}

export function TopLevelRow({
  label,
  icon,
  isActive,
  isInteractionDisabled,
  isCollapsedDesktop,
  desktopSidebarRailWidth,
  ariaExpanded,
  onClick,
  actions,
  countBadge,
  suppressHoverBackground = false,
  showActiveBackground = false,
}: {
  label: string;
  icon: ReactElement;
  isActive: boolean;
  isInteractionDisabled: boolean;
  isCollapsedDesktop: boolean;
  desktopSidebarRailWidth: number;
  ariaExpanded?: boolean;
  onClick?: () => void;
  actions?: ReactElement;
  countBadge?: number | null;
  suppressHoverBackground?: boolean;
  showActiveBackground?: boolean;
}) {
  const countBadgeLabel = getCountBadgeLabel(countBadge);
  const accessibleLabel = countBadgeLabel
    ? `${label}, ${countBadgeLabel}`
    : label;
  const rowContent = onClick ? (
    <ListItemButton
      aria-label={accessibleLabel}
      aria-expanded={ariaExpanded}
      className={
        suppressHoverBackground ? "sidebar-top-level-quiet-hover" : undefined
      }
      disabled={isInteractionDisabled}
      onClick={onClick}
      selected={showActiveBackground && isActive}
      sx={{
        justifyContent: "flex-start",
        flex: 1,
        px: 0,
        minHeight: 44,
        minWidth: 0,
        borderRadius: isCollapsedDesktop ? 0 : "var(--cw-radius-card)",
        color: isActive ? "primary.main" : "text.primary",
        textTransform: "none",
        "&.Mui-disabled": { color: "text.disabled" },
        "&.sidebar-top-level-quiet-hover:hover": {
          bgcolor: "transparent",
        },
      }}
    >
      <TopLevelRowContent
        label={label}
        icon={icon}
        isActive={isActive}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        countBadge={countBadge}
      />
    </ListItemButton>
  ) : (
    <TopLevelStaticRow
      label={label}
      icon={icon}
      isActive={isActive}
      isCollapsedDesktop={isCollapsedDesktop}
      desktopSidebarRailWidth={desktopSidebarRailWidth}
      countBadge={countBadge}
      showActiveBackground={showActiveBackground}
    />
  );

  return (
    <Stack direction="row" sx={{ alignItems: "center", minHeight: 44 }}>
      {rowContent}
      <TopLevelActions
        isCollapsedDesktop={isCollapsedDesktop}
        actions={actions}
      />
    </Stack>
  );
}

export function ChildRow({
  label,
  isActive,
  isInteractionDisabled,
  onClick,
}: {
  label: string;
  isActive: boolean;
  isInteractionDisabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={label} placement="right">
      <ListItemButton
        selected={isActive}
        disabled={isInteractionDisabled}
        onClick={onClick}
        sx={{
          borderRadius: "var(--cw-radius-card)",
          mb: 0.25,
          ml: 0,
          pl: topLevelIconRailWidth,
          pr: 1.5,
          minHeight: 34,
          py: 0.5,
          width: "100%",
        }}
      >
        <ListItemText
          primary={label}
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
      </ListItemButton>
    </Tooltip>
  );
}
