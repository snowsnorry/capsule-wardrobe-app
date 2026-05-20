import type { MouseEvent, ReactNode } from "react";
import { Box, Divider, IconButton, Stack, Typography } from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import {
  getContentSurfaceWidthSx,
  getShellMainFrameSx,
  getShellMainLayout,
  getShellMainStackSx,
} from "./AppSidebarShellContentLayout";
import { SidebarFrame, UserMenu } from "./AppSidebarShellContentMenus";
import { useShellOffsetMotion } from "./AppSidebarShellMotion";
import SidebarUserButton from "./AppSidebarShellUserButton";
import SidebarCollapseIcon from "./SidebarCollapseIcon";
import type {
  AppSidebarShellContentMaxWidth,
  AppSidebarShellContext,
  AppSidebarShellSlot,
} from "./AppSidebarShellTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;
const naturalEase = "cubic-bezier(0.2, 0, 0, 1)";

function renderShellSlot(
  slot: AppSidebarShellSlot | undefined,
  context: AppSidebarShellContext,
): ReactNode {
  return typeof slot === "function" ? slot(context) : slot;
}

function SidebarHeader({
  context,
  onCollapse,
  onToggle,
  t,
}: {
  context: AppSidebarShellContext;
  onCollapse: () => void;
  onToggle: () => void;
  t: Translate;
}) {
  const {
    isOverlaySidebar,
    isSidebarCollapsed,
    desktopSidebarRailWidth,
    expandCollapsedSidebar,
  } = context;
  const isCollapsedDesktop = isSidebarCollapsed && !isOverlaySidebar;

  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ minHeight: 64, pt: 2, pb: 1.5 }}
    >
      {isCollapsedDesktop ? (
        <Box
          sx={{
            width: desktopSidebarRailWidth,
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IconButton
            aria-label={t("appShell.toggleSidebar")}
            onClick={onToggle}
            sx={{ width: 40, height: 40 }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Box>
      ) : (
        <Box
          sx={{ minWidth: 0, flex: 1, pl: isOverlaySidebar ? 2 : 2.5, pr: 1 }}
        >
          <Typography
            noWrap
            sx={{
              fontFamily: "var(--cw-font-family-wordmark)",
              fontSize: "var(--cw-font-size-wordmark-sidebar)",
              lineHeight: 1.1,
              color: "secondary.main",
            }}
          >
            {t("appName")}
          </Typography>
        </Box>
      )}
      <Box
        sx={{
          minWidth: 0,
          flex: isCollapsedDesktop ? 1 : "0 0 auto",
          pr: 2,
          opacity: isCollapsedDesktop ? 0 : 1,
          transform: isCollapsedDesktop ? "translateX(-8px)" : "translateX(0)",
          transition: "opacity 180ms ease, transform 220ms ease",
          pointerEvents: isCollapsedDesktop ? "none" : "auto",
        }}
        onClick={expandCollapsedSidebar}
      >
        {!isSidebarCollapsed ? (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <IconButton
              aria-label={t("appShell.collapseSidebar")}
              onClick={onCollapse}
              sx={{ width: 40, height: 40 }}
            >
              <SidebarCollapseIcon />
            </IconButton>
          </Box>
        ) : null}
      </Box>
    </Stack>
  );
}

function SidebarContent({
  avatarInitials,
  displayName,
  userEmail,
  sidebarBodyContent,
  context,
  onOpenUserMenu,
  t,
}: {
  avatarInitials: string;
  displayName: string;
  userEmail: string;
  sidebarBodyContent?: AppSidebarShellSlot;
  context: AppSidebarShellContext;
  onOpenUserMenu: (event: MouseEvent<HTMLElement>) => void;
  t: Translate;
}) {
  const {
    isOverlaySidebar,
    isSidebarCollapsed,
    desktopSidebarExpandedWidth,
    desktopSidebarWidth,
  } = context;
  const desktopSidebarSurfaceWidth = isOverlaySidebar
    ? desktopSidebarWidth
    : desktopSidebarExpandedWidth;
  const desktopSidebarReveal =
    desktopSidebarSurfaceWidth > 0
      ? (desktopSidebarWidth / desktopSidebarSurfaceWidth) * 100
      : 100;

  return (
    <Stack
      data-testid="app-sidebar-surface"
      sx={{
        height: "100%",
        width: isOverlaySidebar
          ? "min(92vw, 360px)"
          : desktopSidebarSurfaceWidth,
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? "var(--cw-color-surface-warm)"
            : theme.palette.background.paper,
        color: "text.primary",
        borderRight: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        clipPath:
          !isOverlaySidebar && isSidebarCollapsed
            ? `inset(0 ${100 - desktopSidebarReveal}% 0 0)`
            : "inset(0 0 0 0)",
        transition: isOverlaySidebar
          ? undefined
          : `clip-path 240ms ${naturalEase}`,
        willChange: isOverlaySidebar ? undefined : "clip-path",
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
        },
      }}
    >
      <SidebarHeader
        context={context}
        onCollapse={context.collapseSidebar}
        onToggle={context.toggleSidebar}
        t={t}
      />
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {renderShellSlot(sidebarBodyContent, context)}
      </Box>
      <Box sx={{ mt: "auto" }}>
        <Divider />
        <SidebarUserButton
          avatarInitials={avatarInitials}
          displayName={displayName}
          userEmail={userEmail}
          context={context}
          onOpenUserMenu={onOpenUserMenu}
          t={t}
        />
      </Box>
    </Stack>
  );
}

