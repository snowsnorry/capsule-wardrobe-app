import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
} from "../../components/MobileDialogSurfaceStyles";
import type { OutfitItemSnapshot } from "../../app/appTypes";

export type OutfitConfirmState =
  | { action: ""; entry: null }
  | { action: "remove-item"; entry: OutfitItemSnapshot }
  | { action: "remove-selected"; entry: null }
  | { action: "delete"; entry: null }
  | { action: "revert"; entry: null };

export function OutfitConfirmDialog({
  disabled,
  isOverlay,
  onClose,
  onConfirm,
  state,
  t,
}: {
  disabled: boolean;
  isOverlay: boolean;
  onClose: () => void;
  onConfirm: () => void;
  state: OutfitConfirmState;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  const [title, body, button, color] = getOutfitConfirmCopy(state.action);

  return (
    <Dialog
      open
      onClose={() => !disabled && onClose()}
      fullScreen={isOverlay}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: isOverlay ? { sx: mobileCapsuleDialogPaperSx } : undefined,
      }}
    >
      <DialogTitle sx={isOverlay ? mobileCapsuleDialogTitleSx : { pb: 1 }}>
        {t(title)}
      </DialogTitle>
      <DialogContent
        sx={
          isOverlay
            ? { ...mobileCapsuleDialogContentSx, px: 2, pb: 0 }
            : { pt: 0.5, pb: 0 }
        }
      >
        <DialogContentText sx={{ color: "text.secondary" }}>
          {t(body)}
        </DialogContentText>
      </DialogContent>
      <DialogActions
        sx={
          isOverlay ? mobileCapsuleDialogActionsSx : { px: 3, pb: 2.5, pt: 2 }
        }
      >
        <Button disabled={disabled} onClick={onClose}>
          {t("actions.cancel")}
        </Button>
        <Button
          color={color}
          variant="contained"
          disabled={disabled}
          onClick={onConfirm}
        >
          {t(button)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function getOutfitConfirmCopy(
  action: OutfitConfirmState["action"],
): [string, string, string, "error" | "primary"] {
  if (action === "remove-selected")
    return [
      "outfit.removeSelectedTitle",
      "outfit.confirmRemoveSelected",
      "outfit.removeConfirm",
      "error",
    ];
  if (action === "delete")
    return [
      "outfit.deleteTitle",
      "outfit.deleteConfirmBody",
      "outfit.deleteConfirm",
      "error",
    ];
  if (action === "revert")
    return [
      "outfit.revertTitle",
      "outfit.revertConfirmBody",
      "outfit.revertConfirm",
      "primary",
    ];
  return [
    "outfit.removeItemTitle",
    "outfit.confirmRemoveItem",
    "outfit.removeConfirm",
    "error",
  ];
}
