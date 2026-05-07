import { createTheme } from "@mui/material/styles";
import type { PaletteOptions } from "@mui/material/styles";

type ThemeMode = "light" | "dark";

function createPalette(mode: ThemeMode = "light"): PaletteOptions {
  if (mode === "dark") {
    return {
      mode: "dark",
      primary: {
        main: "#49a3a3",
        contrastText: "#081111",
      },
      secondary: {
        main: "#f0b429",
      },
      background: {
        default: "#101817",
        paper: "#15201f",
      },
      divider: "rgba(218, 236, 231, 0.42)",
      text: {
        primary: "#eef5f3",
        secondary: "#aab8b4",
      },
    };
  }

  return {
    mode: "light",
    primary: {
      main: "#1c7c7c",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#f0b429",
    },
    background: {
      default: "#f7f4ef",
      paper: "#ffffff",
    },
    divider: "rgba(20, 60, 60, 0.08)",
    text: {
      primary: "#1f2933",
      secondary: "#52606d",
    },
  };
}

function createAppTheme(mode: ThemeMode = "light") {
  return createTheme({
    palette: createPalette(mode),
    typography: {
      fontFamily: '"DM Sans", "Helvetica", sans-serif',
      h1: { fontWeight: 700, letterSpacing: -0.5 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
    },
    shape: {
      borderRadius: 18,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "html, body, #root": {
            height: "100%",
            overscrollBehavior: "none",
          },
          body: {
            overscrollBehavior: "none",
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
            fontWeight: 600,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            border:
              mode === "dark"
                ? "1px solid rgba(218, 236, 231, 0.34)"
                : "1px solid rgba(20, 60, 60, 0.08)",
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor:
              mode === "dark"
                ? "rgba(218, 236, 231, 0.42)"
                : "rgba(20, 60, 60, 0.08)",
          },
        },
      },
    },
  });
}

const theme = createAppTheme("light");

export { createAppTheme };
export default theme;
