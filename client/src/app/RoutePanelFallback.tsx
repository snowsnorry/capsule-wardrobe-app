import { Box, LinearProgress } from "@mui/material";
import { useI18n } from "../i18n/useI18n";

export default function RoutePanelFallback() {
  const { t } = useI18n();

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        px: { xs: 3, md: 4 },
      }}
    >
      <LinearProgress
        aria-label={t("appShell.loadingSection")}
        sx={{ width: "100%" }}
      />
    </Box>
  );
}
