import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

export const dialogTitleSx = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 2,
} as const;

export const pickerDialogPaperSx = {
  height: "calc(100dvh - 48px)",
  maxHeight: "calc(100dvh - 48px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
} as const;

export const pickerDialogFullScreenPaperSx = {
  height: "100dvh",
  maxHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
} as const;

export const pickerDialogContentSx = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  px: 3,
  py: 2.5,
  "&&": {
    pt: 2.5,
  },
} as const;

export const pickerDialogLoadingDividerSx = {
  height: 4,
  borderTop: "1px solid",
  borderColor: "divider",
  flexShrink: 0,
  "& .MuiLinearProgress-root": {
    height: "100%",
  },
} as const;

export const pickerDialogActionsSx = {
  flexShrink: 0,
  justifyContent: "flex-end",
} as const;

export const pickerScrollAreaSx = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  pr: 0.5,
} as const;

export const pickerGridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, minmax(0, 1fr))",
    md: "repeat(3, minmax(0, 1fr))",
  },
  gap: 1.5,
} as const;

export function pickerCardSx(
  theme: Theme,
  selected: boolean,
  disabled: boolean,
) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 1.25,
    minWidth: 0,
    textAlign: "left",
    p: 1,
    border: "1px solid",
    borderColor: selected
      ? theme.palette.primary.main
      : alpha(theme.palette.primary.main, 0.14),
    borderRadius: "var(--cw-radius-card)",
    bgcolor: selected
      ? alpha(theme.palette.primary.main, 0.08)
      : theme.palette.background.paper,
    opacity: disabled ? 0.48 : 1,
  };
}
