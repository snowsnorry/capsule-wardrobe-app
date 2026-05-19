import { alpha, createTheme } from "@mui/material/styles";
import type {
  Components,
  PaletteOptions,
  Theme,
  ThemeOptions,
} from "@mui/material/styles";

type ThemeMode = "light" | "dark";

const paletteTokens = {
  light: {
    primaryMain: "#1c7c7c",
    primaryDark: "#155f5f",
    primaryLight: "#dcefeb",
    primaryContrast: "#fbfffd",
    secondaryMain: "#b68416",
    secondaryLight: "#f7e5b5",
    userAvatarBg: "oklch(93% 0.035 82)",
    userAvatarInk: "oklch(38% 0.035 75)",
    successMain: "#2f8f58",
    errorMain: "#d24343",
    warningMain: "#9b6a05",
    infoMain: "#326c88",
    backgroundDefault: "#f7f4ef",
    backgroundPaper: "#fffdf9",
    textPrimary: "#1f2933",
    textSecondary: "#52606d",
    divider: "rgba(20, 60, 60, 0.08)",
  },
  dark: {
    primaryMain: "#49a3a3",
    primaryDark: "#79c7c4",
    primaryLight: "#1f3c3b",
    primaryContrast: "#081111",
    secondaryMain: "#f0b429",
    secondaryLight: "#4a3814",
    userAvatarBg: "oklch(28% 0.035 80)",
    userAvatarInk: "oklch(78% 0.08 82)",
    successMain: "#66c58a",
    errorMain: "#ff8d86",
    warningMain: "#f0b429",
    infoMain: "#7fb6c8",
    backgroundDefault: "#101817",
    backgroundPaper: "#15201f",
    textPrimary: "#eef5f3",
    textSecondary: "#aab8b4",
    divider: "rgba(218, 236, 231, 0.42)",
  },
} as const;

function createPalette(mode: ThemeMode = "light"): PaletteOptions {
  const tokens = paletteTokens[mode];
  return {
    mode,
    primary: {
      main: tokens.primaryMain,
      dark: tokens.primaryDark,
      light: tokens.primaryLight,
      contrastText: tokens.primaryContrast,
    },
    secondary: {
      main: tokens.secondaryMain,
      light: tokens.secondaryLight,
    },
    success: {
      main: tokens.successMain,
    },
    error: {
      main: tokens.errorMain,
    },
    warning: {
      main: tokens.warningMain,
    },
    info: {
      main: tokens.infoMain,
    },
    background: {
      default: tokens.backgroundDefault,
      paper: tokens.backgroundPaper,
    },
    divider: tokens.divider,
    text: {
      primary: tokens.textPrimary,
      secondary: tokens.textSecondary,
    },
  };
}

function createTypography(): NonNullable<ThemeOptions["typography"]> {
  return {
    fontFamily: '"DM Sans", "Helvetica", sans-serif',
    fontWeightRegular: 400,
    fontWeightMedium: 500,
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
      fontWeight: 650,
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
      fontWeight: 650,
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
      fontWeight: 650,
      lineHeight: 1.45,
      letterSpacing: 0,
      textTransform: "uppercase",
    },
  };
}

// MUI theme configuration is intentionally centralized here.
// eslint-disable-next-line max-lines-per-function
function createComponentOverrides(mode: ThemeMode): Components<Theme> {
  const tokens = paletteTokens[mode];
  const isDark = mode === "dark";

  return {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--cw-color-action-wash": isDark
            ? "oklch(28% 0.035 190)"
            : "oklch(95% 0.025 190)",
          "--cw-color-action-hover": isDark
            ? "oklch(31% 0.04 190)"
            : "oklch(93% 0.03 190)",
          "--cw-color-gold-wash": isDark
            ? "oklch(30% 0.045 80)"
            : "oklch(94% 0.055 82)",
          "--cw-color-user-avatar-bg": tokens.userAvatarBg,
          "--cw-color-user-avatar-ink": tokens.userAvatarInk,
          "--cw-color-surface-warm": isDark
            ? "oklch(18% 0.014 180)"
            : "oklch(98% 0.008 72)",
        },
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

function createAppTheme(mode: ThemeMode = "light") {
  return createTheme({
    palette: createPalette(mode),
    typography: createTypography(),
    shape: {
      borderRadius: 18,
    },
    components: createComponentOverrides(mode),
  });
}

const theme = createAppTheme("light");

export { createAppTheme };
export default theme;
