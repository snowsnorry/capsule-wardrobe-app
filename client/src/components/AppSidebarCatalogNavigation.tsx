import { Box, List, ListItemButton, ListItemText, Stack } from "@mui/material";
import ManageSearchRoundedIcon from "@mui/icons-material/ManageSearchRounded";
import { SidebarTopLevelButton } from "./AppSidebarNavigationParts";
import type { AppId } from "./AppSidebarNavigationTypes";

const naturalEase = "cubic-bezier(0.2, 0, 0, 1)";
const catalogChildrenMotionTransition = `grid-template-rows 240ms ${naturalEase}, max-height 240ms ${naturalEase}, opacity 180ms ease-in-out`;

type Translate = (key: string) => string;

function CatalogChildRow({
  label,
  isActive,
  isInteractionDisabled,
  tabIndex,
  onClick,
}: {
  label: string;
  isActive: boolean;
  isInteractionDisabled: boolean;
  tabIndex: number;
  onClick: () => void;
}) {
  return (
    <ListItemButton
      tabIndex={tabIndex}
      selected={isActive}
      disabled={isInteractionDisabled}
      onClick={onClick}
      sx={{
        borderRadius: "8px",
        mb: 0.25,
        pl: 4.5,
        pr: 1.5,
        minHeight: 40,
      }}
    >
      <ListItemText
        primary={label}
        primaryTypographyProps={{
          noWrap: true,
          fontWeight: isActive ? 700 : 500,
        }}
      />
    </ListItemButton>
  );
}

function CatalogChildren({
  showCatalogChildren,
  activeApp,
  isInteractionDisabled,
  onNavigateApp,
  t,
}: {
  showCatalogChildren: boolean;
  activeApp: AppId;
  isInteractionDisabled: boolean;
  onNavigateApp: (nextApp: AppId) => void;
  t: Translate;
}) {
  const catalogChildTabIndex = showCatalogChildren ? 0 : -1;

  return (
    <Box
      data-testid="catalog-sidebar-children"
      aria-hidden={!showCatalogChildren}
      sx={{
        display: "grid",
        flex: "0 0 auto",
        minHeight: 0,
        maxHeight: showCatalogChildren ? "96px" : "0px",
        gridTemplateRows: showCatalogChildren ? "1fr" : "0fr",
        opacity: showCatalogChildren ? 1 : 0,
        overflow: "hidden",
        transition: catalogChildrenMotionTransition,
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
        },
      }}
    >
      <List sx={{ overflow: "hidden", px: 1.5, pt: 0, pb: 0.5 }}>
        <CatalogChildRow
          label={t("sidebar.explore")}
          isActive={activeApp === "explore"}
          isInteractionDisabled={isInteractionDisabled}
          tabIndex={catalogChildTabIndex}
          onClick={() => onNavigateApp("explore")}
        />
        <CatalogChildRow
          label={t("sidebar.statistics")}
          isActive={activeApp === "statistics"}
          isInteractionDisabled={isInteractionDisabled}
          tabIndex={catalogChildTabIndex}
          onClick={() => onNavigateApp("statistics")}
        />
      </List>
    </Box>
  );
}

function CatalogGroupNavigation({
  activeApp,
  isInteractionDisabled,
  isCollapsedDesktop,
  showCatalogChildren,
  desktopSidebarRailWidth,
  onNavigateApp,
  t,
}: {
  activeApp: AppId;
  isInteractionDisabled: boolean;
  isCollapsedDesktop: boolean;
  showCatalogChildren: boolean;
  desktopSidebarRailWidth: number;
  onNavigateApp: (nextApp: AppId) => void;
  t: Translate;
}) {
  const isCatalogActive = activeApp === "explore" || activeApp === "statistics";

  return (
    <Stack
      spacing={0.5}
      sx={{
        px: isCollapsedDesktop ? 0 : 1.5,
        mt: 0.5,
        transition: `margin 240ms ${naturalEase}`,
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
        },
      }}
    >
      <SidebarTopLevelButton
        label={t("sidebar.catalog")}
        icon={<ManageSearchRoundedIcon />}
        isActive={isCatalogActive}
        isExpanded={showCatalogChildren}
        isInteractionDisabled={isInteractionDisabled}
        isCollapsedDesktop={isCollapsedDesktop}
        desktopSidebarRailWidth={desktopSidebarRailWidth}
        onClick={() => onNavigateApp("explore")}
      />
      <CatalogChildren
        showCatalogChildren={showCatalogChildren}
        activeApp={activeApp}
        isInteractionDisabled={isInteractionDisabled}
        onNavigateApp={onNavigateApp}
        t={t}
      />
    </Stack>
  );
}

export default CatalogGroupNavigation;
