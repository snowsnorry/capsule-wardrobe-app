type PresentationModelInput<
  Actions extends object,
  Handlers extends object,
  Layout extends object,
  Notifications extends object,
  Options extends object,
  Session extends object,
  Share extends object,
  View extends object,
  Theme,
> = {
  actions: Actions;
  handlers: Handlers;
  layout: Layout;
  notifications: Notifications;
  options: Options;
  session: Session;
  share: Share;
  theme: Theme;
  view: View;
};

export function buildAppPresentationModel<
  Actions extends object,
  Handlers extends object,
  Layout extends object,
  Notifications extends object,
  Options extends object,
  Session extends object,
  Share extends object,
  View extends object,
  Theme,
>({
  actions,
  handlers,
  layout,
  notifications,
  options,
  session,
  share,
  theme,
  view,
}: PresentationModelInput<
  Actions,
  Handlers,
  Layout,
  Notifications,
  Options,
  Session,
  Share,
  View,
  Theme
>) {
  return {
    ...actions,
    ...handlers,
    ...layout,
    ...notifications,
    ...options,
    ...session,
    ...share,
    ...view,
    theme,
  };
}
