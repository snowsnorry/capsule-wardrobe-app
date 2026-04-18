import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  SvgIcon,
  Typography
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { MouseEvent, ReactElement, ReactNode } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import SettingsDialog from "./SettingsDialog";
import type { SettingsProfile, SettingsSavePayload } from "./SettingsDialog";
import { useI18n } from "../i18n/useI18n.js";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "capsule.appSidebarCollapsed";

type AppSidebarShellContext = {
  currentApp: string;
  isOverlaySidebar: boolean;
  isLargeDesktopSidebar: boolean;
  isMediumDesktopSidebar: boolean;
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  desktopSidebarWidth: number;
  desktopSidebarRailWidth: number;
  desktopSidebarGap: number;
  desktopContentInset: number;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  collapseSidebar: () => void;
  expandCollapsedSidebar: () => void;
};

type AppSidebarShellSlot =
  | ReactNode
  | ((context: AppSidebarShellContext) => ReactNode);

type AppSidebarShellProps = {
  shellTestId?: string;
  currentApp?: string;
  userEmail?: string;
  userName?: string;
  settingsProfile?: SettingsProfile | null;
  onSaveSettings?: (settings: SettingsSavePayload) => Promise<void> | void;
  onSignOut?: () => void;
  headerContent?: AppSidebarShellSlot;
  sidebarBodyContent?: AppSidebarShellSlot;
  children?: AppSidebarShellSlot;
};

function readSharedDesktopSidebarCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
}

function writeSharedDesktopSidebarCollapsed(value: boolean): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      value ? "true" : "false"
    );
  }
}

function getUserInitials(fullname: string, email: string): string {
  const trimmedName = String(fullname || "").trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U";
  }

  const normalizedEmail = String(email || "").trim();
  return normalizedEmail ? normalizedEmail[0].toUpperCase() : "U";
}

function renderShellSlot(slot: AppSidebarShellSlot | undefined, context: AppSidebarShellContext): ReactNode {
  return typeof slot === "function" ? slot(context) : slot;
}

function SidebarCollapseIcon(props: SvgIconProps): ReactElement {
  return (
    <SvgIcon {...props} viewBox="-0.5 -0.5 16 16">
      <path
        d="M12.7769375 14.284625H2.2230625c-0.8326875 0 -1.5076875 -0.675 -1.5076875 -1.5076875l0 -10.553875c0 -0.8326875 0.675 -1.5076875 1.5076875 -1.5076875h10.553875c0.8326875 0 1.5076875 0.675 1.5076875 1.5076875v10.553875c0 0.8326875 -0.675 1.5076875 -1.5076875 1.5076875Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <path
        d="M3.9192500000000003 5.9923125 2.6 7.5l1.3192499999999998 1.5076875"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <path
        d="M5.615375 14.284625V0.7153750000000001"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </SvgIcon>
  );
}

