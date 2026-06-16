import { List } from "@mui/material";
import {
  CapsuleSection,
  CatalogSection,
  OutfitsSection,
  PersonalItemsRow,
} from "./AppSidebarNavigationSections";
import type { AppSidebarNavigationModel } from "./AppSidebarNavigationModel";

function SidebarPersonalItemsRow({
  model,
}: {
  model: AppSidebarNavigationModel;
}) {
  return (
    <PersonalItemsRow
      activeApp={model.activeApp}
      desktopSidebarRailWidth={model.desktopSidebarRailWidth}
      handleNavigateApp={model.handleNavigateApp}
      isCollapsedDesktop={model.isCollapsedDesktop}
      isInteractionDisabled={model.isInteractionDisabled}
      personalItemsCount={model.personalItemsCount}
      t={model.t}
    />
  );
}

function SidebarOutfitsSection({
  model,
}: {
  model: AppSidebarNavigationModel;
}) {
  return (
    <OutfitsSection
      activeApp={model.activeApp}
      activeOutfit={model.activeOutfit}
      activeOutfitId={model.activeOutfitId}
      desktopSidebarRailWidth={model.desktopSidebarRailWidth}
      handleLoadMoreOutfits={model.handleLoadMoreOutfits}
      isExpanded={model.expandedSections.outfits}
      isCollapsedDesktop={model.isCollapsedDesktop}
      isInteractionDisabled={model.isInteractionDisabled}
      isLoadingMore={model.isLoadingMoreOutfits}
      isOverlaySidebar={model.isOverlaySidebar}
      navState={model.outfitNavState}
      onCreateOutfit={model.onCreateOutfit}
      onOpenOutfit={model.onOpenOutfit}
      onOpenOutfitActions={model.onOpenOutfitActions}
      onSearchOutfits={model.onSearchOutfits}
      onSetOutfitPin={model.onSetOutfitPin}
      onToggle={() => model.onToggleSection("outfits")}
      outfitHasUnsavedChanges={model.outfitHasUnsavedChanges}
      t={model.t}
    />
  );
}

function SidebarCapsuleSection({
  model,
}: {
  model: AppSidebarNavigationModel;
}) {
  return (
    <CapsuleSection
      activeApp={model.activeApp}
      activeCapsule={model.activeCapsule}
      activeCapsuleId={model.activeCapsuleId}
      capsuleHasUnsavedChanges={model.capsuleHasUnsavedChanges}
      desktopSidebarRailWidth={model.desktopSidebarRailWidth}
      handleLoadMoreCapsules={model.handleLoadMoreCapsules}
      isExpanded={model.expandedSections.capsules}
      isCollapsedDesktop={model.isCollapsedDesktop}
      isInteractionDisabled={model.isInteractionDisabled}
      isLoadingMore={model.isLoadingMore}
      isOverlaySidebar={model.isOverlaySidebar}
      navState={model.navState}
      onCreateCapsule={model.onCreateCapsule}
      onOpenCapsule={model.onOpenCapsule}
      onOpenCapsuleActions={model.onOpenCapsuleActions}
      onSearchCapsules={model.onSearchCapsules}
      onSetCapsulePin={model.onSetCapsulePin}
      onToggle={() => model.onToggleSection("capsules")}
      t={model.t}
    />
  );
}

function SidebarCatalogSection({
  model,
}: {
  model: AppSidebarNavigationModel;
}) {
  return (
    <CatalogSection
      activeApp={model.activeApp}
      desktopSidebarRailWidth={model.desktopSidebarRailWidth}
      handleNavigateApp={model.handleNavigateApp}
      isExpanded={model.expandedSections.catalog}
      isCollapsedDesktop={model.isCollapsedDesktop}
      isInteractionDisabled={model.isInteractionDisabled}
      onToggle={() => model.onToggleSection("catalog")}
      t={model.t}
    />
  );
}

function AppSidebarNavigationList({
  model,
}: {
  model: AppSidebarNavigationModel;
}) {
  return (
    <List
      data-testid="sidebar-navigation-list"
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: model.isCollapsedDesktop ? "hidden" : "auto",
        px: model.isCollapsedDesktop ? 0 : 1.5,
        py: 0.5,
      }}
    >
      <SidebarPersonalItemsRow model={model} />
      <SidebarOutfitsSection model={model} />
      <SidebarCapsuleSection model={model} />
      <SidebarCatalogSection model={model} />
    </List>
  );
}

export default AppSidebarNavigationList;
