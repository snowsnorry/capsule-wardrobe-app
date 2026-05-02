import type { MouseEvent, ReactElement, ReactNode } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import ManageSearchRoundedIcon from "@mui/icons-material/ManageSearchRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import { useI18n } from "../i18n/useI18n";

type AppId = "capsule" | "explore" | "statistics";

type CapsuleNavItem = {
  id?: string;
  name?: string;
  [key: string]: unknown;
};

type AppSidebarNavigationProps = {
  activeApp: AppId;
  isOverlaySidebar: boolean;
  isSidebarCollapsed: boolean;
  desktopSidebarRailWidth: number;
  isInteractionDisabled?: boolean;
  capsuleList?: CapsuleNavItem[];
  activeCapsuleId?: string;
  onNavigateApp: (nextApp: AppId) => void;
  onCreateCapsule?: () => Promise<void> | void;
  onSearchCapsules?: () => void;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenCapsuleActions?: (event: MouseEvent<HTMLElement>, capsule: CapsuleNavItem) => void;
  capsuleHasUnsavedChanges?: (capsule: CapsuleNavItem) => boolean;
  onExpandedAction?: () => void;
  collapsedExpandHitbox?: ReactNode;
};

const naturalEase = "cubic-bezier(0.2, 0, 0, 1)";
const motionTransition = `grid-template-rows 240ms ${naturalEase}, max-height 240ms ${naturalEase}, opacity 180ms ease-in-out`;
const expandedCapsuleChildrenMaxHeight = "calc(100vh - 260px)";
const capsuleRailOffset = "30px";
const topLevelIconRailWidth = "60px";
const expandedTopLevelIconShift = "-12px";

