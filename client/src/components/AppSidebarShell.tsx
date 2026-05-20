import { lazy, Suspense, useEffect, useRef, useState } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { MouseEvent, ReactElement } from "react";
import { useI18n } from "../i18n/useI18n";
import {
  ShellMainContent,
  SidebarContent,
  SidebarFrame,
  UserMenu,
} from "./AppSidebarShellContent";
import type {
  AppSidebarShellContext,
  AppSidebarShellProps,
} from "./AppSidebarShellTypes";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "capsule.appSidebarCollapsed";
const SettingsDialog = lazy(() => import("./SettingsDialog"));

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
      value ? "true" : "false",
    );
  }
}

function getUserInitials(fullname: string, email: string): string {
  const trimmedName = String(fullname || "").trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    return (
      parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "U"
    );
  }

  const normalizedEmail = String(email || "").trim();
  return normalizedEmail ? normalizedEmail[0].toUpperCase() : "U";
}

function useAppSidebarShellContext(currentApp: string): AppSidebarShellContext {
  const isOverlaySidebar = useMediaQuery("(max-width: 1279.95px)");
  const isLargeDesktopSidebar = useMediaQuery("(min-width: 1680px)");
  const isMediumDesktopSidebar = !isOverlaySidebar && !isLargeDesktopSidebar;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    readSharedDesktopSidebarCollapsed(),
  );
  const desktopSidebarExpandedWidth = 296;
  const desktopSidebarRailWidth = 72;
  const desktopSidebarWidth = isSidebarCollapsed
    ? desktopSidebarRailWidth
    : desktopSidebarExpandedWidth;
  const desktopSidebarGap = 12;
  const desktopContentInset = isOverlaySidebar
    ? 0
    : desktopSidebarWidth + desktopSidebarGap;

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

  return {
    currentApp,
    isOverlaySidebar,
    isLargeDesktopSidebar,
    isMediumDesktopSidebar,
    isSidebarOpen,
    isSidebarCollapsed,
    desktopSidebarWidth,
    desktopSidebarExpandedWidth,
    desktopSidebarRailWidth,
    desktopSidebarGap,
    desktopContentInset,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    collapseSidebar,
    expandCollapsedSidebar,
  };
}

function AppSidebarSettingsDialog({
  isOpen,
  settingsProfile,
  userEmail,
  onClose,
  onRemoveAccount,
  onSaveSettings,
}: Pick<
  AppSidebarShellProps,
  "settingsProfile" | "userEmail" | "onRemoveAccount" | "onSaveSettings"
> & {
  isOpen: boolean;
  onClose: () => void;
}): ReactElement | null {
  if (!isOpen) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <SettingsDialog
        open={isOpen}
        settings={{
          ...(settingsProfile ?? {}),
          email: userEmail,
        }}
        onClose={onClose}
        onRemoveAccount={onRemoveAccount}
        onSave={onSaveSettings}
      />
    </Suspense>
  );
}

function AppSidebarShell({
  shellTestId,
  currentApp = "",
  contentSurface = "panel",
  contentAlignment = "center",
  desktopContentGap,
  desktopContentEndGap,
  desktopContentMaxWidth,
  contentWidth,
  userEmail = "",
  userName = "",
  settingsProfile = null,
  onRemoveAccount = async () => {},
  onSaveSettings = async () => {},
  onSignOut = () => {},
  headerContent,
  sidebarBodyContent,
  children,
}: AppSidebarShellProps): ReactElement {
  const { t } = useI18n();
  const shellContext = useAppSidebarShellContext(currentApp);
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const userMenuPaperRef = useRef<HTMLDivElement | null>(null);
  const displayName = String(userName || "").trim();
  const avatarInitials = getUserInitials(displayName, userEmail);
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

  const sidebarContent = (
    <SidebarContent
      avatarInitials={avatarInitials}
      displayName={displayName}
      userEmail={userEmail}
      sidebarBodyContent={sidebarBodyContent}
      context={shellContext}
      onOpenUserMenu={(event: MouseEvent<HTMLElement>) =>
        setUserMenuAnchor(event.currentTarget)
      }
      t={t}
    />
  );

  return (
    <>
      <SidebarFrame sidebarContent={sidebarContent} context={shellContext} />
      <ShellMainContent
        shellTestId={shellTestId}
        contentSurface={contentSurface}
        contentAlignment={contentAlignment}
        desktopContentGap={desktopContentGap}
        desktopContentEndGap={desktopContentEndGap}
        desktopContentMaxWidth={desktopContentMaxWidth}
        contentWidth={contentWidth}
        headerContent={headerContent}
        children={children}
        context={shellContext}
      />
      <UserMenu
        anchorEl={userMenuAnchor}
        paperRef={userMenuPaperRef}
        onClose={handleCloseUserMenu}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSignOut={onSignOut}
        t={t}
      />
      <AppSidebarSettingsDialog
        isOpen={isSettingsOpen}
        settingsProfile={settingsProfile}
        userEmail={userEmail}
        onClose={() => setIsSettingsOpen(false)}
        onRemoveAccount={onRemoveAccount}
        onSaveSettings={onSaveSettings}
      />
    </>
  );
}
export default AppSidebarShell;
