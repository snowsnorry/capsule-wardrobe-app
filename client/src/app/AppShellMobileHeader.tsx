import { IconButton, Stack, Typography } from "@mui/material";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { getActiveSidebarApp } from "./appRouting";
import type { AppRoute, CapsuleMeta } from "./appTypes";

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

type AppShellMobileHeaderProps = {
  activeCapsuleMeta: CapsuleMeta | null;
  appRoute: AppRoute;
  isContentBusy: boolean;
  openSidebar: () => void;
  t: TranslationFn;
};

function getRouteTitle({
  appRoute,
  t,
}: Pick<AppShellMobileHeaderProps, "appRoute" | "t">): string {
  const activeSidebarApp = getActiveSidebarApp(appRoute);

  if (activeSidebarApp === "explore") {
    return t("search.title");
  }

  if (activeSidebarApp === "statistics") {
    return t("statistics.title");
  }

  return "";
}

export default function AppShellMobileHeader({
  activeCapsuleMeta,
  appRoute,
  isContentBusy,
  openSidebar,
  t,
}: AppShellMobileHeaderProps) {
  const activeSidebarApp = getActiveSidebarApp(appRoute);
  const routeTitle = getRouteTitle({ appRoute, t });

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{
        px: 2,
        pt: 1.5,
        pb: 1,
        bgcolor: "background.paper",
        flexShrink: 0,
      }}
      data-testid="app-shell-mobile-header"
    >
      <IconButton
        aria-label="Toggle sidebar"
        onClick={openSidebar}
        disabled={activeSidebarApp === "capsule" && isContentBusy}
        sx={{ ml: -1, flexShrink: 0 }}
      >
        <MenuRoundedIcon />
      </IconButton>
      {activeSidebarApp === "capsule" ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{ minWidth: 0, flex: "0 1 auto" }}
        >
          <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
            {activeCapsuleMeta?.name || `<${t("capsule.new")}>`}
          </Typography>
          {activeCapsuleMeta?.status === "new" ||
          activeCapsuleMeta?.status === "modified" ? (
            <FiberManualRecordRoundedIcon
              sx={{ fontSize: 10, color: "success.main", flexShrink: 0 }}
            />
          ) : null}
        </Stack>
      ) : routeTitle ? (
        <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
          {routeTitle}
        </Typography>
      ) : null}
    </Stack>
  );
}
