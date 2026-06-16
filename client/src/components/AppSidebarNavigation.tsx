import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import AppSidebarNavigationList from "./AppSidebarNavigationList";
import { useAppSidebarNavigationModel } from "./AppSidebarNavigationModel";
import type { AppSidebarNavigationProps } from "./AppSidebarNavigationTypes";

function AppSidebarNavigation(props: AppSidebarNavigationProps): ReactElement {
  const model = useAppSidebarNavigationModel(props);

  return (
    <Stack sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
      <AppSidebarNavigationList model={model} />
      {model.isCollapsedDesktop ? model.collapsedExpandHitbox : null}
    </Stack>
  );
}

export default AppSidebarNavigation;
