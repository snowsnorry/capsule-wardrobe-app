import type { PaletteOptions } from "@mui/material/styles";
import type { ThemeMode } from "./themeTypes";
import { paletteTokens } from "./themeTokens";

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

export { createPalette };
