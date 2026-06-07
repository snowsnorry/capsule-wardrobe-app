import { Button, DialogActions } from "@mui/material";
import { mobileCapsuleDialogActionsSx } from "./MobileDialogSurfaceStyles";
import { pickerDialogActionsSx } from "./ProfileFiltersAnchorStyles";
import type { Translate } from "./ProfileFiltersAnchorTypes";

function AnchorDialogActions({
  disabled,
  fullScreen,
  onApply,
  onClose,
  tempIds,
  t,
}: {
  disabled: boolean;
  fullScreen: boolean;
  onApply: (nextIds: string[]) => void;
  onClose: () => void;
  tempIds: string[];
  t: Translate;
}) {
  return (
    <DialogActions
      sx={fullScreen ? mobileCapsuleDialogActionsSx : pickerDialogActionsSx}
    >
      <Button color="inherit" onClick={onClose} disabled={disabled}>
        {t("actions.cancel")}
      </Button>
      <Button
        variant="contained"
        onClick={() => onApply(tempIds)}
        disabled={disabled}
      >
        {t("capsule.anchors.apply")}
      </Button>
    </DialogActions>
  );
}

export default AnchorDialogActions;
