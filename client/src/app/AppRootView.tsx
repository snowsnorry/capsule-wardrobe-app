import { CssBaseline, ThemeProvider } from "@mui/material";
import { lazy, Suspense } from "react";
import type { ComponentProps, ReactNode } from "react";
import type AppDialogs from "./AppDialogs";
import AppShellContent from "./AppShellContent";
import type AppSnackbars from "./AppSnackbars";
import RoutePanelFallback from "./RoutePanelFallback";

const LazyAppDialogs = lazy(() => import("./AppDialogs"));
const LazyAppSnackbars = lazy(() => import("./AppSnackbars"));

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
  theme,
}: AppRootViewProps) {
  const shouldRenderDialogs =
    dialogs.isShareDialogOpen || dialogs.isSignOutConfirmOpen;
  const shouldRenderSnackbars =
    snackbars.notificationOpen ||
    snackbars.passkeyPrompt.open ||
    Boolean(snackbars.status.error);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShellContent {...shell}>
        <Suspense fallback={<RoutePanelFallback />}>{routeContent}</Suspense>
      </AppShellContent>
      <Suspense fallback={null}>
        {shouldRenderSnackbars ? <LazyAppSnackbars {...snackbars} /> : null}
        {shouldRenderDialogs ? <LazyAppDialogs {...dialogs} /> : null}
      </Suspense>
    </ThemeProvider>
  );
}
