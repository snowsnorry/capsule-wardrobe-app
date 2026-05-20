import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  LinearProgress,
} from "@mui/material";
import { mobileCapsuleDialogActionsSx } from "./MobileDialogSurfaceStyles";
import type { PasskeyMetadata } from "./settingsDialogModel";

type Translate = (key: string, params?: unknown) => string;

function PasskeyDeleteDialog({
  passkeyToDelete,
  isPasskeyLoading,
  onClose,
  onConfirm,
  t,
}: {
  passkeyToDelete: PasskeyMetadata | null;
  isPasskeyLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  t: Translate;
}) {
  return (
    <Dialog open={Boolean(passkeyToDelete)} onClose={onClose}>
      <DialogTitle>{t("passkeys.remove")}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t("passkeys.removeConfirm")}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button disabled={isPasskeyLoading} onClick={onClose}>
          {t("actions.cancel")}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={isPasskeyLoading}
          onClick={onConfirm}
        >
          {t("passkeys.remove")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SettingsDialogProgress({
  isMobile,
  isSaving,
}: {
  isMobile?: boolean;
  isSaving: boolean;
}) {
  if (isMobile && !isSaving) {
    return null;
  }

  const progressSx = isMobile
    ? {
        height: 3,
        backgroundColor: "action.hover",
        "& .MuiLinearProgress-bar": { borderRadius: "var(--cw-radius-pill)" },
      }
    : {
        mt: "-2px",
        height: 3,
        borderRadius: "var(--cw-radius-pill)",
        backgroundColor: "action.hover",
        "& .MuiLinearProgress-bar": { borderRadius: "var(--cw-radius-pill)" },
      };

  return (
    <Box sx={isMobile ? { flexShrink: 0 } : { px: 3, pb: 0.5 }}>
      {isMobile ? null : <Divider sx={{ borderColor: "divider" }} />}
      {isSaving ? <LinearProgress color="success" sx={progressSx} /> : null}
    </Box>
  );
}

function SettingsDialogActions({
  hasChanges,
  isSaving,
  isMobile,
  onClose,
  onSave,
  t,
}: {
  hasChanges: boolean;
  isSaving: boolean;
  isMobile?: boolean;
  onClose: () => void;
  onSave: () => void;
  t: Translate;
}) {
  return (
    <DialogActions
      sx={
        isMobile
          ? mobileCapsuleDialogActionsSx
          : { justifyContent: "flex-end", px: 3, pb: 2.5, pt: 2 }
      }
    >
      <Button onClick={onClose} disabled={isSaving}>
        {t("actions.cancel")}
      </Button>
      <Button
        variant="contained"
        onClick={onSave}
        disabled={isSaving || !hasChanges}
      >
        {t("actions.save")}
      </Button>
    </DialogActions>
  );
}

export { PasskeyDeleteDialog, SettingsDialogActions, SettingsDialogProgress };
