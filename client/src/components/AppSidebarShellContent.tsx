import type { MouseEvent, ReactNode } from "react";
import {
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { SidebarFrame, UserMenu } from "./AppSidebarShellContentMenus";
import SidebarCollapseIcon from "./SidebarCollapseIcon";
import type {
  AppSidebarShellContext,
  AppSidebarShellSlot,
} from "./AppSidebarShellTypes";

type Translate = (key: string) => string;

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
            aria-label="Toggle sidebar"
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
              fontFamily: '"Leckerli One", cursive',
              fontSize: { xs: "1.40rem", md: "1.40rem" },
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
              aria-label="Collapse sidebar"
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

function SidebarUserButton({
  avatarInitials,
  displayName,
  userEmail,
  context,
  onOpenUserMenu,
}: {
  avatarInitials: string;
  displayName: string;
  userEmail: string;
  context: AppSidebarShellContext;
  onOpenUserMenu: (event: MouseEvent<HTMLElement>) => void;
}) {
  const { isOverlaySidebar, isSidebarCollapsed, desktopSidebarRailWidth } =
    context;

  return (
    <Button
      aria-label="Open user menu"
      onClick={onOpenUserMenu}
      sx={{
        width: "100%",
        justifyContent: "flex-start",
        px: 0,
        py: 2,
        borderRadius: 0,
      }}
    >
      <Box
        sx={{
          width: desktopSidebarRailWidth,
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Avatar sx={sidebarAvatarSx}>{avatarInitials}</Avatar>
      </Box>
      {!isSidebarCollapsed || isOverlaySidebar ? (
        <Stack
          justifyContent="center"
          alignItems="flex-start"
          sx={{ minHeight: 36, minWidth: 0, textAlign: "left" }}
        >
          <Typography
            color="text.primary"
            noWrap
            sx={{
              width: "100%",
              opacity: isSidebarCollapsed && !isOverlaySidebar ? 0 : 1,
              transform:
                isSidebarCollapsed && !isOverlaySidebar
                  ? "translateX(-8px)"
                  : "translateX(0)",
              transition: "opacity 180ms ease, transform 220ms ease",
            }}
          >
            {displayName || userEmail || ""}
          </Typography>
          {displayName ? (
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ width: "100%" }}
            >
              {userEmail || ""}
            </Typography>
          ) : null}
        </Stack>
      ) : null}
    </Button>
  );
}

const sidebarAvatarSx = {
  width: 36,
  height: 36,
  bgcolor: "var(--cw-color-user-avatar-bg)",
  color: "var(--cw-color-user-avatar-ink)",
  fontWeight: 650,
} as const;

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
  const { isOverlaySidebar, desktopSidebarWidth } = context;

  return (
    <Stack
      sx={{
        height: "100%",
        width: isOverlaySidebar ? "min(92vw, 360px)" : desktopSidebarWidth,
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? "var(--cw-color-surface-warm)"
            : theme.palette.background.paper,
        color: "text.primary",
        borderRight: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        transition: isOverlaySidebar
          ? undefined
          : "width 240ms ease, box-shadow 240ms ease",
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
        />
      </Box>
    </Stack>
  );
}

function getContentSurfaceSx({
  isOverlaySidebar,
  isPlainContentSurface,
}: {
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
    width: isOverlaySidebar ? "100%" : "min(100%, 1600px)",
    maxWidth: isOverlaySidebar ? undefined : "1600px",
    minHeight: 0,
    overflow: "hidden",
    bgcolor: panelBackground,
    border: isPlainContentSurface ? "none" : "1px solid",
    borderColor: isPlainContentSurface ? "transparent" : "divider",
    borderRadius: isPlainContentSurface ? 0 : { xs: 0, md: "22px" },
    boxShadow: "none",
    px: panelPadding,
    py: panelVerticalPadding,
    display: "flex",
    flexDirection: "column",
  } as const;
}

function getSidebarMode({
  isOverlaySidebar,
  isLargeDesktopSidebar,
}: {
  isOverlaySidebar: boolean;
  isLargeDesktopSidebar: boolean;
}) {
  if (isOverlaySidebar) {
    return "overlay";
  }

  return isLargeDesktopSidebar ? "desktop-large" : "desktop-medium";
}

function ShellMainContent({
  shellTestId,
  contentSurface,
  headerContent,
  children,
  context,
}: {
  shellTestId?: string;
  contentSurface: "panel" | "plain";
  headerContent?: AppSidebarShellSlot;
  children?: AppSidebarShellSlot;
  context: AppSidebarShellContext;
}) {
  const {
    currentApp,
    isOverlaySidebar,
    isLargeDesktopSidebar,
    desktopContentInset,
    desktopSidebarGap,
  } = context;
  const isPlainContentSurface = contentSurface === "plain";
  const contentSurfaceSx = getContentSurfaceSx({
    isOverlaySidebar,
    isPlainContentSurface,
  });

  return (
    <Stack
      spacing={0}
      sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          pl: isOverlaySidebar ? 0 : `${desktopContentInset}px`,
          mr: isOverlaySidebar ? 0 : `${desktopSidebarGap}px`,
          my: { xs: 0, md: 0.5 },
          display: "flex",
          justifyContent: isOverlaySidebar ? "stretch" : "center",
          transition: isOverlaySidebar ? undefined : "padding-left 240ms ease",
        }}
      >
        <Box
          data-testid={shellTestId}
          data-current-app={currentApp}
          data-sidebar-mode={getSidebarMode({
            isOverlaySidebar,
            isLargeDesktopSidebar,
          })}
          data-content-alignment={isOverlaySidebar ? "overlay" : "centered"}
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
