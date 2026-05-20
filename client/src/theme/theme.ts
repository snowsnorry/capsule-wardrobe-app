import { createTheme } from "@mui/material/styles";
import { createComponentOverrides } from "./themeComponents";
import { createPalette } from "./themePalette";
import type { ThemeMode } from "./themeTypes";
import { appThemeTokens } from "./themeTokens";
import { createTypography } from "./themeTypography";

function createAppTheme(mode: ThemeMode = "light") {
  return createTheme({
    palette: createPalette(mode),
    typography: createTypography(),
    shape: {
      borderRadius: 14,
    },
    components: createComponentOverrides(mode),
  });
}

const theme = createAppTheme("light");

export { appThemeTokens, createAppTheme };
export default theme;
