import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from "@mui/material";
import type { ShareMetadata, StatusState } from "./appTypes";

type AppDialogsProps = {
  isShareDialogOpen: boolean;
  isShareLoading: boolean;
  shareMetadata: ShareMetadata | null;
  isSignOutConfirmOpen: boolean;
  status: StatusState;
  t: (key: string, params?: Record<string, unknown>) => string;
  onClearShareRoute: () => void;
  onImportSharedCapsule: () => void;
  onCloseSignOutConfirm: () => void;
  onLogout: () => void;
};

export default function AppDialogs({
  isShareDialogOpen,
  isShareLoading,
  shareMetadata,
  isSignOutConfirmOpen,
  status,
  t,
  onClearShareRoute,
  onImportSharedCapsule,
  onCloseSignOutConfirm,
  onLogout
}: AppDialogsProps) {
  return (
    <>
      <Dialog
        open={isShareDialogOpen}
        onClose={() => {
          if (!isShareLoading) {
            onClearShareRoute();
          }
        }}
        aria-labelledby="share-import-dialog-title"
      >
        <DialogTitle id="share-import-dialog-title">
          {t("capsule.shareImportTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("capsule.shareImportBody", { name: shareMetadata?.name || "" })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={isShareLoading} onClick={onClearShareRoute}>
            {t("actions.cancel")}
          </Button>
          <Button variant="contained" disabled={isShareLoading} onClick={onImportSharedCapsule}>
            {t("capsule.shareImportConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={isSignOutConfirmOpen}
        onClose={() => {
          if (!status.loading) {
            onCloseSignOutConfirm();
          }
        }}
        aria-labelledby="sign-out-dialog-title"
        aria-describedby="sign-out-dialog-description"
      >
        <DialogTitle id="sign-out-dialog-title" sx={{ pb: 1 }}>
          {t("dialogs.signOutTitle")}
        </DialogTitle>
        <DialogContent sx={{ pt: 0.5, pb: 0 }}>
          <DialogContentText id="sign-out-dialog-description" sx={{ color: "text.secondary" }}>
            {t("dialogs.signOutBody")}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
          <Button disabled={status.loading} onClick={onCloseSignOutConfirm}>
            {t("dialogs.signOutCancel")}
          </Button>
          <Button color="error" variant="contained" disabled={status.loading} onClick={onLogout}>
            {t("dialogs.signOutConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
