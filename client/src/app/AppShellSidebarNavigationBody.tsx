import { Box } from "@mui/material";
import type { RefObject } from "react";
import AppSidebarNavigation from "../components/AppSidebarNavigation";
import type {
  AppId,
  AppSidebarNavigationProps,
} from "../components/AppSidebarNavigationTypes";
import type { AppShellCapsuleActionMenuController } from "./AppShellCapsuleActionMenu";
import type { AppShellOutfitActionMenuController } from "./AppShellOutfitActionMenu";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleMeta,
  CapsulePagination,
  OutfitMeta,
} from "./appTypes";

type AppShellSidebarNavigationBodyProps = {
  activeCapsuleMeta: CapsuleMeta | null;
  activeOutfitMeta: OutfitMeta | null;
  activeSidebarApp: AppId;
  capsuleActionMenuControllerRef: RefObject<AppShellCapsuleActionMenuController | null>;
  outfitActionMenuControllerRef: RefObject<AppShellOutfitActionMenuController | null>;
  capsuleList: CapsuleMeta[];
  capsulePagination: CapsulePagination;
  outfitList: OutfitMeta[];
  outfitPagination: CapsulePagination;
  closeSidebar: () => void;
  desktopSidebarRailWidth: number;
  expandCollapsedSidebar: () => void;
  highlightedCapsuleId: string;
  highlightedOutfitId: string;
  isContentBusy: boolean;
  isOverlaySidebar: boolean;
  isSidebarCollapsed: boolean;
  onCreateCapsuleFromSidebar: (onComplete?: () => void) => Promise<void>;
  onCreateOutfitFromSidebar: (onComplete?: () => void) => Promise<void>;
  onLoadMoreCapsules: () => Promise<void>;
  onLoadMoreOutfits: () => Promise<void>;
  onNavigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  onOpenCapsuleFromSidebar: (
    capsuleId: string,
    onComplete?: () => void,
  ) => Promise<void>;
  onOpenOutfitFromSidebar: (
    outfitId: string,
    onComplete?: () => void,
  ) => Promise<void>;
  onSearchCapsules: () => void;
  onSearchOutfits: () => void;
  onSetCapsulePin: (
    capsuleId: string | undefined,
    pin: boolean,
  ) => Promise<void>;
  onSetOutfitPin: (outfitId: string | undefined, pin: boolean) => Promise<void>;
  personalItemsCount?: number | null;
};

function hasUnsavedCapsuleChanges(capsule: CapsuleMeta | null | undefined) {
  return capsule?.status === "new" || capsule?.status === "modified";
}

function getOverlayCompletion(
  isOverlaySidebar: boolean,
  closeSidebar: () => void,
) {
  return isOverlaySidebar ? closeSidebar : undefined;
}

function SidebarExpandHitbox({ onClick }: { onClick: () => void }) {
  return (
    <Box
      data-testid="collapsed-sidebar-expand-hitbox"
      onClick={onClick}
      sx={{ flex: 1, minHeight: 0, cursor: "pointer" }}
    />
  );
}

function buildNavigationHandlers({
  capsuleActionMenuControllerRef,
  closeSidebar,
  isOverlaySidebar,
  onOpenCapsuleFromSidebar,
  onOpenOutfitFromSidebar,
  onSetCapsulePin,
  onSetOutfitPin,
  outfitActionMenuControllerRef,
}: Pick<
  AppShellSidebarNavigationBodyProps,
  | "capsuleActionMenuControllerRef"
  | "closeSidebar"
  | "isOverlaySidebar"
  | "onOpenCapsuleFromSidebar"
  | "onOpenOutfitFromSidebar"
  | "onSetCapsulePin"
  | "onSetOutfitPin"
  | "outfitActionMenuControllerRef"
>) {
  const overlayCompletion = getOverlayCompletion(
    isOverlaySidebar,
    closeSidebar,
  );
  const onOpenCapsuleActions: NonNullable<
    AppSidebarNavigationProps["onOpenCapsuleActions"]
  > = (event, capsule) =>
    capsuleActionMenuControllerRef.current?.openCapsuleActions(event, capsule);
  const onOpenOutfitActions: NonNullable<
    AppSidebarNavigationProps["onOpenOutfitActions"]
  > = (event, outfit) =>
    outfitActionMenuControllerRef.current?.openOutfitActions(event, outfit);

  return {
    onOpenCapsule: (capsuleId: string) =>
      void onOpenCapsuleFromSidebar(capsuleId, overlayCompletion),
    onOpenOutfit: (outfitId: string) =>
      void onOpenOutfitFromSidebar(outfitId, overlayCompletion),
    onOpenCapsuleActions,
    onOpenOutfitActions,
    onSetCapsulePin: (capsuleId: string | undefined, pin: boolean) =>
      void onSetCapsulePin(capsuleId, pin),
    onSetOutfitPin: (outfitId: string | undefined, pin: boolean) =>
      void onSetOutfitPin(outfitId, pin),
    overlayCompletion,
  };
}

