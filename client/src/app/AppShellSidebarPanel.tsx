import { Suspense, useCallback, useRef } from "react";
import AppShellCapsuleActionMenu from "./AppShellCapsuleActionMenu";
import AppShellOutfitActionMenu from "./AppShellOutfitActionMenu";
import AppShellSidebarNavigationBody from "./AppShellSidebarNavigationBody";
import AppSidebarShell from "../components/AppSidebarShell";
import AppShellMobileHeader from "./AppShellMobileHeader";
import RoutePanelFallback from "./RoutePanelFallback";
import { SearchDialog } from "../screens/mainScreen/MainScreenUtilityDialogs";
import {
  getSidebarShellTestId,
  isFullScreenAppShellRoute,
} from "./AppShellRouteLayout";
import { getActiveSidebarApp } from "./appRouting";
import { useSidebarCapsuleSearch } from "./useSidebarCapsuleSearch";
import type { AppShellCapsuleActionMenuController } from "./AppShellCapsuleActionMenu";
import type { AppShellOutfitActionMenuController } from "./AppShellOutfitActionMenu";
import type { AppShellContentProps } from "./AppShellContentTypes";

const EMPTY_OUTFIT_LIST: NonNullable<AppShellContentProps["outfitList"]> = [];
const EMPTY_OUTFIT_PAGINATION = {
  limit: 10,
  offset: 0,
  total: 0,
  hasMore: false,
} as const;

async function noopAsync() {}

function getUserEmail(user: AppShellContentProps["user"]) {
  return user?.email || "";
}

function getHighlightedCapsuleId(
  activeSidebarApp: ReturnType<typeof getActiveSidebarApp>,
  props: AppShellContentProps,
) {
  return activeSidebarApp === "capsule" ? props.capsuleRouteId : "";
}

function getHighlightedOutfitId(
  activeSidebarApp: ReturnType<typeof getActiveSidebarApp>,
  props: AppShellContentProps,
) {
  return activeSidebarApp === "outfit" ? props.outfitRouteId || "" : "";
}

function getSidebarCapsuleMeta(
  activeSidebarApp: ReturnType<typeof getActiveSidebarApp>,
  props: AppShellContentProps,
) {
  return activeSidebarApp !== "capsule" ||
    !props.capsuleRouteId ||
    props.activeCapsuleMeta?.id === props.capsuleRouteId
    ? props.activeCapsuleMeta
    : null;
}

function getSidebarOutfitMeta(
  activeSidebarApp: ReturnType<typeof getActiveSidebarApp>,
  props: AppShellContentProps,
) {
  return activeSidebarApp !== "outfit" ||
    !props.outfitRouteId ||
    props.activeOutfitMeta?.id === props.outfitRouteId
    ? props.activeOutfitMeta || null
    : null;
}

function useAppShellSidebarPanelModel(props: AppShellContentProps) {
  const activeSidebarApp = getActiveSidebarApp(props.appRoute);
  const userEmail = getUserEmail(props.user);
  const usesCapsuleLayout = isFullScreenAppShellRoute(props);
  const sidebarSearch = useSidebarCapsuleSearch(props.onSearchCapsules);
  const outfitSidebarSearch = useSidebarCapsuleSearch(
    props.onSearchOutfits || (() => []),
  );
  const capsuleActionMenuControllerRef =
    useRef<AppShellCapsuleActionMenuController | null>(null);
  const outfitActionMenuControllerRef =
    useRef<AppShellOutfitActionMenuController | null>(null);
  const registerCapsuleActionMenuController = useCallback(
    (controller: AppShellCapsuleActionMenuController) => {
      capsuleActionMenuControllerRef.current = controller;
    },
    [],
  );
  const registerOutfitActionMenuController = useCallback(
    (controller: AppShellOutfitActionMenuController) => {
      outfitActionMenuControllerRef.current = controller;
    },
    [],
  );

  return {
    activeSidebarApp,
    activeJobEntityKeys: props.activeJobEntityKeys,
    capsuleActionMenuControllerRef,
    highlightedCapsuleId: getHighlightedCapsuleId(activeSidebarApp, props),
    highlightedOutfitId: getHighlightedOutfitId(activeSidebarApp, props),
    outfitActionMenuControllerRef,
    outfitSidebarSearch,
    personalItemsCount: props.personalItemsCount ?? null,
    registerCapsuleActionMenuController,
    registerOutfitActionMenuController,
    sidebarCapsuleMeta: getSidebarCapsuleMeta(activeSidebarApp, props),
    sidebarOutfitMeta: getSidebarOutfitMeta(activeSidebarApp, props),
    sidebarSearch,
    userEmail,
    usesCapsuleLayout,
  };
}

