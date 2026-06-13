/* eslint-disable complexity, max-lines, max-lines-per-function */
import { useMemo, useState, type MouseEvent } from "react";
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
import CapsuleReportPanel from "./CapsuleReportPanel";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "./MainScreenHelpers";
import type { MainScreenItem } from "./MainScreenTypes";
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

const CAPSULE_REPORT_FLOATING_WIDTH_LG = 380;
const CAPSULE_REPORT_FLOATING_WIDTH_XL = 420;
const CAPSULE_REPORT_FLOATING_GAP = 24;
const CAPSULE_REPORT_FLOATING_INSET_LG = 16;
const CAPSULE_REPORT_FLOATING_INSET_XL = 24;

const capsuleReportFloatingInspectorSx = {
  position: "fixed",
  top: { lg: 16, xl: 20 },
  right: { lg: 16, xl: 24 },
  bottom: { lg: 16, xl: 20 },
  width: {
    lg: CAPSULE_REPORT_FLOATING_WIDTH_LG,
    xl: CAPSULE_REPORT_FLOATING_WIDTH_XL,
  },
  maxWidth: "calc(100% - 32px)",
  minHeight: 0,
  zIndex: 2,
} as const;

const capsuleWithFloatingReportSx = {
  pr: {
    lg: `${CAPSULE_REPORT_FLOATING_WIDTH_LG + CAPSULE_REPORT_FLOATING_GAP + CAPSULE_REPORT_FLOATING_INSET_LG}px`,
    xl: `${CAPSULE_REPORT_FLOATING_WIDTH_XL + CAPSULE_REPORT_FLOATING_GAP + CAPSULE_REPORT_FLOATING_INSET_XL}px`,
  },
} as const;

const capsuleReportCompactSectionSx = {
  px: { xs: 1, sm: 2, md: 3 },
  pt: { xs: 1, md: 2 },
} as const;

function getTrimmedString(value: unknown) {
  return String(value ?? "").trim();
}

function getWardrobeItemKey(item: MainScreenItem) {
  return getTrimmedString(item?.url || item?.id);
}

function isWardrobeReportItem(item: MainScreenItem) {
  return (
    getTrimmedString(item?.source) === "uploaded" ||
    Boolean(
      getTrimmedString(item?.wardrobeId) ||
      getTrimmedString(item?.profileEmail) ||
      getTrimmedString(item?.itemSource) === "wardrobe",
    )
  );
}

function addReportCandidateId(ids: Set<string>, value: unknown) {
  const id = getTrimmedString(value);
  if (id) {
    ids.add(id);
  }
  return id;
}

function getCapsuleReportItemCandidateIds(item: MainScreenItem) {
  const ids = new Set<string>();
  const itemId = addReportCandidateId(ids, item?.id);
  const wardrobeId = addReportCandidateId(ids, item?.wardrobeId);
  addReportCandidateId(ids, item?.url);

  if (isWardrobeReportItem(item)) {
    for (const id of [itemId, wardrobeId]) {
      if (id) {
        ids.add(id.startsWith("W") ? id : `W${id}`);
      }
    }
  }

  return [...ids];
}

function getHighlightedCapsuleReportItemKeys(
  items: MainScreenItem[],
  reportItemIds: string[],
) {
  const targetIds = new Set(
    reportItemIds.map((value) => getTrimmedString(value)).filter(Boolean),
  );
  if (!targetIds.size) return [];

  return items
    .filter((item) =>
      getCapsuleReportItemCandidateIds(item).some((candidate) =>
        targetIds.has(candidate),
      ),
    )
    .map(getWardrobeItemKey)
    .filter(Boolean);
}

function CapsuleStickyHeader(model: MainScreenViewProps) {
  const { activeName, resolvedSets, summary } = model.display;
  const hasReport = Boolean(model.props.activeCapsule?.effective?.report);
  const canAnalyze = Boolean(
    model.props.activeCapsule?.id && model.props.items.length > 0,
  );

  return (
    <Box sx={capsuleStickyHeaderSx}>
      <Box sx={MAIN_SCREEN_CONTENT_COLUMN_SX}>
        <MainScreenHeader
          activeCapsule={model.props.activeCapsule}
          activeName={activeName}
          disabled={model.interactionDisabled}
          inlineRename={model.inlineRename}
          isOverlay={model.isOverlaySidebar}
          hasReport={hasReport}
          canAnalyze={canAnalyze}
          selectedCount={model.selectedCount}
          summary={summary}
          onAnalyze={() =>
            void model.props.onGenerateCapsuleReport?.(
              model.props.activeCapsule?.id,
            )
          }
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
          <LinearProgress
            color="success"
            aria-label={
              model.props.isCapsuleReportPending
                ? model.t("capsule.reportGenerating")
                : undefined
            }
            sx={capsuleProgressSx}
          />
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
  position: "relative",
} as const;

function MainScreenCapsulePanel(model: MainScreenViewProps) {
  const { activeImageSrc, activeSet, visibleItems } = model.display;
  const [highlightedReportItemIds, setHighlightedReportItemIds] = useState<
    string[]
  >([]);
  const report = model.props.activeCapsule?.effective?.report || null;
  const reportIsStale = Boolean(
    model.props.activeCapsule?.effective?.reportMeta?.stale,
  );
  const showFloatingReportInspector = Boolean(
    report && !model.isOverlaySidebar,
  );
  const showInlineCompactReport = Boolean(
    report && !showFloatingReportInspector,
  );
  const highlightedReportItemKeys = useMemo(
    () =>
      getHighlightedCapsuleReportItemKeys(
        visibleItems,
        highlightedReportItemIds,
      ),
    [highlightedReportItemIds, visibleItems],
  );
  return (
    <Box
      {...primaryScrollTargetAttribute}
      sx={[
        capsulePanelSx,
        showFloatingReportInspector && capsuleWithFloatingReportSx,
      ]}
    >
      <CapsuleStickyHeader {...model} />
      <Box sx={capsuleScrollAreaSx}>
        {showInlineCompactReport ? (
          <Box sx={capsuleReportCompactSectionSx}>
            <CapsuleReportPanel
              disabled={model.interactionDisabled}
              isCompact
              isPending={model.props.isCapsuleReportPending}
              isStale={reportIsStale}
              report={report}
              t={model.t}
              onDelete={() =>
                void model.props.onDeleteCapsuleReport?.(
                  model.props.activeCapsule?.id,
                )
              }
              onHighlightItemIds={setHighlightedReportItemIds}
              onRegenerate={() =>
                void model.props.onGenerateCapsuleReport?.(
                  model.props.activeCapsule?.id,
                )
              }
            />
          </Box>
        ) : null}
        <MainScreenWardrobe
          activeImageSrc={activeImageSrc}
          activeSet={activeSet}
          disabled={model.interactionDisabled}
          highlightedKeys={highlightedReportItemKeys}
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
      {showFloatingReportInspector ? (
        <Box
          data-testid="capsule-report-floating-inspector"
          sx={capsuleReportFloatingInspectorSx}
        >
          <CapsuleReportPanel
            disabled={model.interactionDisabled}
            isPending={model.props.isCapsuleReportPending}
            isStale={reportIsStale}
            report={report}
            t={model.t}
            onDelete={() =>
              void model.props.onDeleteCapsuleReport?.(
                model.props.activeCapsule?.id,
              )
            }
            onHighlightItemIds={setHighlightedReportItemIds}
            onRegenerate={() =>
              void model.props.onGenerateCapsuleReport?.(
                model.props.activeCapsule?.id,
              )
            }
          />
        </Box>
      ) : null}
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
