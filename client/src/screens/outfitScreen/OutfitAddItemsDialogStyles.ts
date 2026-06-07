import {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
} from "../../components/MobileDialogSurfaceStyles";
import {
  pickerDialogActionsSx,
  pickerDialogContentSx,
  pickerDialogFullScreenPaperSx,
  pickerDialogPaperSx,
} from "../../components/ProfileFiltersAnchorStyles";

export function getAddItemsDialogPaperSx(fullScreen: boolean) {
  if (!fullScreen) return pickerDialogPaperSx;
  return {
    ...mobileCapsuleDialogPaperSx,
    ...pickerDialogFullScreenPaperSx,
  };
}

export function getAddItemsDialogTitleSx(fullScreen: boolean) {
  return fullScreen ? mobileCapsuleDialogTitleSx : { pb: 0 };
}

export function getAddItemsDialogContentSx(fullScreen: boolean) {
  if (!fullScreen) return pickerDialogContentSx;
  return {
    ...mobileCapsuleDialogContentSx,
    ...pickerDialogContentSx,
  };
}

export function getAddItemsDialogActionsSx(fullScreen: boolean) {
  return fullScreen ? mobileCapsuleDialogActionsSx : pickerDialogActionsSx;
}
