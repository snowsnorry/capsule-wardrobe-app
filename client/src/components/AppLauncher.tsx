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
import { useTheme } from "@mui/material/styles";
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
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isOpen = Boolean(anchorEl);
  const isDarkMode = theme.palette.mode === "dark";
  const items = buildLauncherItems(t);

  return (
    <>
      <ButtonBase
        aria-label={t("launcher.open")}
        onClick={(event: MouseEvent<HTMLElement>) =>
          setAnchorEl(event.currentTarget)
        }
        sx={{
          borderRadius: "999px",
          px: 1.4,
          py: 0.7,
          border: isDarkMode
            ? "1px solid rgba(240, 180, 41, 0.28)"
            : "1px solid rgba(143, 111, 69, 0.2)",
          background: isDarkMode
            ? "linear-gradient(135deg, rgba(240, 180, 41, 0.16), rgba(127, 84, 38, 0.22) 52%, rgba(28, 40, 38, 0.96))"
            : "linear-gradient(135deg, rgba(127, 84, 38, 0.14), rgba(240, 180, 41, 0.14) 58%, rgba(255, 244, 220, 0.88))",
          boxShadow: isDarkMode
            ? "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 20px rgba(0, 0, 0, 0.28)"
            : "inset 0 1px 0 rgba(255,255,255,0.7), 0 8px 18px rgba(127, 84, 38, 0.08)",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <AppsRoundedIcon
            sx={{ color: isDarkMode ? "#f0d39a" : "#7f5426", fontSize: 18 }}
          />
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: isDarkMode ? "#f7ead0" : "#7f5426" }}
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