function AppSidebarNavigation({
  activeApp,
  isOverlaySidebar,
  isSidebarCollapsed,
  desktopSidebarRailWidth,
  isInteractionDisabled = false,
  capsuleList = [],
  activeCapsuleId = "",
  onNavigateApp,
  onCreateCapsule,
  onSearchCapsules,
  onOpenCapsule,
  onOpenCapsuleActions,
  capsuleHasUnsavedChanges = () => false,
  onExpandedAction,
  collapsedExpandHitbox = null
}: AppSidebarNavigationProps): ReactElement {
  const { t } = useI18n();
  const isCollapsedDesktop = isSidebarCollapsed && !isOverlaySidebar;
  const showCapsuleChildren = activeApp === "capsule" && !isCollapsedDesktop;
  const capsuleChildTabIndex = showCapsuleChildren ? 0 : -1;
  const topLevelButtonSx = {
    justifyContent: "flex-start",
    px: 0,
    minHeight: 48,
    width: "100%",
    minWidth: 0,
    borderRadius: isCollapsedDesktop ? 0 : 2.5,
    color: "text.primary",
    bgcolor: "transparent",
    "&.Mui-disabled": { color: "text.disabled" }
  } as const;
  const capsulePrimaryActionSx = {
    justifyContent: "flex-start",
    minHeight: 44,
    ml: -1.5,
    pl: 1.5,
    pr: 0,
    borderRadius: 999,
    color: "primary.main"
  } as const;

  const renderTopLevelLabel = (label: string, isActive: boolean) => (
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
        transition: "opacity 180ms ease, transform 220ms ease"
      }}
    >
      {label}
    </Box>
  );

  const renderTopLevelIcon = (icon: ReactElement, label: string, isActive: boolean) => (
    <Tooltip title={isCollapsedDesktop ? label : ""} placement="right">
      <Box
        sx={{
          width: isCollapsedDesktop ? desktopSidebarRailWidth : topLevelIconRailWidth,
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
          transform: isCollapsedDesktop ? "none" : `translateX(${expandedTopLevelIconShift})`,
          color: isActive ? "primary.main" : "text.secondary"
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  );

  const handleCapsuleClick = () => {
    onNavigateApp("capsule");
    onExpandedAction?.();
  };

  const handleExploreClick = () => {
    onNavigateApp("explore");
    onExpandedAction?.();
  };

  const handleStatisticsClick = () => {
    onNavigateApp("statistics");
    onExpandedAction?.();
  };

  return (
    <Stack sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
      <Box sx={{ px: isCollapsedDesktop ? 0 : 1.5, pt: 0.5 }}>
        <Button
          aria-expanded={showCapsuleChildren}
          aria-label={t("launcher.capsule")}
          disabled={isInteractionDisabled}
          onClick={handleCapsuleClick}
          sx={{
            ...topLevelButtonSx,
            bgcolor: "transparent"
          }}
        >
          {renderTopLevelIcon(<ViewInArRoundedIcon />, t("launcher.capsule"), activeApp === "capsule")}
          {renderTopLevelLabel(t("launcher.capsule"), activeApp === "capsule")}
        </Button>
      </Box>

      <Box
        data-testid="capsule-sidebar-children"
        aria-hidden={!showCapsuleChildren}
        sx={{
          display: "grid",
          flex: "0 1 auto",
          minHeight: 0,
          maxHeight: showCapsuleChildren ? expandedCapsuleChildrenMaxHeight : "0px",
          gridTemplateRows: showCapsuleChildren ? "minmax(0, 1fr)" : "0fr",
          opacity: showCapsuleChildren ? 1 : 0,
          overflow: "hidden",
          transition: motionTransition,
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none"
          }
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
            borderColor: "divider"
          }}
        >
          <Button
            variant="text"
            tabIndex={capsuleChildTabIndex}
            disabled={isInteractionDisabled || !onCreateCapsule}
            onClick={() => void onCreateCapsule?.()}
            sx={capsulePrimaryActionSx}
          >
            <AddRoundedIcon sx={{ mr: 2.2 }} />
            <Box component="span" sx={{ fontWeight: 550 }}>{t("capsule.new")}</Box>
          </Button>
          <Button
            variant="text"
            tabIndex={capsuleChildTabIndex}
            disabled={isInteractionDisabled || !onSearchCapsules}
            onClick={onSearchCapsules}
            sx={capsulePrimaryActionSx}
          >
            <SearchRoundedIcon sx={{ mr: 2.2 }} />
            <Box component="span" sx={{ fontWeight: 550 }}>{t("capsule.search")}</Box>
          </Button>

          <Stack direction="row" alignItems="center" sx={{ pt: 2, pb: 1, minHeight: 40 }}>
            <Typography sx={{ color: "text.secondary", fontSize: "0.95rem", flex: 1 }}>
              {t("capsule.yourCapsules")}
            </Typography>
          </Stack>

          <List sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 0, pb: 1 }}>
            {capsuleList.map((capsule) => {
              const capsuleId = String(capsule.id || "");
              const capsuleName = String(capsule.name || "");
              const isActive = capsuleId === activeCapsuleId;
              return (
                <Tooltip key={capsuleId} title={capsuleName} placement="right">
                  <ListItemButton
                    tabIndex={capsuleChildTabIndex}
                    selected={isActive}
                    disabled={isInteractionDisabled}
                    onClick={() => capsuleId ? onOpenCapsule?.(capsuleId) : undefined}
                    sx={{
                      borderRadius: 999,
                      mb: 0.5,
                      px: 2,
                      minHeight: 48,
                      "& .capsule-row-unsaved-dot": {
                        opacity: 1,
                        transition: "opacity 120ms ease"
                      },
                      "& .capsule-row-actions": {
                        opacity: isOverlaySidebar ? 1 : 0,
                        width: isOverlaySidebar ? 32 : 0,
                        height: 32,
                        minWidth: 0,
                        p: isOverlaySidebar ? 0.5 : 0,
                        overflow: "hidden",
                        pointerEvents: isOverlaySidebar ? "auto" : "none",
                        transition: "opacity 160ms ease, width 160ms ease, padding 160ms ease"
                      },
                      ...(!isOverlaySidebar ? {
                        "&:hover .capsule-row-unsaved-dot, &:focus-within .capsule-row-unsaved-dot": {
                          opacity: 0
                        }
                      } : {}),
                      "&:hover .capsule-row-actions": {
                        opacity: 1,
                        width: 32,
                        p: 0.5,
                        pointerEvents: "auto"
                      },
                      "&:focus-within .capsule-row-actions": {
                        opacity: 1,
                        width: 32,
                        p: 0.5,
                        pointerEvents: "auto"
                      }
                    }}
                  >
                    <ListItemText
                      primary={capsuleName}
                      primaryTypographyProps={{ noWrap: true, fontWeight: isActive ? 700 : 500 }}
                    />
                    {capsuleHasUnsavedChanges(capsule) ? (
                      <Tooltip title={t("capsule.notSaved")}>
                        <FiberManualRecordRoundedIcon className="capsule-row-unsaved-dot" sx={{ fontSize: 10, color: "#2f8f58", mr: 0.75, flexShrink: 0 }} />
                      </Tooltip>
                    ) : null}
                    {onOpenCapsuleActions ? (
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
                    ) : null}
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </List>
        </Stack>
      </Box>

      <Divider
        sx={{
          mt: showCapsuleChildren ? 1.5 : 0,
          mb: showCapsuleChildren ? 1.5 : 0,
          opacity: showCapsuleChildren ? 1 : 0,
          transition: `margin 240ms ${naturalEase}, opacity 160ms ease-in-out`,
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none"
          }
        }}
      />

      <Stack
        spacing={0.5}
        sx={{
          px: isCollapsedDesktop ? 0 : 1.5,
          mt: showCapsuleChildren ? 0 : 0.5,
          transition: `margin 240ms ${naturalEase}`,
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none"
          }
        }}
      >
        <Button
          aria-label={t("launcher.explore")}
          disabled={isInteractionDisabled}
          onClick={handleExploreClick}
          sx={{
            ...topLevelButtonSx,
            bgcolor: "transparent"
          }}
        >
          {renderTopLevelIcon(<ManageSearchRoundedIcon />, t("launcher.explore"), activeApp === "explore")}
          {renderTopLevelLabel(t("launcher.explore"), activeApp === "explore")}
        </Button>
        <Button
          aria-label={t("launcher.statistics")}
          disabled={isInteractionDisabled}
          onClick={handleStatisticsClick}
          sx={{
            ...topLevelButtonSx,
            bgcolor: "transparent"
          }}
        >
          {renderTopLevelIcon(<BarChartRoundedIcon />, t("launcher.statistics"), activeApp === "statistics")}
          {renderTopLevelLabel(t("launcher.statistics"), activeApp === "statistics")}
        </Button>
      </Stack>

      {isCollapsedDesktop ? collapsedExpandHitbox : null}
    </Stack>
  );
}

export type { AppId as AppSidebarNavigationAppId, CapsuleNavItem };
export default AppSidebarNavigation;
