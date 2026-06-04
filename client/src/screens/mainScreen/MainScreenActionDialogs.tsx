import { useEffect, useRef } from "react";
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
  ConfirmState,
  DialogsProps,
  NameDialogState,
} from "./MainScreenDialogsTypes";
import type { MainScreenProps } from "./MainScreenTypes";

function clearConfirm(setConfirm: DialogsProps["setConfirm"]) {
  setConfirm({ action: "", capsuleId: "", outfitSetIndex: -1 });
}

async function runConfirmAction(
  state: ConfirmState,
  props: MainScreenProps,
  onCloseRowMenu: () => void,
) {
  const rowDelete = async () => {
    await props.onDeleteCapsule?.(state.capsuleId);
    onCloseRowMenu();
  };
  const rowRevert = async () => {
    await props.onRevertCapsule?.(state.capsuleId);
    onCloseRowMenu();
  };
  const actions: Record<string, () => Promise<void> | void> = {
    delete: () => props.onDeleteCapsule?.(),
    "delete-row": rowDelete,
    revert: () => props.onRevertCapsule?.(),
    "revert-row": rowRevert,
    "delete-outfit-set-image": () =>
      props.onDeleteOutfitSetImage?.(state.outfitSetIndex),
    "regenerate-with-filter-changes": props.onApplyFilters,
    "regenerate-all": props.onRefreshItems,
  };
  if (state.action === "delete-outfit-set-image" && state.outfitSetIndex < 0) {
    return;
  }
  await actions[state.action]?.();
}

function getConfirmCopy(action: string) {
  if (action === "delete-outfit-set-image")
    return [
      "capsule.deleteOutfitSetImageTitle",
      "capsule.deleteOutfitSetImageConfirmBody",
      "capsule.deleteConfirm",
    ];
  if (action === "regenerate-with-filter-changes")
    return [
      "capsule.regenerateWithFilterChangesTitle",
      "capsule.regenerateWithFilterChangesBody",
      "capsule.regenerateWithFilterChangesConfirm",
    ];
  if (action === "regenerate-all")
    return [
      "capsule.regenerateAllTitle",
      "capsule.regenerateAllConfirmBody",
      "capsule.regenerateAllConfirm",
    ];
  if (action.startsWith("delete"))
    return [
      "capsule.deleteTitle",
      "capsule.deleteConfirmBody",
      "capsule.deleteConfirm",
    ];
  return [
    "capsule.revertTitle",
    "capsule.revertConfirmBody",
    "capsule.revertConfirm",
  ];
}

function useFocusNameDialogInput(
  stateType: string,
  nameInputRef: RefObject<HTMLInputElement | null>,
) {
  useEffect(() => {
    if (!stateType) {
      return undefined;
    }
    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [nameInputRef, stateType]);
}

export function NameDialog({
  state,
  disabled,
  isOverlay,
  props,
  setState,
}: {
  state: NameDialogState;
  disabled: boolean;
  isOverlay: boolean;
  props: MainScreenProps;
  setState: DialogsProps["setNameDialog"];
}) {
  const { t } = useI18n();
  const isSaveAs = state.type === "save-as";
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  useFocusNameDialogInput(state.type, nameInputRef);
  const submit = async () => {
    setState({ type: "", capsuleId: "", value: "" });
    if (isSaveAs)
      await props.onDuplicateCapsule?.(state.value, state.capsuleId);
    else await props.onRenameCapsule?.(state.value, state.capsuleId);
  };

  return (
    <Dialog
      open={Boolean(state.type)}
      onClose={() =>
        !disabled && setState({ type: "", capsuleId: "", value: "" })
      }
      fullScreen={isOverlay}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: isOverlay ? { sx: mobileCapsuleDialogPaperSx } : undefined,
      }}
    >
      <DialogTitle sx={isOverlay ? mobileCapsuleDialogTitleSx : undefined}>
        {t(isSaveAs ? "capsule.saveAsTitle" : "capsule.renameTitle")}
      </DialogTitle>
      <DialogContent
        sx={
          isOverlay
            ? { ...mobileCapsuleDialogContentSx, px: 2, pb: 0.5 }
            : { pt: 1, pb: 0.5 }
        }
      >
        <TextField
          fullWidth
          autoFocus
          disabled={disabled}
          inputRef={nameInputRef}
          value={state.value}
          onChange={(event) =>
            setState((current) => ({ ...current, value: event.target.value }))
          }
          margin="normal"
          slotProps={{
            htmlInput: {
              "aria-label": t(
                isSaveAs ? "capsule.saveAsTitle" : "capsule.renameTitle",
              ),
            },
          }}
        />
      </DialogContent>
      <DialogActions
        sx={isOverlay ? mobileCapsuleDialogActionsSx : { px: 3, pb: 2.5 }}
      >
        <Button
          disabled={disabled}
          onClick={() => setState({ type: "", capsuleId: "", value: "" })}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={disabled || !state.value.trim()}
        >
          {t("actions.ok")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ConfirmDialog({
  state,
  disabled,
  isOverlay,
  props,
  setState,
  onCloseRowMenu,
}: {
  state: ConfirmState;
  disabled: boolean;
  isOverlay: boolean;
  props: MainScreenProps;
  setState: DialogsProps["setConfirm"];
  onCloseRowMenu: () => void;
}) {
  const { t } = useI18n();
  const [title, body, button] = getConfirmCopy(state.action);

  return (
    <Dialog
      open={Boolean(state.action)}
      onClose={() => !disabled && clearConfirm(setState)}
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
        <Button disabled={disabled} onClick={() => clearConfirm(setState)}>
          {t("actions.cancel")}
        </Button>
        <Button
          color={state.action.startsWith("delete") ? "error" : "primary"}
          variant="contained"
          disabled={disabled}
          onClick={() => {
            const next = state;
            clearConfirm(setState);
            void runConfirmAction(next, props, onCloseRowMenu);
          }}
        >
          {t(button)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
