import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";

type Translate = (key: string, params?: unknown) => string;

function SettingsRemoveAccountDialog({
  confirmation,
  confirmationWord,
  isRemoving,
  onClose,
  onConfirm,
  onConfirmationChange,
  t,
}: {
  confirmation: string;
  confirmationWord: string;
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onConfirmationChange: (value: string) => void;
  t: Translate;
}) {
  const canRemove = confirmation.trim() === confirmationWord;

  return (
    <Dialog
      open
      onClose={isRemoving ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>{t("settings.removeAccount.dialogTitle")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>
            {t("settings.removeAccount.warning")}
          </DialogContentText>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {t("settings.removeAccount.instructionPrefix")}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Typography component="code" sx={confirmationWordSx}>
                {confirmationWord}
              </Typography>
              <Tooltip title={t("settings.removeAccount.copyWord")}>
                <IconButton
                  aria-label={t("settings.removeAccount.copyWord")}
                  size="small"
                  onClick={() => {
                    void navigator.clipboard?.writeText(confirmationWord);
                  }}
                >
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t("settings.removeAccount.instructionSuffix")}
            </Typography>
          </Stack>
          <TextField
            autoFocus
            label={t("settings.removeAccount.inputLabel")}
            value={confirmation}
            onChange={(event) => onConfirmationChange(event.target.value)}
            disabled={isRemoving}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={isRemoving} onClick={onClose}>
          {t("actions.cancel")}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={isRemoving || !canRemove}
          onClick={onConfirm}
        >
          {t("settings.removeAccount.remove")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const confirmationWordSx = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 32,
  px: 1.25,
  borderRadius: "var(--cw-radius-sm)",
  bgcolor: "action.hover",
  color: "text.primary",
  fontFamily: "var(--cw-font-family-confirmation-code)",
  fontSize: "0.875rem",
} as const;

export { SettingsRemoveAccountDialog };
