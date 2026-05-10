import type { MouseEvent } from "react";
import { Avatar, Box, Button, Stack, Typography } from "@mui/material";
import type { AppSidebarShellContext } from "./AppSidebarShellTypes";

const sidebarAvatarSx = {
  width: 36,
  height: 36,
  bgcolor: "var(--cw-color-user-avatar-bg)",
  color: "var(--cw-color-user-avatar-ink)",
  fontWeight: 650,
} as const;

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

export default SidebarUserButton;
