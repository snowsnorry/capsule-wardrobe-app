import { CssBaseline, ThemeProvider } from "@mui/material";
import type { ComponentProps, ReactNode } from "react";
import AppDialogs from "./AppDialogs";
import AppShellContent from "./AppShellContent";
import AppSnackbars from "./AppSnackbars";

type AppRootViewProps = {
  dialogs: ComponentProps<typeof AppDialogs>;
  routeContent: ReactNode;
  shell: ComponentProps<typeof AppShellContent>;
  snackbars: ComponentProps<typeof AppSnackbars>;
  theme: ComponentProps<typeof ThemeProvider>["theme"];
};

export default function AppRootView({
  dialogs,
  routeContent,
  shell,
  snackbars,
  theme
}: AppRootViewProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShellContent {...shell}>
        {routeContent}
      </AppShellContent>
      <AppSnackbars {...snackbars} />
      <AppDialogs {...dialogs} />
    </ThemeProvider>
  );
}
