import {
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
} from "../MobileDialogSurfaceStyles";

function getDialogPaperSx(mobileLayout: boolean) {
  if (mobileLayout) {
    return { ...mobileCapsuleDialogPaperSx, overflowX: "hidden" };
  }

  return {
    width: "min(1240px, 94vw)",
    height: "min(82vh, 820px)",
    maxHeight: "82vh",
    borderRadius: "18px",
    overflow: "hidden",
    backgroundColor: "background.paper",
  };
}

function getDialogContentSx(
  mobileLayout: boolean,
  isLoading: boolean,
  hasMobileHeader = false,
) {
  if (isLoading) {
    return {
      ...(hasMobileHeader ? mobileCapsuleDialogContentSx : {}),
      width: "100%",
      boxSizing: "border-box",
      overflowX: "hidden",
      backgroundColor: "background.default",
      px: 3,
      pt: hasMobileHeader ? 1 : 3,
      pb: hasMobileHeader ? 4 : 3,
      "&&": hasMobileHeader ? { pt: 1 } : undefined,
    };
  }

  if (mobileLayout) {
    return {
      ...(hasMobileHeader ? mobileCapsuleDialogContentSx : {}),
      width: "100%",
      boxSizing: "border-box",
      overflowX: "hidden",
      backgroundColor: "background.default",
      px: 3,
      pt: hasMobileHeader ? 1 : 3,
      pb: hasMobileHeader ? 4 : 3,
      "&&": hasMobileHeader ? { pt: 1 } : undefined,
    };
  }

  return {
    p: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(420px, 48%) minmax(0, 1fr)",
    overflow: "hidden",
  };
}

export { getDialogContentSx, getDialogPaperSx };