function AppSidebarShell({
  shellTestId,
  currentApp = "",
  userEmail = "",
  userName = "",
  settingsProfile = null,
  onSaveSettings = async () => {},
  onSignOut = () => {},
  headerContent,
  sidebarBodyContent,
  children
}: AppSidebarShellProps): ReactElement {
  const { t } = useI18n();
  const isOverlaySidebar = useMediaQuery("(max-width: 1279.95px)");
  const isLargeDesktopSidebar = useMediaQuery("(min-width: 1680px)");
  const isMediumDesktopSidebar = !isOverlaySidebar && !isLargeDesktopSidebar;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => readSharedDesktopSidebarCollapsed());
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const userMenuPaperRef = useRef<HTMLDivElement | null>(null);
  const displayName = String(userName || "").trim();
  const avatarInitials = getUserInitials(displayName, userEmail);
  const desktopSidebarWidth = isSidebarCollapsed ? 72 : 296;
  const desktopSidebarRailWidth = 72;
  const desktopSidebarGap = 12;
  const desktopContentInset = isOverlaySidebar ? 0 : desktopSidebarWidth + desktopSidebarGap;

  useEffect(() => {
    if (isOverlaySidebar) {
      return;
    }

    writeSharedDesktopSidebarCollapsed(isSidebarCollapsed);
  }, [isOverlaySidebar, isSidebarCollapsed]);

  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleSidebar = () => {
    if (isOverlaySidebar) {
      closeSidebar();
      return;
    }
    setIsSidebarCollapsed((value) => {
      const nextValue = !value;
      writeSharedDesktopSidebarCollapsed(nextValue);
      return nextValue;
    });
  };
  const collapseSidebar = () => {
    if (isOverlaySidebar) {
      closeSidebar();
      return;
    }
    writeSharedDesktopSidebarCollapsed(true);
    setIsSidebarCollapsed(true);
  };
  const expandCollapsedSidebar = () => {
    if (!isOverlaySidebar && isSidebarCollapsed) {
      writeSharedDesktopSidebarCollapsed(false);
      setIsSidebarCollapsed(false);
    }
  };
  const handleCloseUserMenu = () => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      userMenuPaperRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
    setUserMenuAnchor(null);
  };

  const shellContext = {
    currentApp,
    isOverlaySidebar,
    isLargeDesktopSidebar,
    isMediumDesktopSidebar,
    isSidebarOpen,
    isSidebarCollapsed,
    desktopSidebarWidth,
    desktopSidebarRailWidth,
    desktopSidebarGap,
    desktopContentInset,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    collapseSidebar,
    expandCollapsedSidebar
  };

  const sidebarContent = (
    <Stack
      sx={{
        height: "100%",
        width: isOverlaySidebar ? "min(92vw, 360px)" : desktopSidebarWidth,
        bgcolor: (theme) => theme.palette.mode === "dark" ? "#1e1f20" : theme.palette.background.paper,
        color: "text.primary",
        borderRight: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        transition: isOverlaySidebar ? undefined : "width 240ms ease, box-shadow 240ms ease"
      }}
    >
      <Stack direction="row" alignItems="center" sx={{ minHeight: 64, pt: 2, pb: 1.5 }}>
        <Box sx={{ width: desktopSidebarRailWidth, display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <IconButton aria-label="Toggle sidebar" onClick={toggleSidebar} sx={{ width: 40, height: 40 }}>
            <MenuRoundedIcon />
          </IconButton>
        </Box>
        <Box
          sx={{
            minWidth: 0,
            flex: 1,
            pr: 2,
            opacity: isSidebarCollapsed && !isOverlaySidebar ? 0 : 1,
            transform: isSidebarCollapsed && !isOverlaySidebar ? "translateX(-8px)" : "translateX(0)",
            transition: "opacity 180ms ease, transform 220ms ease",
            pointerEvents: isSidebarCollapsed && !isOverlaySidebar ? "none" : "auto"
          }}
          onClick={expandCollapsedSidebar}
        >
          {!isSidebarCollapsed ? (
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <IconButton aria-label="Collapse sidebar" onClick={collapseSidebar} sx={{ width: 40, height: 40 }}>
                <SidebarCollapseIcon />
              </IconButton>
            </Box>
          ) : null}
        </Box>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {renderShellSlot(sidebarBodyContent, shellContext)}
      </Box>

      <Box sx={{ mt: "auto" }}>
        <Divider />
        <Button
          aria-label="Open user menu"
          onClick={(event: MouseEvent<HTMLElement>) => setUserMenuAnchor(event.currentTarget)}
          sx={{
            width: "100%",
            justifyContent: "flex-start",
            px: 0,
            py: 2,
            borderRadius: 0
          }}
        >
          <Box sx={{ width: desktopSidebarRailWidth, display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#9aa4a6" }}>
              {avatarInitials}
            </Avatar>
          </Box>
          {!isSidebarCollapsed || isOverlaySidebar ? (
            <Stack justifyContent="center" alignItems="flex-start" sx={{ minHeight: 36, minWidth: 0, textAlign: "left" }}>
              <Typography
                color="text.primary"
                noWrap
                sx={{
                  width: "100%",
                  opacity: isSidebarCollapsed && !isOverlaySidebar ? 0 : 1,
                  transform: isSidebarCollapsed && !isOverlaySidebar ? "translateX(-8px)" : "translateX(0)",
                  transition: "opacity 180ms ease, transform 220ms ease"
                }}
              >
                {displayName || userEmail || ""}
              </Typography>
              {displayName ? (
                <Typography variant="body2" color="text.secondary" noWrap sx={{ width: "100%" }}>
                  {userEmail || ""}
                </Typography>
              ) : null}
            </Stack>
          ) : null}
        </Button>
      </Box>
    </Stack>
  );

  return (
    <>
      {isOverlaySidebar ? (
        <Drawer open={isSidebarOpen} onClose={closeSidebar}>
          {sidebarContent}
        </Drawer>
      ) : (
        <Box sx={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 1200 }}>
          {sidebarContent}
        </Box>
      )}

      <Stack spacing={0} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
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
            transition: isOverlaySidebar ? undefined : "padding-left 240ms ease"
          }}
        >
          <Box
            data-testid={shellTestId}
            data-current-app={currentApp}
            data-sidebar-mode={
              isOverlaySidebar ? "overlay" : (isLargeDesktopSidebar ? "desktop-large" : "desktop-medium")
            }
            data-content-alignment={isOverlaySidebar ? "overlay" : "centered"}
            sx={{
              width: isOverlaySidebar ? "100%" : "min(100%, 1600px)",
              maxWidth: isOverlaySidebar ? undefined : "1600px",
              minHeight: 0,
              overflow: "hidden",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: { xs: 0, md: "22px" },
              boxShadow: "none",
              px: { xs: 2, md: 3 },
              py: { xs: 1.5, md: 2 },
              display: "flex",
              flexDirection: "column"
            }}
          >
            {renderShellSlot(headerContent, shellContext)}
            {renderShellSlot(children, shellContext)}
          </Box>
        </Box>
      </Stack>

      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleCloseUserMenu}
        disableRestoreFocus
        anchorOrigin={{ vertical: "center", horizontal: "right" }}
        transformOrigin={{ vertical: "center", horizontal: "left" }}
        slotProps={{ paper: { ref: userMenuPaperRef, sx: { ml: 1 } } }}
      >
        <MenuItem onClick={() => { handleCloseUserMenu(); setIsSettingsOpen(true); }}>
          <ListItemIcon><SettingsRoundedIcon fontSize="small" /></ListItemIcon>
          {t("settings.title")}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { handleCloseUserMenu(); onSignOut(); }}>
          <ListItemIcon><LogoutRoundedIcon fontSize="small" /></ListItemIcon>
          {t("actions.signOut")}
        </MenuItem>
      </Menu>

      <SettingsDialog
        open={isSettingsOpen}
        settings={{
          ...(settingsProfile ?? {}),
          email: userEmail
        }}
        onClose={() => setIsSettingsOpen(false)}
        onSave={onSaveSettings}
      />
    </>
  );
}

export type { AppSidebarShellContext, AppSidebarShellProps };
export default AppSidebarShell;
