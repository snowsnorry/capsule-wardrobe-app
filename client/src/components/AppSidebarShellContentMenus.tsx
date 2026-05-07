import type { ReactNode, RefObject } from "react";
import {
  Box,
  Divider,
  Drawer,
  ListItemIcon,
  Menu,
  MenuItem,
} from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import type { AppSidebarShellContext } from "./AppSidebarShellTypes";

type Translate = (key: string) => string;

function SidebarFrame({
  sidebarContent,
  context,
}: {
  sidebarContent: ReactNode;
  context: AppSidebarShellContext;
}) {
  if (context.isOverlaySidebar) {
    return (
      <Drawer open={context.isSidebarOpen} onClose={context.closeSidebar}>
        {sidebarContent}
      </Drawer>
    );
  }

  return (
    <Box sx={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 1200 }}>
      {sidebarContent}
    </Box>
  );
}

function UserMenu({
  anchorEl,
  paperRef,
  onClose,
  onOpenSettings,
  onSignOut,
  t,
}: {
  anchorEl: HTMLElement | null;
  paperRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  t: Translate;
}) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      disableRestoreFocus
      anchorOrigin={{ vertical: "center", horizontal: "right" }}
      transformOrigin={{ vertical: "center", horizontal: "left" }}
      slotProps={{ paper: { ref: paperRef, sx: { ml: 1 } } }}
    >
      <MenuItem
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
      >
        <ListItemIcon>
          <SettingsRoundedIcon fontSize="small" />
        </ListItemIcon>
        {t("settings.title")}
      </MenuItem>
      <Divider />
      <MenuItem
        onClick={() => {
          onClose();
          onSignOut();
        }}
      >
        <ListItemIcon>
          <LogoutRoundedIcon fontSize="small" />
        </ListItemIcon>
        {t("actions.signOut")}
      </MenuItem>
    </Menu>
  );
}

export { SidebarFrame, UserMenu };
