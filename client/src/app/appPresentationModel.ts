import type { AppActionContext } from "./actionContext";

type PresentationModelInput = {
  actions: AppActionContext;
  handlers: Record<string, unknown>;
  layout: AppActionContext;
  notifications: AppActionContext;
  options: AppActionContext;
  session: AppActionContext;
  share: AppActionContext;
  theme: unknown;
  view: AppActionContext;
};

export function buildAppPresentationModel({
  actions,
  handlers,
  layout,
  notifications,
  options,
  session,
  share,
  theme,
  view,
}: PresentationModelInput) {
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
