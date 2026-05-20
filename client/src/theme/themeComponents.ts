import { alpha } from "@mui/material/styles";
import type { Components, Theme } from "@mui/material/styles";
import { createThemeCssVariables } from "./themeCssVariables";
import type { ThemeMode } from "./themeTypes";
import { paletteTokens } from "./themeTokens";

// MUI component configuration is intentionally centralized here.
// eslint-disable-next-line max-lines-per-function
function createComponentOverrides(mode: ThemeMode): Components<Theme> {
  const tokens = paletteTokens[mode];
  const isDark = mode === "dark";

  return {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": createThemeCssVariables(mode),
        "html, body, #root": {
          height: "100%",
          overscrollBehavior: "none",
        },
        body: {
          overscrollBehavior: "none",
          fontKerning: "normal",
          fontOpticalSizing: "auto",
          textRendering: "optimizeLegibility",
        },
        "@keyframes placeholderShimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 650,
          transition:
            "background-color 180ms cubic-bezier(0.2, 0, 0, 1), border-color 180ms cubic-bezier(0.2, 0, 0, 1), color 180ms cubic-bezier(0.2, 0, 0, 1)",
        },
        containedPrimary: {
          "&:hover": {
            backgroundColor: tokens.primaryDark,
          },
        },
        outlinedInherit: {
          borderColor: isDark
            ? "rgba(218, 236, 231, 0.34)"
            : "rgba(20, 60, 60, 0.16)",
          color: tokens.textPrimary,
          "&:hover": {
            borderColor: isDark
              ? "rgba(218, 236, 231, 0.52)"
              : "rgba(28, 124, 124, 0.34)",
            backgroundColor: "var(--cw-color-action-wash)",
          },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          justifyContent: "flex-end",
          backgroundColor: "transparent",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          "&.MuiChip-colorDefault": {
            backgroundColor: isDark
              ? "rgba(238, 245, 243, 0.08)"
              : "rgba(20, 60, 60, 0.055)",
            color: tokens.textPrimary,
            "&:hover": {
              backgroundColor: "var(--cw-color-action-wash)",
            },
          },
        },
        label: {
          fontWeight: 600,
        },
        filledPrimary: {
          backgroundColor: tokens.primaryMain,
          color: tokens.primaryContrast,
          "&:hover": {
            backgroundColor: tokens.primaryDark,
          },
          "& .MuiChip-deleteIcon": {
            color: alpha(tokens.primaryContrast, 0.72),
            "&:hover": {
              color: tokens.primaryContrast,
            },
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          letterSpacing: 0,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: isDark
            ? "1px solid rgba(218, 236, 231, 0.34)"
            : "1px solid rgba(20, 60, 60, 0.08)",
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: isDark ? "rgba(218, 236, 231, 0.42)" : tokens.divider,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        color: "primary",
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? "rgba(238, 245, 243, 0.03)" : "#fffefa",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: isDark
              ? "rgba(121, 199, 196, 0.62)"
              : "rgba(28, 124, 124, 0.34)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: tokens.primaryMain,
          },
        },
      },
    },
  };
}

export { createComponentOverrides };