type SidebarPanelModel = ReturnType<typeof useAppShellSidebarPanelModel>;

function AppShellSidebarPanel(props: AppShellContentProps) {
  const model = useAppShellSidebarPanelModel(props);

  return (
    <AppSidebarShell
      shellTestId={getSidebarShellTestId(props)}
      currentApp={model.activeSidebarApp}
      contentSurface="plain"
      contentAlignment={model.usesCapsuleLayout ? "start" : "center"}
      desktopContentGap={model.usesCapsuleLayout ? 32 : undefined}
      desktopContentEndGap={model.usesCapsuleLayout ? 0 : undefined}
      contentWidth={model.usesCapsuleLayout ? "fill" : "bounded"}
      userEmail={model.userEmail}
      userName={props.settingsProfile.fullname}
      settingsProfile={props.settingsProfile}
      onRemoveAccount={props.onDeleteProfile}
      onSaveSettings={props.onSaveSettings}
      onSignOut={props.onRequestSignOut}
      headerContent={({ isOverlaySidebar, openSidebar }) =>
        isOverlaySidebar ? (
          <AppShellMobileHeader
            {...props}
            activeCapsuleMeta={model.sidebarCapsuleMeta}
            activeOutfitMeta={model.sidebarOutfitMeta}
            openSidebar={openSidebar}
          />
        ) : null
      }
      sidebarBodyContent={(state) => (
        <AppShellSidebarBodyContent model={model} props={props} state={state} />
      )}
    >
      <SuspendedContent>{props.children}</SuspendedContent>
      <AppShellSidebarActionMenus model={model} props={props} />
      <AppShellSidebarSearchDialogs model={model} props={props} />
    </AppSidebarShell>
  );
}

function SuspendedContent({
  children,
}: {
  children: AppShellContentProps["children"];
}) {
  return <Suspense fallback={<RoutePanelFallback />}>{children}</Suspense>;
}

