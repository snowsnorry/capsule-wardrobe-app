import AppRootView from "./AppRootView";
import AppRouteContent from "./AppRouteContent";
import type { AppPresentationModel } from "./appPresentationModel";

export default function AppPresentation({
  model,
}: {
  model: AppPresentationModel;
}) {
  const routeContent = <AppRouteContent {...model.route} />;

  return (
    <AppRootView
      theme={model.theme}
      routeContent={routeContent}
      shell={model.shell}
      snackbars={model.snackbars}
      dialogs={model.dialogs}
    />
  );
}
