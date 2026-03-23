import { useState } from "react";
import { Box, ButtonBase, Menu, MenuItem, Stack, Typography } from "@mui/material";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useI18n } from "../i18n/useI18n.js";

function AppLauncher({ currentApp = "capsule", onSelectApp }) {
  const { t } = useI18n();
  const [anchorEl, setAnchorEl] = useState(null);
  const isOpen = Boolean(anchorEl);
  const items = [
    { id: "capsule", label: t("launcher.capsule"), subtitle: t("launcher.capsuleHint") },
    { id: "search", label: t("launcher.search"), subtitle: t("launcher.searchHint") }
  ];

  return (
    <>
      <ButtonBase
        aria-label={t("launcher.open")}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          borderRadius: "999px",
          px: 1.4,
          py: 0.7,
          border: "1px solid rgba(143, 111, 69, 0.2)",
          background:
            "linear-gradient(135deg, rgba(127, 84, 38, 0.14), rgba(240, 180, 41, 0.14) 58%, rgba(255, 244, 220, 0.88))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 8px 18px rgba(127, 84, 38, 0.08)"
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <AppsRoundedIcon sx={{ color: "#7f5426", fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: "#7f5426" }}>
            {items.find((item) => item.id === currentApp)?.label || t("launcher.capsule")}
          </Typography>
        </Stack>
      </ButtonBase>
      <Menu anchorEl={anchorEl} open={isOpen} onClose={() => setAnchorEl(null)}>
        {items.map((item) => (
          <MenuItem
            key={item.id}
            onClick={() => {
              setAnchorEl(null);
              onSelectApp?.(item.id);
            }}
            sx={{ minWidth: 220 }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ width: "100%" }}>
              <Box sx={{ pt: 0.2, color: currentApp === item.id ? "#7f5426" : "transparent" }}>
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
        ))}
      </Menu>
    </>
  );
}

export default AppLauncher;
