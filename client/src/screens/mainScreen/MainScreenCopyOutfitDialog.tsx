import { useRef, useState } from "react";
import type { RefObject } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";
import {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
} from "../../components/MobileDialogSurfaceStyles";
import { useI18n } from "../../i18n/useI18n";
import type {
  CopyOutfitDialogState,
  DialogsProps,
} from "./MainScreenDialogsTypes";
import type { MainScreenProps, ResolvedOutfitSet } from "./MainScreenTypes";
import { useFocusNameDialogInput } from "./MainScreenActionDialogs";

type CopyOutfitDialogProps = {
  activeName: string;
  activeSet: ResolvedOutfitSet | null;
  state: CopyOutfitDialogState;
  disabled: boolean;
  isOverlay: boolean;
  props: MainScreenProps;
  setState: DialogsProps["setCopyOutfitDialog"];
  onSuccess: DialogsProps["onCopyOutfitSuccess"];
};

export function CopyOutfitDialog({
  activeName,
  activeSet,
  state,
  disabled,
  isOverlay,
  props,
  setState,
  onSuccess,
}: CopyOutfitDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  useFocusNameDialogInput(state.open ? "copy-outfit" : "", nameInputRef);
  const isDisabled = disabled || submitting;
  const close = () => {
    setSubmitting(false);
    setState({ open: false, value: "" });
  };
  const submit = async () => {
    const name = state.value.trim();
    if (!activeSet || !name || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const outfit = await props.onCopyOutfitSetToOutfits?.(
        name,
        activeSet.items,
        {
          capsuleId: props.activeCapsule?.id,
          setIndex: activeSet.index,
        },
      );
      if (!outfit?.id) {
        return;
      }
      close();
      onSuccess(outfit);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={state.open}
      onClose={() => !isDisabled && close()}
      fullScreen={isOverlay}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: isOverlay ? { sx: mobileCapsuleDialogPaperSx } : undefined,
      }}
    >
      <DialogTitle sx={isOverlay ? mobileCapsuleDialogTitleSx : undefined}>
        {t("capsule.copyOutfitToOutfitsTitle")}
      </DialogTitle>
      <CopyOutfitDialogContent
        activeName={activeName}
        disabled={isDisabled}
        inputRef={nameInputRef}
        isOverlay={isOverlay}
        state={state}
        setState={setState}
        t={t}
      />
      <CopyOutfitDialogActions
        activeSet={activeSet}
        disabled={isDisabled}
        isOverlay={isOverlay}
        name={state.value}
        onClose={close}
        onSubmit={submit}
        t={t}
      />
    </Dialog>
  );
}

function CopyOutfitDialogContent({
  activeName,
  disabled,
  inputRef,
  isOverlay,
  state,
  setState,
  t,
}: {
  activeName: string;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  isOverlay: boolean;
  state: CopyOutfitDialogState;
  setState: DialogsProps["setCopyOutfitDialog"];
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <DialogContent
      sx={
        isOverlay
          ? { ...mobileCapsuleDialogContentSx, px: 2, pb: 0.5 }
          : { pt: 1, pb: 0.5 }
      }
    >
      <DialogContentText sx={{ color: "text.secondary", mb: 1 }}>
        {t("capsule.copyOutfitToOutfitsBody", { name: activeName })}
      </DialogContentText>
      <TextField
        fullWidth
        autoFocus
        disabled={disabled}
        inputRef={inputRef}
        label={t("outfit.nameLabel")}
        value={state.value}
        onChange={(event) =>
          setState((current) => ({ ...current, value: event.target.value }))
        }
        margin="normal"
      />
    </DialogContent>
  );
}

function CopyOutfitDialogActions({
  activeSet,
  disabled,
  isOverlay,
  name,
  onClose,
  onSubmit,
  t,
}: {
  activeSet: ResolvedOutfitSet | null;
  disabled: boolean;
  isOverlay: boolean;
  name: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  t: (key: string) => string;
}) {
  return (
    <DialogActions
      sx={isOverlay ? mobileCapsuleDialogActionsSx : { px: 3, pb: 2.5 }}
    >
      <Button disabled={disabled} onClick={onClose}>
        {t("actions.cancel")}
      </Button>
      <Button
        variant="contained"
        onClick={() => void onSubmit()}
        disabled={disabled || !name.trim() || !activeSet}
      >
        {t("actions.copy")}
      </Button>
    </DialogActions>
  );
}
