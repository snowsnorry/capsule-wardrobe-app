import { Button, Stack, Typography } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

type Translate = (key: string, params?: unknown) => string;

function SettingsRemoveAccountSection({
  isDisabled,
  onRequestRemoveAccount,
  t,
}: {
  isDisabled: boolean;
  onRequestRemoveAccount: () => void;
  t: Translate;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1" color="error" sx={{ fontWeight: 700 }}>
        {t("settings.removeAccount.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t("settings.removeAccount.description")}
      </Typography>
      <Button
        type="button"
        color="error"
        variant="outlined"
        startIcon={<DeleteOutlineRoundedIcon />}
        onClick={onRequestRemoveAccount}
        disabled={isDisabled}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("settings.removeAccount.button")}
      </Button>
    </Stack>
  );
}

export { SettingsRemoveAccountSection };
