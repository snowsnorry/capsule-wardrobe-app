import type { ReactNode } from "react";
import type { SettingsProfile, SettingsSavePayload } from "./SettingsDialog";

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
  contentSurface?: "panel" | "plain";
  userEmail?: string;
  userName?: string;
  settingsProfile?: SettingsProfile | null;
  onSaveSettings?: (settings: SettingsSavePayload) => Promise<void> | void;
  onSignOut?: () => void;
  headerContent?: AppSidebarShellSlot;
  sidebarBodyContent?: AppSidebarShellSlot;
  children?: AppSidebarShellSlot;
};

export type { AppSidebarShellContext, AppSidebarShellProps, AppSidebarShellSlot };
