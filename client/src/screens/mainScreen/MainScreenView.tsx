import type { MouseEvent } from "react";
import { Box, Divider, LinearProgress } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import {
  CopyOutfitActionRow,
  CopyOutfitFeedbackSnackbar,
} from "./MainScreenCopyOutfit";
import MainScreenDialogs from "./MainScreenDialogs";
import MainScreenHeader from "./MainScreenHeader";
import MainScreenMenus from "./MainScreenMenus";
import MainScreenSidebar from "./MainScreenSidebar";
import MainScreenTabs from "./MainScreenTabs";
import MainScreenWardrobe from "./MainScreenWardrobe";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "./MainScreenHelpers";
import type { MainScreenViewProps } from "./MainScreenViewTypes";

const capsulePanelSx = {
  alignSelf: "stretch",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  maxHeight: "100%",
  width: "100%",
  minWidth: 0,
  minHeight: 0,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehaviorY: "contain",
  WebkitOverflowScrolling: "touch",
  backgroundColor: "transparent",
} as const;

const primaryScrollTargetAttribute = {
  "data-app-primary-scroll-target": "true",
} as const;

const capsuleStickyHeaderSx = (theme: Theme) => {
  return {
    position: "sticky",
    top: 0,
    zIndex: theme.zIndex.appBar,
    flexShrink: 0,
    backgroundColor: "background.default",
  };
};

const capsuleProgressSlotSx = {
  height: 2,
  overflow: "hidden",
  flexShrink: 0,
} as const;

const capsuleProgressSx = {
  height: 2,
} as const;

const capsuleScrollAreaSx = {
  flex: 1,
  minHeight: 0,
  maxHeight: "100%",
  width: "100%",
  overflow: "visible",
} as const;

function CapsuleStickyHeader(model: MainScreenViewProps) {
  const { activeName, resolvedSets, summary } = model.display;

  return (
    <Box sx={capsuleStickyHeaderSx}>
      <Box sx={MAIN_SCREEN_CONTENT_COLUMN_SX}>
        <MainScreenHeader
          activeCapsule={model.props.activeCapsule}
          activeName={activeName}
          disabled={model.interactionDisabled}
          inlineRename={model.inlineRename}
          isOverlay={model.isOverlaySidebar}
          selectedCount={model.selectedCount}
          summary={summary}
          onCancelSelection={model.props.onCancelRegenerationSelection}
          onOpenFilters={() => model.setFiltersOpen(true)}
          onOpenMenu={(event: MouseEvent<HTMLElement>) =>
            model.setHeaderMenuAnchor(event.currentTarget)
          }
          onRegenerateAll={model.requestRegenerateAll}
          onRegenerateSelected={model.props.onRegenerateSelectedItems}
          regenerateAllDisabled={model.isRegenerateAllDisabled}
        />
        <MainScreenTabs
          activeTab={model.activeTab}
          disabled={model.interactionDisabled}
          isOverlay={model.isOverlaySidebar}
          selectedCount={model.selectedCount}
          sets={resolvedSets}
          summary={summary}
          onChange={model.setActiveTab}
        />
        <Divider />
        <CopyOutfitActionRow {...model} />
      </Box>
      <Box sx={capsuleProgressSlotSx}>
        {model.props.isContentBusy || model.share.loading ? (
          <LinearProgress color="success" sx={capsuleProgressSx} />
        ) : null}
      </Box>
    </Box>
  );
}

function MainScreenView(model: MainScreenViewProps) {
  return (
    <>
      <MainScreenBody {...model} />
      <CopyOutfitFeedbackSnackbar {...model} />
      <MainScreenMenus
        activeName={model.display.activeName}
        disabled={model.interactionDisabled}
        headerMenuAnchor={model.headerMenuAnchor}
        isOverlay={model.isOverlaySidebar}
        mobileColumns={model.mobileColumns}
        productMenu={model.productMenu}
        props={model.props}
        rowMenuAnchor={model.rowMenuAnchor}
        rowMenuCapsule={model.rowMenuCapsule}
        setConfirm={model.setConfirm}
        setHeaderMenuAnchor={model.setHeaderMenuAnchor}
        setNameDialog={model.setNameDialog}
        setProductMenu={model.setProductMenu}
        setRowMenuAnchor={model.setRowMenuAnchor}
        setRowMenuCapsule={model.setRowMenuCapsule}
        setSelectionMode={model.setSelectionMode}
        onRegenerateAll={model.requestRegenerateAll}
        onShareCapsule={model.shareCapsule}
        onUpdateColumns={model.updateColumns}
        t={model.t}
      />
    </>
  );
}

