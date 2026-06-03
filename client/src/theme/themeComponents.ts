import { alpha } from "@mui/material/styles";
import type { Components, Theme } from "@mui/material/styles";
import { createThemeCssVariables } from "./themeCssVariables";
import type { ThemeMode } from "./themeTypes";
import { appThemeTokens, paletteTokens } from "./themeTokens";

const componentToneByMode = {
  light: {
    defaultChipBg: "rgba(20, 60, 60, 0.04)",
    disabledButtonBg: "rgba(20, 60, 60, 0.045)",
    disabledButtonBorder: "rgba(20, 60, 60, 0.08)",
    disabledButtonColor: "rgba(31, 41, 51, 0.42)",
    inputBorder: "rgba(20, 60, 60, 0.11)",
    inputBg: "#fffefa",
    inputHoverBorder: "rgba(28, 124, 124, 0.24)",
    outlinedHoverBorder: "rgba(20, 60, 60, 0.12)",
    selectedChipBorderOpacity: 0.24,
    selectedControlColorToken: "primaryMain",
    sliderFocusOpacity: 0.1,
    sliderRailOpacity: 0.16,
    sliderThumbBorderOpacity: 0.22,
    sliderTrackOpacity: 0.68,
    tabIndicatorOpacity: 0.68,
  },
  dark: {
    defaultChipBg: "rgba(238, 245, 243, 0.055)",
    disabledButtonBg: "rgba(238, 245, 243, 0.06)",
    disabledButtonBorder: "rgba(218, 236, 231, 0.12)",
    disabledButtonColor: "rgba(238, 245, 243, 0.42)",
    inputBorder: "rgba(218, 236, 231, 0.16)",
    inputBg: "rgba(238, 245, 243, 0.03)",
    inputHoverBorder: "rgba(101, 178, 175, 0.38)",
    outlinedHoverBorder: "rgba(218, 236, 231, 0.24)",
    selectedChipBorderOpacity: 0.34,
    selectedControlColorToken: "primaryDark",
    sliderFocusOpacity: 0.14,
    sliderRailOpacity: 0.22,
    sliderThumbBorderOpacity: 0.34,
    sliderTrackOpacity: 0.72,
    tabIndicatorOpacity: 0.72,
  },
} as const;

const menuItemHorizontalPaddingPx = 16;
const menuItemIconColumnWidthPx = 36;
const mixedIconMenuItemTextOffsetPx =
  menuItemHorizontalPaddingPx + menuItemIconColumnWidthPx;

// MUI component configuration is intentionally centralized here.
// eslint-disable-next-line max-lines-per-function
function createComponentOverrides(mode: ThemeMode): Components<Theme> {
  const tokens = paletteTokens[mode];
  const tone = componentToneByMode[mode];
  const selectedControlColor = tokens[tone.selectedControlColorToken];
  const selectedChipColor =
    mode === "light" ? tokens.primaryDark : selectedControlColor;

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
        'input[type="number"]': {
          fontVariantNumeric: "tabular-nums",
        },
        ".recharts-cartesian-axis-tick-value, .recharts-tooltip-wrapper": {
          fontVariantNumeric: "tabular-nums",
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
          fontWeight: appThemeTokens.typography.denseLabelWeight,
          transition:
            "background-color 180ms cubic-bezier(0.2, 0, 0, 1), border-color 180ms cubic-bezier(0.2, 0, 0, 1), color 180ms cubic-bezier(0.2, 0, 0, 1)",
          "&.Mui-disabled": {
            backgroundColor: tone.disabledButtonBg,
            borderColor: tone.disabledButtonBorder,
            color: tone.disabledButtonColor,
          },
        },
        containedPrimary: {
          "&:hover": {
            backgroundColor: tokens.primaryDark,
          },
        },
        outlinedInherit: {
          borderColor: tokens.divider,
          color: tokens.textPrimary,
          "&:hover": {
            borderColor: tone.outlinedHoverBorder,
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
            backgroundColor: tone.defaultChipBg,
            color: tokens.textPrimary,
            "&:hover": {
              backgroundColor: "var(--cw-color-action-wash)",
            },
          },
        },
        label: {
          fontWeight: appThemeTokens.typography.denseLabelWeight,
        },
        filledPrimary: {
          backgroundColor: "var(--cw-color-action-wash)",
          boxShadow: `inset 0 0 0 1px ${alpha(tokens.primaryMain, tone.selectedChipBorderOpacity)}`,
          color: selectedChipColor,
          "&:hover": {
            backgroundColor: "var(--cw-color-action-hover)",
          },
          "& .MuiChip-deleteIcon": {
            color: alpha(selectedChipColor, 0.68),
            "&:hover": {
              color: selectedChipColor,
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
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '[role="menu"]:has(.MuiListItemIcon-root) &:not(:has(.MuiListItemIcon-root))':
            { paddingLeft: mixedIconMenuItemTextOffsetPx },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.divider}`,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: tokens.divider,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderColor: tokens.divider,
          borderRadius: "var(--cw-radius-dialog)",
          boxShadow: "var(--cw-shadow-overlay-panel)",
        },
        paperFullScreen: {
          borderRadius: 0,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: appThemeTokens.typography.denseLabelWeight,
          "&.Mui-selected": {
            color: selectedControlColor,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: alpha(tokens.primaryMain, tone.tabIndicatorOpacity),
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: tokens.primaryMain,
          "& .MuiSlider-rail": {
            opacity: 1,
            backgroundColor: alpha(tokens.primaryMain, tone.sliderRailOpacity),
          },
          "& .MuiSlider-track": {
            backgroundColor: alpha(tokens.primaryMain, tone.sliderTrackOpacity),
            border: 0,
          },
          "& .MuiSlider-thumb": {
            boxShadow: `0 0 0 1px ${alpha(tokens.primaryMain, tone.sliderThumbBorderOpacity)}`,
            "&:hover, &.Mui-focusVisible": {
              boxShadow: `0 0 0 6px ${alpha(tokens.primaryMain, tone.sliderFocusOpacity)}`,
            },
          },
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
          backgroundColor: tone.inputBg,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: tone.inputBorder,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: tone.inputHoverBorder,
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
