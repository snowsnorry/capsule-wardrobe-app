import { buildAppPresentationModel } from "./appPresentationModel";
import {
  buildDialogModel,
  buildRouteModel,
  buildShellModel,
  buildSnackbarModel,
} from "./appControllerPresentationModels";
import {
  buildActions,
  buildHandlers,
  buildLayout,
  buildNotifications,
  buildOptions,
  buildSession,
  buildShare,
  buildView,
  type ControllerModelInput,
} from "./appControllerModelParts";

export function buildAppControllerModel(input: ControllerModelInput) {
  const actions = buildActions(input);
  const handlers = buildHandlers(input.handlers);
  const layout = buildLayout(input);
  const notifications = buildNotifications(input);
  const options = buildOptions(input.profileOptions);
  const session = buildSession(input.appState);
  const share = buildShare(input);
  const view = buildView(input);

  return buildAppPresentationModel({
    dialogs: buildDialogModel({ actions, session, share, t: input.t }),
    route: buildRouteModel({
      actions,
      handlers,
      layout,
      options,
      session,
      view,
    }),
    shell: buildShellModel({ actions, handlers, layout }),
    snackbars: buildSnackbarModel({
      actions,
      notifications,
      session,
      t: input.t,
    }),
    theme: input.appTheme,
  });
}