export default function AppShellSidebarNavigationBody({
  activeCapsuleMeta,
  activeOutfitMeta,
  activeSidebarApp,
  capsuleActionMenuControllerRef,
  outfitActionMenuControllerRef,
  capsuleList,
  capsulePagination,
  outfitList,
  outfitPagination,
  closeSidebar,
  desktopSidebarRailWidth,
  expandCollapsedSidebar,
  highlightedCapsuleId,
  highlightedOutfitId,
  isContentBusy,
  isOverlaySidebar,
  isSidebarCollapsed,
  onCreateCapsuleFromSidebar,
  onCreateOutfitFromSidebar,
  onLoadMoreCapsules,
  onLoadMoreOutfits,
  onNavigateApp,
  onOpenCapsuleFromSidebar,
  onOpenOutfitFromSidebar,
  onSearchCapsules,
  onSearchOutfits,
  onSetCapsulePin,
  onSetOutfitPin,
  personalItemsCount,
}: AppShellSidebarNavigationBodyProps) {
  const navigationHandlers = buildNavigationHandlers({
    capsuleActionMenuControllerRef,
    closeSidebar,
    isOverlaySidebar,
    onOpenCapsuleFromSidebar,
    onOpenOutfitFromSidebar,
    onSetCapsulePin,
    onSetOutfitPin,
    outfitActionMenuControllerRef,
  });

  return (
    <AppSidebarNavigation
      activeApp={activeSidebarApp}
      isOverlaySidebar={isOverlaySidebar}
      isSidebarCollapsed={isSidebarCollapsed}
      desktopSidebarRailWidth={desktopSidebarRailWidth}
      isInteractionDisabled={activeSidebarApp === "capsule" && isContentBusy}
      personalItemsCount={personalItemsCount}
      capsuleList={capsuleList}
      capsulePagination={capsulePagination}
      outfitList={outfitList}
      outfitPagination={outfitPagination}
      activeCapsuleId={highlightedCapsuleId}
      activeCapsule={activeCapsuleMeta}
      activeOutfitId={highlightedOutfitId}
      activeOutfit={activeOutfitMeta}
      onNavigateApp={onNavigateApp}
      onLoadMoreCapsules={onLoadMoreCapsules}
      onLoadMoreOutfits={onLoadMoreOutfits}
      onCreateCapsule={async () => {
        await onCreateCapsuleFromSidebar(navigationHandlers.overlayCompletion);
      }}
      onCreateOutfit={async () => {
        await onCreateOutfitFromSidebar(navigationHandlers.overlayCompletion);
      }}
      onSearchCapsules={onSearchCapsules}
      onSearchOutfits={onSearchOutfits}
      onOpenCapsule={navigationHandlers.onOpenCapsule}
      onOpenOutfit={navigationHandlers.onOpenOutfit}
      onOpenCapsuleActions={navigationHandlers.onOpenCapsuleActions}
      onOpenOutfitActions={navigationHandlers.onOpenOutfitActions}
      onSetCapsulePin={navigationHandlers.onSetCapsulePin}
      onSetOutfitPin={navigationHandlers.onSetOutfitPin}
      capsuleHasUnsavedChanges={hasUnsavedCapsuleChanges}
      outfitHasUnsavedChanges={hasUnsavedCapsuleChanges}
      onExpandedAction={navigationHandlers.overlayCompletion}
      collapsedExpandHitbox={
        <SidebarExpandHitbox onClick={expandCollapsedSidebar} />
      }
    />
  );
}
