import type { ComponentProps } from "react";
import AppDialogs from "./AppDialogs";
import AppRootView from "./AppRootView";
import AppRouteContent from "./AppRouteContent";
import AppShellContent from "./AppShellContent";
import AppSnackbars from "./AppSnackbars";

export type AppPresentationModel = Record<string, unknown>;

export default function AppPresentation({
  model,
}: {
  model: AppPresentationModel;
}) {
  const routeContent = (
    <AppRouteContent {...(model as ComponentProps<typeof AppRouteContent>)} />
  );

  return (
    <AppRootView
      theme={model.theme as ComponentProps<typeof AppRootView>["theme"]}
      routeContent={routeContent}
      shell={model as ComponentProps<typeof AppShellContent>}
      snackbars={model as ComponentProps<typeof AppSnackbars>}
      dialogs={model as ComponentProps<typeof AppDialogs>}
    />
  );
}