function MainScreenBody(model: MainScreenViewProps) {
  return (
    <Box sx={mainScreenBodySx}>
      <MainScreenSidebar
        props={model.props}
        disabled={model.interactionDisabled}
        isSigningOut={model.props.isSigningOut}
      />
      <MainScreenCapsulePanel {...model} />
      <MainScreenDialogsPanel {...model} />
    </Box>
  );
}

const mainScreenBodySx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
  gap: { xs: 3, lg: "40px" },
  flex: 1,
  height: "100%",
  width: "100%",
  minWidth: 0,
  minHeight: 0,
  overflow: "visible",
} as const;

function MainScreenCapsulePanel(model: MainScreenViewProps) {
  const { activeImageSrc, activeSet, visibleItems } = model.display;
  return (
    <Box {...primaryScrollTargetAttribute} sx={capsulePanelSx}>
      <CapsuleStickyHeader {...model} />
      <Box sx={capsuleScrollAreaSx}>
        <MainScreenWardrobe
          activeImageSrc={activeImageSrc}
          activeSet={activeSet}
          disabled={model.interactionDisabled}
          isImagePending={Boolean(
            activeSet &&
            model.props.pendingImageSetIndexes?.includes(activeSet.index),
          )}
          isLoading={model.props.isLoadingItems}
          isOverlay={model.isOverlaySidebar}
          mobileColumns={model.mobileColumns}
          partialPendingUrls={model.props.partialRegenerationPendingUrls}
          selectedAnchorItemRefs={model.props.selectedAnchorItemRefs}
          selectedUrls={model.props.selectedRegenerationUrls}
          selectionMode={model.selectionMode || model.selectedCount > 0}
          showAdditionalItemPlaceholder={
            model.props.showAdditionalItemPlaceholder
          }
          visibleItems={visibleItems}
          onDeleteImage={(index) =>
            model.setConfirm({
              action: "delete-outfit-set-image",
              capsuleId: "",
              outfitSetIndex: index,
            })
          }
          onGenerateImage={model.props.onGenerateOutfitSetImage}
          onImageClick={() => model.setImageDialogOpen(true)}
          onProductClick={model.setProductDetailItem}
          onProductMenuOpen={(anchor, url, item, options) =>
            model.setProductMenu({
              anchor,
              url,
              item,
              presentation: options.presentation,
              ...(options.originRect ? { originRect: options.originRect } : {}),
            })
          }
          onToggleSelected={model.props.onToggleRegenerationSelection}
        />
      </Box>
    </Box>
  );
}

function MainScreenDialogsPanel(model: MainScreenViewProps) {
  return (
    <MainScreenDialogs
      activeName={model.display.activeName}
      activeImageSrc={model.display.activeImageSrc}
      activeSet={model.display.activeSet}
      activeSetLabel={model.display.activeSet?.label}
      confirm={model.confirm}
      copyOutfitDialog={model.copyOutfitDialog}
      filtersOpen={model.filtersOpen}
      imageDialogOpen={model.imageDialogOpen}
      interactionDisabled={model.interactionDisabled}
      isOverlay={model.isOverlaySidebar}
      nameDialog={model.nameDialog}
      productDetailItem={model.productDetailItem}
      props={model.props}
      search={model.search}
      share={model.share}
      setConfirm={model.setConfirm}
      setCopyOutfitDialog={model.setCopyOutfitDialog}
      setFiltersOpen={model.setFiltersOpen}
      setImageDialogOpen={model.setImageDialogOpen}
      setNameDialog={model.setNameDialog}
      setProductDetailItem={model.setProductDetailItem}
      setSearch={model.setSearch}
      setShare={model.setShare}
      onOpenCapsule={model.props.onOpenCapsule}
      onCopyOutfitSuccess={model.setCopiedOutfit}
      onCloseRowMenu={() => {
        model.setRowMenuAnchor(null);
        model.setRowMenuCapsule(null);
      }}
    />
  );
}

export default MainScreenView;
