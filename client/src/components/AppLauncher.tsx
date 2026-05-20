import { useState, type MouseEvent } from "react";
import {
  Box,
  ButtonBase,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useI18n } from "../i18n/useI18n";

type AppId = "capsule" | "explore" | "myWardrobe" | "statistics";

type AppLauncherProps = {
  currentApp?: AppId;
  onSelectApp?: (appId: AppId) => void;
};

type LauncherItem = { id: AppId; label: string; subtitle: string };

function buildLauncherItems(t: (key: string) => string): LauncherItem[] {
  return [
    {
      id: "myWardrobe",
      label: t("launcher.myWardrobe"),
      subtitle: t("launcher.myWardrobeHint"),
    },
    {
      id: "capsule",
      label: t("launcher.capsule"),
      subtitle: t("launcher.capsuleHint"),
    },
    {
      id: "explore",
      label: t("launcher.explore"),
      subtitle: t("launcher.exploreHint"),
    },
    {
      id: "statistics",
      label: t("launcher.statistics"),
      subtitle: t("launcher.statisticsHint"),
    },
  ];
}

function AppLauncher({
  currentApp = "capsule",
  onSelectApp,
}: AppLauncherProps) {
  const { t } = useI18n();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isOpen = Boolean(anchorEl);
  const items = buildLauncherItems(t);

  return (
    <>
      <ButtonBase
        aria-label={t("launcher.open")}
        onClick={(event: MouseEvent<HTMLElement>) =>
          setAnchorEl(event.currentTarget)
        }
        sx={{
          borderRadius: "var(--cw-radius-pill)",
          px: 1.4,
          py: 0.7,
          border: "1px solid var(--cw-color-launcher-border)",
          background: "var(--cw-gradient-launcher)",
          boxShadow: "var(--cw-shadow-launcher)",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <AppsRoundedIcon
            sx={{ color: "var(--cw-color-launcher-icon)", fontSize: 18 }}
          />
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: "var(--cw-color-launcher-ink)" }}
          >
            {items.find((item) => item.id === currentApp)?.label ||
              t("launcher.capsule")}
          </Typography>
        </Stack>
      </ButtonBase>
      <Menu anchorEl={anchorEl} open={isOpen} onClose={() => setAnchorEl(null)}>
        {items.map((item) => (
          <AppLauncherMenuItem
            key={item.id}
            item={item}
            isSelected={currentApp === item.id}
            onSelectApp={onSelectApp}
            onClose={() => setAnchorEl(null)}
          />
        ))}
      </Menu>
    </>
  );
}

function AppLauncherMenuItem({
  item,
  isSelected,
  onClose,
  onSelectApp,
}: {
  item: LauncherItem;
  isSelected: boolean;
  onClose: () => void;
  onSelectApp?: (appId: AppId) => void;
}) {
  return (
    <MenuItem
      onClick={() => {
        onClose();
        onSelectApp?.(item.id);
      }}
      sx={{ minWidth: 220 }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="flex-start"
        sx={{ width: "100%" }}
      >
        <Box
          sx={{ pt: 0.2, color: isSelected ? "primary.main" : "transparent" }}
        >
          <CheckRoundedIcon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {item.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {item.subtitle}
          </Typography>
        </Box>
      </Stack>
    </MenuItem>
  );
}

export default AppLauncher;
