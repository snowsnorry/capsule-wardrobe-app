import type { ReactElement } from "react";
import { Box, Button, Divider, Tooltip } from "@mui/material";
import CheckroomOutlinedIcon from "@mui/icons-material/CheckroomOutlined";
import { PiDresser } from "react-icons/pi";
import type { AppId } from "./AppSidebarNavigationTypes";

const topLevelIconRailWidth = "60px";
const expandedTopLevelIconShift = "-6px";

type Translate = (key: string) => string;

function getTopLevelButtonSx(isCollapsedDesktop: boolean) {
  return {
    justifyContent: "flex-start",
    px: 0,
    minHeight: 48,
    width: "100%",
    minWidth: 0,
    borderRadius: isCollapsedDesktop ? 0 : "var(--cw-radius-card)",
    color: "text.primary",
    bgcolor: "transparent",
    "&.Mui-disabled": { color: "text.disabled" },
  } as const;
}

function TopLevelLabel({
  label,
  isActive,
  isCollapsedDesktop,
}: {
  label: string;
  isActive: boolean;
  isCollapsedDesktop: boolean;
}) {
  return (
    <Box
      component="span"
      sx={{
        flex: 1,
        minWidth: 0,
        textAlign: "left",
        fontSize: "1rem",
        fontWeight: 650,
        color: isActive ? "primary.main" : "text.primary",
        whiteSpace: "nowrap",
        overflow: "hidden",
        opacity: isCollapsedDesktop ? 0 : 1,
        transform: isCollapsedDesktop ? "translateX(-8px)" : "translateX(0)",
        transition: "opacity 180ms ease, transform 220ms ease",
      }}
    >
      {label}
    </Box>
  );
}

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
        sx={{
          width: isCollapsedDesktop
            ? desktopSidebarRailWidth
            : topLevelIconRailWidth,
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
          transform: isCollapsedDesktop
            ? "none"
            : `translateX(${expandedTopLevelIconShift})`,
          color: isActive ? "primary.main" : "text.secondary",
          "& svg": {
            width: 24,
            height: 24,
          },
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  );
}

function SidebarTopLevelButton({
  label,
  icon,
  isActive,
  isExpanded,
  isInteractionDisabled,
  isCollapsedDesktop,
  desktopSidebarRailWidth,
  onClick,
}: {
  label: string;
  icon: ReactElement;
  isActive: boolean;
  isExpanded?: boolean;
  isInteractionDisabled: boolean;
  isCollapsedDesktop: boolean;
  desktopSidebarRailWidth: number;
  onClick: () => void;
}) {
  return (
    <Button
      aria-expanded={isExpanded}
      aria-label={label}
      disabled={isInteractionDisabled}
      onClick={onClick}
      sx={{
        ...getTopLevelButtonSx(isCollapsedDesktop),
        bgcolor: "transparent",
      }}
    >
      <TopLevelIcon
        icon={icon}
        label={label}
        isActive={isActive}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
      />
      <TopLevelLabel
        label={label}
        isActive={isActive}
        isCollapsedDesktop={isCollapsedDesktop}
      />
    </Button>
  );
}

function SidebarNavigationDivider({
  showCapsuleChildren,
}: {
  showCapsuleChildren: boolean;
}) {
  return (
    <Divider
      data-testid="sidebar-navigation-divider"
      sx={{
        mt: showCapsuleChildren ? 1.5 : 0,
        mb: showCapsuleChildren ? 1.5 : 0,
        opacity: showCapsuleChildren ? 1 : 0,
        transition: "opacity 160ms ease-in-out",
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
        },
      }}
    />
  );
}

function CapsuleTopLevelNavigation({
  isActive,
  isExpanded,
  isInteractionDisabled,
  isCollapsedDesktop,
  desktopSidebarRailWidth,
  onNavigateApp,
  t,
}: {
  isActive: boolean;
  isExpanded: boolean;
  isInteractionDisabled: boolean;
  isCollapsedDesktop: boolean;
  desktopSidebarRailWidth: number;
  onNavigateApp: (nextApp: AppId) => void;
  t: Translate;
}) {
  return (
    <Box sx={{ px: isCollapsedDesktop ? 0 : 1.5, pt: 0.5 }}>
      <SidebarTopLevelButton
        label={t("launcher.capsule")}
        icon={<CheckroomOutlinedIcon />}
        isActive={isActive}
        isExpanded={isExpanded}
        isInteractionDisabled={isInteractionDisabled}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        onClick={() => onNavigateApp("capsule")}
      />
    </Box>
  );
}

function MyWardrobeTopLevelNavigation({
  isActive,
  isInteractionDisabled,
  isCollapsedDesktop,
  desktopSidebarRailWidth,
  onNavigateApp,
  t,
}: {
  isActive: boolean;
  isInteractionDisabled: boolean;
  isCollapsedDesktop: boolean;
  desktopSidebarRailWidth: number;
  onNavigateApp: (nextApp: AppId) => void;
  t: Translate;
}) {
  return (
    <Box sx={{ px: isCollapsedDesktop ? 0 : 1.5, pt: 0.5 }}>
      <SidebarTopLevelButton
        label={t("launcher.myWardrobe")}
        icon={<PiDresser />}
        isActive={isActive}
        isInteractionDisabled={isInteractionDisabled}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        onClick={() => onNavigateApp("myWardrobe")}
      />
    </Box>
  );
}

export {
  CapsuleTopLevelNavigation,
  MyWardrobeTopLevelNavigation,
  SidebarNavigationDivider,
  SidebarTopLevelButton,
};