function AppShellSidebarBodyContent({
  model,
  props,
  state,
}: {
  model: SidebarPanelModel;
  props: AppShellContentProps;
  state: {
    closeSidebar: () => void;
    desktopSidebarRailWidth: number;
    expandCollapsedSidebar: () => void;
    isOverlaySidebar: boolean;
    isSidebarCollapsed: boolean;
  };
}) {
  return (
    <AppShellSidebarNavigationBody
      activeCapsuleMeta={model.sidebarCapsuleMeta}
      activeOutfitMeta={model.sidebarOutfitMeta}
      activeSidebarApp={model.activeSidebarApp}
      activeJobEntityKeys={model.activeJobEntityKeys}
      capsuleActionMenuControllerRef={model.capsuleActionMenuControllerRef}
      outfitActionMenuControllerRef={model.outfitActionMenuControllerRef}
      capsuleList={props.capsuleList}
      capsulePagination={props.capsulePagination}
      outfitList={props.outfitList || EMPTY_OUTFIT_LIST}
      outfitPagination={props.outfitPagination || EMPTY_OUTFIT_PAGINATION}
      closeSidebar={state.closeSidebar}
      desktopSidebarRailWidth={state.desktopSidebarRailWidth}
      expandCollapsedSidebar={state.expandCollapsedSidebar}
      highlightedCapsuleId={model.highlightedCapsuleId}
      highlightedOutfitId={model.highlightedOutfitId}
      isContentBusy={props.isContentBusy}
      isOverlaySidebar={state.isOverlaySidebar}
      isSidebarCollapsed={state.isSidebarCollapsed}
      onCreateCapsuleFromSidebar={props.onCreateCapsuleFromSidebar}
      onCreateOutfitFromSidebar={props.onCreateOutfitFromSidebar || noopAsync}
      onLoadMoreCapsules={props.onLoadMoreCapsules}
      onLoadMoreOutfits={props.onLoadMoreOutfits || noopAsync}
      onNavigateApp={props.onNavigateApp}
      onOpenCapsuleFromSidebar={props.onOpenCapsuleFromSidebar}
      onOpenOutfitFromSidebar={props.onOpenOutfitFromSidebar || noopAsync}
      onSearchCapsules={model.sidebarSearch.open}
      onSearchOutfits={model.outfitSidebarSearch.open}
      onSetCapsulePin={props.onSetCapsulePin}
      onSetOutfitPin={props.onSetOutfitPin || noopAsync}
      personalItemsCount={model.personalItemsCount}
    />
  );
}

function AppShellSidebarActionMenus({
  model,
  props,
}: {
  model: SidebarPanelModel;
  props: AppShellContentProps;
}) {
  return (
    <>
      <AppShellCapsuleActionMenu
        activeCapsuleMeta={props.activeCapsuleMeta}
        disabled={props.isContentBusy}
        isOverlay={!props.isLarge}
        onDeleteCapsule={props.onDeleteCapsule}
        onDownloadWardrobePdf={props.onDownloadWardrobePdf}
        onDuplicateCapsule={props.onDuplicateCapsule}
        onRegisterController={model.registerCapsuleActionMenuController}
        onRenameCapsule={props.onRenameCapsule}
        onRevertCapsule={props.onRevertCapsule}
        onSaveCapsule={props.onSaveCapsule}
        onSetCapsulePin={props.onSetCapsulePin}
        onShareCapsule={props.onShareCapsule}
      />
      <AppShellOutfitActionMenu
        activeOutfitMeta={props.activeOutfitMeta || null}
        disabled={props.isContentBusy}
        isOverlay={!props.isLarge}
        onDeleteOutfit={props.onDeleteOutfit || noopAsync}
        onDownloadOutfitPdf={props.onDownloadOutfitPdf || noopAsync}
        onDuplicateOutfit={props.onDuplicateOutfit || noopAsync}
        onRegisterController={model.registerOutfitActionMenuController}
        onRenameOutfit={props.onRenameOutfit || noopAsync}
        onRevertOutfit={props.onRevertOutfit || noopAsync}
        onSaveOutfit={props.onSaveOutfit || noopAsync}
        onSetOutfitPin={props.onSetOutfitPin || noopAsync}
      />
    </>
  );
}

function AppShellSidebarSearchDialogs({
  model,
  props,
}: {
  model: SidebarPanelModel;
  props: AppShellContentProps;
}) {
  return (
    <>
      <SearchDialog
        state={model.sidebarSearch.state}
        disabled={props.isContentBusy}
        isOverlay={!props.isLarge}
        setState={model.sidebarSearch.setState}
        onOpenCapsule={(capsuleId) => props.onOpenCapsuleFromSidebar(capsuleId)}
      />
      <SearchDialog
        state={model.outfitSidebarSearch.state}
        copyPrefix="outfit"
        disabled={props.isContentBusy}
        isOverlay={!props.isLarge}
        setState={model.outfitSidebarSearch.setState}
        onOpenCapsule={(outfitId) => props.onOpenOutfitFromSidebar?.(outfitId)}
      />
    </>
  );
}

export default AppShellSidebarPanel;
