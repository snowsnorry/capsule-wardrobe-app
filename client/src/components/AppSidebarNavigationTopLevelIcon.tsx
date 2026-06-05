import { type ReactElement } from "react";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { Box, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

export const topLevelIconRailWidth = "40px";

const topLevelIconSize = 24;

function TopLevelDisclosureBadge({
  ariaExpanded,
  isActive,
}: {
  ariaExpanded: boolean;
  isActive: boolean;
}) {
  return (
    <Box
      className="sidebar-top-level-disclosure-badge"
      component="span"
      data-disclosure-state={ariaExpanded ? "expanded" : "collapsed"}
      sx={(theme) => {
        const badgeBackground = isActive
          ? theme.palette.mode === "dark"
            ? "oklch(34% 0.07 190)"
            : theme.palette.primary.dark
          : theme.palette.mode === "dark"
            ? "oklch(32% 0.018 188)"
            : theme.palette.text.secondary;

        return {
          alignItems: "center",
          bgcolor: badgeBackground,
          borderRadius: "var(--cw-radius-circle)",
          bottom: -4,
          boxShadow: [
            `0 0 0 2px ${theme.palette.background.paper}`,
            `0 1px 3px ${alpha(theme.palette.common.black, 0.2)}`,
          ].join(", "),
          color: theme.palette.common.white,
          display: "inline-flex",
          height: 15,
          justifyContent: "center",
          pointerEvents: "none",
          position: "absolute",
          right: -5,
          transform: "scale(0.7)",
          transformOrigin: "center",
          width: 15,
          "& svg": {
            height: 14,
            transform: ariaExpanded ? "rotate(90deg)" : "none",
            transition: "transform 180ms ease",
            width: 14,
          },
          "@media (prefers-reduced-motion: reduce)": {
            "& svg": {
              transition: "none",
            },
          },
        };
      }}
    >
      <ChevronRightRoundedIcon fontSize="inherit" />
    </Box>
  );
}

export function TopLevelIcon({
  icon,
  label,
  isActive,
  isCollapsedDesktop,
  desktopSidebarRailWidth,
  ariaExpanded,
}: {
  icon: ReactElement;
  label: string;
  isActive: boolean;
  isCollapsedDesktop: boolean;
  desktopSidebarRailWidth: number;
  ariaExpanded?: boolean;
}) {
  const hasDisclosureIndicator = typeof ariaExpanded === "boolean";

  return (
    <Tooltip title={isCollapsedDesktop ? label : ""} placement="right">
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          color: isActive
            ? theme.palette.primary.main
            : theme.palette.text.secondary,
          display: "flex",
          flexShrink: 0,
          justifyContent: "center",
          width: isCollapsedDesktop
            ? desktopSidebarRailWidth
            : topLevelIconRailWidth,
        })}
      >
        <Box
          className="sidebar-top-level-icon-frame"
          component="span"
          sx={{
            alignItems: "center",
            display: "inline-flex",
            height: topLevelIconSize,
            justifyContent: "center",
            position: "relative",
            width: topLevelIconSize,
            "& > svg": {
              height: topLevelIconSize,
              width: topLevelIconSize,
            },
          }}
        >
          {icon}
          {hasDisclosureIndicator ? (
            <TopLevelDisclosureBadge
              ariaExpanded={ariaExpanded}
              isActive={isActive}
            />
          ) : null}
        </Box>
      </Box>
    </Tooltip>
  );
}
