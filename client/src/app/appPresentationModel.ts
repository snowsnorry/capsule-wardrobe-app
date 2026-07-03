import type { ComponentProps } from "react";
import type AppDialogs from "./AppDialogs";
import type AppRouteContent from "./AppRouteContent";
import type AppShellContent from "./AppShellContent";
import type AppSnackbars from "./AppSnackbars";

export type AppPresentationModel<Theme = unknown> = {
  dialogs: ComponentProps<typeof AppDialogs>;
  route: ComponentProps<typeof AppRouteContent>;
  shell: Omit<ComponentProps<typeof AppShellContent>, "children">;
  snackbars: ComponentProps<typeof AppSnackbars>;
  theme: Theme;
};

export function buildAppPresentationModel<Theme>(
  model: AppPresentationModel<Theme>,
) {
  return model;
}
