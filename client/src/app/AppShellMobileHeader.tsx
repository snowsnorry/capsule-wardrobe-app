import { IconButton, Stack, Typography } from "@mui/material";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { getActiveSidebarApp } from "./appRouting";
import type { AppRoute, CapsuleMeta, OutfitMeta } from "./appTypes";

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

type AppShellMobileHeaderProps = {
  activeCapsuleMeta: CapsuleMeta | null;
  activeOutfitMeta?: OutfitMeta | null;
  appRoute: AppRoute;
  isContentBusy: boolean;
  openSidebar: () => void;
  t: TranslationFn;
};

type MobileHeaderTitleModel = {
  kind: "entity" | "route" | "empty";
  hasUnsavedChanges: boolean;
  name: string;
};

function isUnsavedEntity(entity: CapsuleMeta | OutfitMeta | null | undefined) {
  return entity?.status === "new" || entity?.status === "modified";
}

function getRouteTitle(
  activeSidebarApp: ReturnType<typeof getActiveSidebarApp>,
  t: TranslationFn,
): string {
  if (activeSidebarApp === "explore") {
    return t("search.title");
  }

  if (activeSidebarApp === "statistics") {
    return t("statistics.title");
  }

  if (activeSidebarApp === "wardrobe") {
    return t("wardrobe.title");
  }

  return "";
}

function getMobileHeaderTitleModel({
  activeCapsuleMeta,
  activeOutfitMeta,
  activeSidebarApp,
  t,
}: Pick<
  AppShellMobileHeaderProps,
  "activeCapsuleMeta" | "activeOutfitMeta" | "t"
> & {
  activeSidebarApp: ReturnType<typeof getActiveSidebarApp>;
}): MobileHeaderTitleModel {
  if (activeSidebarApp === "capsule") {
    return {
      kind: "entity",
      name: activeCapsuleMeta?.name || `<${t("capsule.new")}>`,
      hasUnsavedChanges: isUnsavedEntity(activeCapsuleMeta),
    };
  }

  if (activeSidebarApp === "outfit") {
    return {
      kind: "entity",
      name: activeOutfitMeta?.name || `<${t("wardrobe.newOutfit")}>`,
      hasUnsavedChanges: isUnsavedEntity(activeOutfitMeta),
    };
  }

  const routeTitle = getRouteTitle(activeSidebarApp, t);
  return {
    kind: routeTitle ? "route" : "empty",
    name: routeTitle,
    hasUnsavedChanges: false,
  };
}

export default function AppShellMobileHeader({
  activeCapsuleMeta,
  activeOutfitMeta,
  appRoute,
  isContentBusy,
  openSidebar,
  t,
}: AppShellMobileHeaderProps) {
  const activeSidebarApp = getActiveSidebarApp(appRoute);
  const titleModel = getMobileHeaderTitleModel({
    activeCapsuleMeta,
    activeOutfitMeta,
    activeSidebarApp,
    t,
  });

  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        alignItems: "center",
        px: 2,
        pt: 1.5,
        pb: 1,
        bgcolor: "background.paper",
        flexShrink: 0,
      }}
      data-testid="app-shell-mobile-header"
    >
      <IconButton
        aria-label={t("appShell.toggleSidebar")}
        onClick={openSidebar}
        disabled={activeSidebarApp === "capsule" && isContentBusy}
        sx={{ ml: -1, flexShrink: 0 }}
      >
        <MenuRoundedIcon />
      </IconButton>
      {titleModel.kind === "entity" ? (
        <MobileEntityTitle
          name={titleModel.name}
          hasUnsavedChanges={titleModel.hasUnsavedChanges}
        />
      ) : titleModel.kind === "route" ? (
        <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
          {titleModel.name}
        </Typography>
      ) : null}
    </Stack>
  );
}

function MobileEntityTitle({
  hasUnsavedChanges,
  name,
}: {
  hasUnsavedChanges: boolean;
  name: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: "center", minWidth: 0, flex: "0 1 auto" }}
    >
      <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
        {name}
      </Typography>
      {hasUnsavedChanges ? (
        <FiberManualRecordRoundedIcon
          sx={{ fontSize: 10, color: "success.main", flexShrink: 0 }}
        />
      ) : null}
    </Stack>
  );
}
