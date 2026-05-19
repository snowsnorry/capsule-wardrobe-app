import { useEffect, useState } from "react";
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
const USER_MENU_HORIZONTAL_INSET = 16;
const USER_MENU_VERTICAL_OFFSET_PX = 6;

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
  const anchorWidth = anchorEl?.getBoundingClientRect().width ?? 0;
  const measuredMenuWidth =
    anchorWidth > USER_MENU_HORIZONTAL_INSET * 2
      ? anchorWidth - USER_MENU_HORIZONTAL_INSET * 2
      : undefined;
  const [lastMenuWidth, setLastMenuWidth] = useState<number | undefined>(
    undefined,
  );
  const menuWidth = measuredMenuWidth ?? lastMenuWidth;

  useEffect(() => {
    if (measuredMenuWidth !== undefined) {
      setLastMenuWidth(measuredMenuWidth);
    }
  }, [measuredMenuWidth]);

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      disableRestoreFocus
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      slotProps={{
        paper: {
          ref: paperRef,
          sx: {
            mt: `-${USER_MENU_VERTICAL_OFFSET_PX}px`,
            width: menuWidth,
          },
        },
      }}
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
