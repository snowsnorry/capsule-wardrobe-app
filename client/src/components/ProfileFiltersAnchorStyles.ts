import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

export const dialogTitleSx = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 2,
} as const;

export const loadingSx = {
  minHeight: 220,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
    transition: "background-color 180ms ease-out, border-color 180ms ease-out",
  };
}
