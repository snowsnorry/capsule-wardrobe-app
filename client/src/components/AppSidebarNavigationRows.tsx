import { type ReactElement } from "react";
import {
  Box,
  CircularProgress,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
} from "@mui/material";
import {
  getCountBadgeLabel,
  TopLevelCountBadge,
} from "./AppSidebarNavigationTopLevelBadge";
import {
  TopLevelIcon,
  topLevelIconRailWidth,
} from "./AppSidebarNavigationTopLevelIcon";

export { topLevelIconRailWidth };
export const sidebarPageSize = 10;

export type Translate = (
  key: string,
  params?: Record<string, unknown>,
) => string;

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
      sx={{
        display: "flex",
        flexShrink: 0,
        ml: "auto",
        mr: 0,
        position: "relative",
        zIndex: 1,
      }}
    >
      {actions}
    </Box>
  );
}

function TopLevelRowContent({
  label,
  icon,
  isActive,
  isJobActive,
  isCollapsedDesktop,
  desktopSidebarRailWidth,
  countBadge,
  ariaExpanded,
}: {
  label: string;
  icon: ReactElement;
  isActive: boolean;
  isJobActive: boolean;
  isCollapsedDesktop: boolean;
  desktopSidebarRailWidth: number;
  countBadge?: number | null;
  ariaExpanded?: boolean;
}) {
  const countBadgeLabel = isJobActive ? null : getCountBadgeLabel(countBadge);

  return (
    <>
      <TopLevelIcon
        icon={icon}
        label={label}
        isActive={isActive}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        ariaExpanded={ariaExpanded}
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
      {!isCollapsedDesktop && isJobActive ? (
        <CircularProgress
          aria-label={`${label} is busy`}
          size={16}
          thickness={5}
          sx={{ color: "primary.main", flexShrink: 0, ml: 1 }}
        />
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
        isJobActive={false}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        countBadge={countBadge}
      />
    </Box>
  );
}

type TopLevelRowProps = {
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
  isJobActive?: boolean;
  suppressHoverBackground?: boolean;
  showActiveBackground?: boolean;
};

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
  isJobActive = false,
  suppressHoverBackground = false,
  showActiveBackground = false,
}: TopLevelRowProps) {
  const countBadgeLabel = isJobActive ? null : getCountBadgeLabel(countBadge);
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
        isJobActive={isJobActive}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        countBadge={countBadge}
        ariaExpanded={ariaExpanded}
      />
    </ListItemButton>
  ) : (
    <TopLevelStaticRow
      label={label}
      icon={icon}
      isActive={isActive}
      isCollapsedDesktop={isCollapsedDesktop}
      desktopSidebarRailWidth={desktopSidebarRailWidth}
      countBadge={isJobActive ? null : countBadge}
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
      <Box component="span" sx={{ display: "block" }}>
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
      </Box>
    </Tooltip>
  );
}
