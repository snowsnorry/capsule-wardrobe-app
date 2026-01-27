import { LinearProgress, Stack, Typography } from "@mui/material";
import { useI18n } from "../i18n/useI18n.js";

function LoadingScreen() {
  const { t } = useI18n();
  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t("auth.checkingSession")}</Typography>
      <LinearProgress />
    </Stack>
  );
}

export default LoadingScreen;