function getContentSurfaceSx({
  contentWidth,
  desktopContentMaxWidth = { default: 1600 },
  isOverlaySidebar,
  isPlainContentSurface,
}: {
  contentWidth?: "bounded" | "fill";
  desktopContentMaxWidth?: AppSidebarShellContentMaxWidth;
  isOverlaySidebar: boolean;
  isPlainContentSurface: boolean;
}) {
  const panelPadding = isPlainContentSurface ? 0 : { xs: 2, md: 3 };
  const panelVerticalPadding = isPlainContentSurface ? 0 : { xs: 1.5, md: 2 };
  const panelBackground = isPlainContentSurface
    ? isOverlaySidebar
      ? "background.paper"
      : "transparent"
    : "background.paper";

  return {
    ...getContentSurfaceWidthSx({
      contentWidth: contentWidth ?? "bounded",
      desktopContentMaxWidth,
      isOverlaySidebar,
    }),
    minHeight: 0,
    overflow: isPlainContentSurface && !isOverlaySidebar ? "visible" : "hidden",
    bgcolor: panelBackground,
    border: isPlainContentSurface ? "none" : "1px solid",
    borderColor: isPlainContentSurface ? "transparent" : "divider",
    borderRadius: isPlainContentSurface
      ? 0
      : { xs: 0, md: "var(--cw-radius-detail)" },
    boxShadow: "none",
    px: panelPadding,
    py: panelVerticalPadding,
    display: "flex",
    flexDirection: "column",
  } as const;
}

function ShellMainContent({
  shellTestId,
  contentSurface,
  contentAlignment,
  contentWidth,
  desktopContentEndGap,
  desktopContentGap,
  desktopContentMaxWidth,
  headerContent,
  children,
  context,
}: {
  shellTestId?: string;
  contentSurface: "panel" | "plain";
  contentAlignment: "center" | "start";
  contentWidth?: "bounded" | "fill";
  desktopContentEndGap?: number;
  desktopContentGap?: number;
  desktopContentMaxWidth?: AppSidebarShellContentMaxWidth;
  headerContent?: AppSidebarShellSlot;
  children?: AppSidebarShellSlot;
  context: AppSidebarShellContext;
}) {
  const { currentApp, isOverlaySidebar } = context;
  const isPlainContentSurface = contentSurface === "plain";
  const contentSurfaceSx = getContentSurfaceSx({
    contentWidth,
    desktopContentMaxWidth,
    isOverlaySidebar,
    isPlainContentSurface,
  });
  const usesFillPlainSurface =
    isPlainContentSurface && !isOverlaySidebar && contentWidth === "fill";
  const contentOverflow =
    isPlainContentSurface && !isOverlaySidebar ? "visible" : "hidden";
  const layout = getShellMainLayout({
    contentAlignment,
    desktopContentEndGap,
    desktopContentGap,
    context,
  });
  const offsetMotion = useShellOffsetMotion({
    isOverlaySidebar,
    offset: layout.paddingLeft,
  });

  return (
    <Stack
      data-testid={
        shellTestId ? `${shellTestId}-motion-frame` : "app-sidebar-motion-frame"
      }
      spacing={0}
      sx={getShellMainStackSx({
        contentOverflow,
        left: layout.paddingLeft,
        transform: offsetMotion.transform,
        transition: offsetMotion.transition,
        usesFillPlainSurface,
      })}
    >
      <Box
        sx={getShellMainFrameSx({
          contentOverflow,
          justifyContent: layout.justifyContent,
          marginRight: layout.marginRight,
          paddingLeft: layout.paddingLeft,
          usesFillPlainSurface,
        })}
      >
        <Box
          data-testid={shellTestId}
          data-current-app={currentApp}
          data-sidebar-mode={layout.sidebarMode}
          data-content-alignment={layout.dataAlignment}
          sx={contentSurfaceSx}
        >
          {renderShellSlot(headerContent, context)}
          {renderShellSlot(children, context)}
        </Box>
      </Box>
    </Stack>
  );
}

export { ShellMainContent, SidebarContent, SidebarFrame, UserMenu };
