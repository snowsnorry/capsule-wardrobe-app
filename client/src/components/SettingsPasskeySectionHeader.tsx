import { Button, Stack, Typography } from "@mui/material";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";

type Translate = (key: string, params?: unknown) => string;

function SettingsPasskeySectionHeader({
  isPasskeyLoading,
  onAddPasskey,
  t,
}: {
  isPasskeyLoading: boolean;
  onAddPasskey: () => void;
  t: Translate;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
    >
      <Typography variant="subtitle1" fontWeight={700}>
        {t("passkeys.title")}
      </Typography>
      <Button
        type="button"
        variant="outlined"
        size="small"
        startIcon={<KeyRoundedIcon />}
        onClick={onAddPasskey}
        disabled={isPasskeyLoading}
      >
        {t("passkeys.add")}
      </Button>
    </Stack>
  );
}

export { SettingsPasskeySectionHeader };
