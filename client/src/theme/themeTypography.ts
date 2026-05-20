import type { ThemeOptions } from "@mui/material/styles";

function createTypography(): NonNullable<ThemeOptions["typography"]> {
  return {
    fontFamily:
      '"Onest Variable", "Onest", "Helvetica Neue", "Arial", sans-serif',
    fontWeightRegular: 400,
    fontWeightMedium: 600,
    fontWeightBold: 700,
    h1: {
      fontSize: "2.25rem",
      fontWeight: 700,
      lineHeight: 1.12,
      letterSpacing: 0,
    },
    h2: {
      fontSize: "1.875rem",
      fontWeight: 700,
      lineHeight: 1.16,
      letterSpacing: 0,
    },
    h3: {
      fontSize: "1.625rem",
      fontWeight: 700,
      lineHeight: 1.18,
      letterSpacing: 0,
    },
    h4: {
      fontSize: "1.375rem",
      fontWeight: 700,
      lineHeight: 1.22,
      letterSpacing: 0,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 700,
      lineHeight: 1.25,
      letterSpacing: 0,
    },
    h6: {
      fontSize: "1.125rem",
      fontWeight: 650,
      lineHeight: 1.28,
      letterSpacing: 0,
    },
    subtitle1: {
      fontSize: "1rem",
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: 0,
    },
    subtitle2: {
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    body1: {
      fontSize: "1rem",
      fontWeight: 400,
      lineHeight: 1.55,
      letterSpacing: 0,
    },
    body2: {
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    button: {
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: 0,
      textTransform: "none",
    },
    caption: {
      fontSize: "0.75rem",
      fontWeight: 500,
      lineHeight: 1.45,
      letterSpacing: 0,
    },
    overline: {
      fontSize: "0.75rem",
      fontWeight: 600,
      lineHeight: 1.45,
      letterSpacing: 0,
      textTransform: "uppercase",
    },
  };
}

export { createTypography };
