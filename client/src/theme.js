import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1c7c7c",
      contrastText: "#ffffff"
    },
    secondary: {
      main: "#f0b429"
    },
    background: {
      default: "#f7f4ef",
      paper: "#ffffff"
    },
    text: {
      primary: "#1f2933",
      secondary: "#52606d"
    }
  },
  typography: {
    fontFamily: '"DM Sans", "Helvetica", sans-serif',
    h1: { fontWeight: 700, letterSpacing: -0.5 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 }
  },
  shape: {
    borderRadius: 18
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body, #root": {
          height: "100%",
          overscrollBehavior: "none"
        },
        body: {
          overscrollBehavior: "none"
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(20, 60, 60, 0.08)"
        }
      }
    }
  }
});

export default theme;
