import { Alert, Box, Stack } from "@mui/material";
import type { MouseEvent } from "react";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";
import CapsuleProductDetailDialog from "./mainScreen/CapsuleProductDetailDialog";
import WardrobeActionMenu from "./WardrobeActionMenu";
import WardrobeGrid from "./WardrobeGrid";
import {
  WardrobeProductMenu,
  WardrobeRemoveConfirmDialog,
} from "./WardrobeProductMenu";
import {
  WardrobeReportProgress,
  WardrobeReportSlots,
} from "./WardrobeReportSlots";
import {
  wardrobeContentSx,
  wardrobeScreenSx,
  wardrobeWithFloatingReportSx,
} from "./wardrobeScreenStyles";
import WardrobeToolbar from "./WardrobeToolbar";
import WardrobeUploadDialog from "./WardrobeUploadDialog";
import WardrobeUrlUploadDialog from "./WardrobeUrlUploadDialog";
import type {
  PersonalItemsReportModel,
  WardrobeFiltersModel,
  WardrobeItemsModel,
  WardrobeProductDetailModel,
} from "./WardrobeScreen";

type WardrobeScreenContentModel = {
  displayedItems: MainScreenItem[];
  filters: WardrobeFiltersModel;
  hasReportOrLoading: boolean;
  highlightedReportItemKeys: string[];
  isActionBusy: boolean;
  isOverlay: boolean;
  isUploadDialogOpen: boolean;
  isUrlUploadDialogOpen: boolean;
  locale: string;
  menuAnchor: HTMLElement | null;
  personalItemsReport: PersonalItemsReportModel;
  productDetail: WardrobeProductDetailModel;
  report: PersonalItemsReportModel["report"];
  reportError: string;
  showFloatingReportInspector: boolean;
  showInlineCompactReport: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
  wardrobeItems: WardrobeItemsModel;
};

type WardrobeScreenContentActions = {
  onCloseUploadDialog: () => void;
  onCloseUrlUploadDialog: () => void;
  onHighlightItemIds: (ids: string[]) => void;
  onMenuClose: () => void;
  onOpenMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenUpload: () => void;
  onOpenUrlUpload: () => void;
  onUploadImages: (files: File[]) => Promise<void>;
  onUploadUrls: (urls: string[]) => Promise<void>;
};

function WardrobeScreenContent({
  actions,
  model,
}: {
  actions: WardrobeScreenContentActions;
  model: WardrobeScreenContentModel;
}) {
  return (
    <Box
      data-testid="wardrobe-screen"
      sx={[
        wardrobeScreenSx,
        model.showFloatingReportInspector
          ? wardrobeWithFloatingReportSx
          : false,
      ]}
    >
      <Stack
        spacing={2.25}
        data-testid="wardrobe-content"
        sx={wardrobeContentSx}
      >
        <WardrobeScreenToolbar actions={actions} model={model} />
        <WardrobeReportProgress
          isPending={model.personalItemsReport.isReportPending}
          t={model.t}
        />
        <WardrobeScreenActionMenu
          anchorEl={model.menuAnchor}
          filters={model.filters}
          hasReport={model.hasReportOrLoading}
          isOverlay={model.isOverlay}
          isReportPending={model.personalItemsReport.isReportPending}
          wardrobeItems={model.wardrobeItems}
          onAnalyze={() => void model.personalItemsReport.generateReport()}
          onClose={actions.onMenuClose}
        />
        <WardrobeScreenAlerts model={model} />
        <WardrobeScreenReportAndGrid actions={actions} model={model} />
        <WardrobeScreenDialogs
          actions={actions}
          isOverlay={model.isOverlay}
          isUploadDialogOpen={model.isUploadDialogOpen}
          isUrlUploadDialogOpen={model.isUrlUploadDialogOpen}
          locale={model.locale}
          productDetail={model.productDetail}
          t={model.t}
          wardrobeItems={model.wardrobeItems}
        />
      </Stack>
    </Box>
  );
}

function WardrobeScreenToolbar({
  actions,
  model,
}: {
  actions: WardrobeScreenContentActions;
  model: WardrobeScreenContentModel;
}) {
  return (
    <WardrobeToolbar
      canAnalyze={model.wardrobeItems.items.length > 0}
      filter={model.filters.filter}
      hasReport={model.hasReportOrLoading}
      isMobile={model.isOverlay}
      likedOnly={model.filters.likedOnly}
      isLoading={model.isActionBusy}
      t={model.t}
      onAnalyze={() => void model.personalItemsReport.generateReport()}
      onFilterChange={model.filters.setFilter}
      onLikedOnlyChange={model.filters.setLikedOnly}
      onOpenMenu={actions.onOpenMenu}
      onOpenUpload={actions.onOpenUpload}
      onOpenUrlUpload={actions.onOpenUrlUpload}
    />
  );
}

function WardrobeScreenAlerts({
  model,
}: {
  model: WardrobeScreenContentModel;
}) {
  return (
    <>
      {model.wardrobeItems.error ? (
        <Alert severity="error">{model.wardrobeItems.error}</Alert>
      ) : null}
      {model.reportError ? (
        <Alert severity="error">{model.reportError}</Alert>
      ) : null}
    </>
  );
}

function WardrobeScreenReportAndGrid({
  actions,
  model,
}: {
  actions: WardrobeScreenContentActions;
  model: WardrobeScreenContentModel;
}) {
  return (
    <>
      <WardrobeReportSlots
        disabled={model.isActionBusy}
        isPending={model.personalItemsReport.isReportPending}
        isStale={model.personalItemsReport.stale}
        items={model.wardrobeItems.items}
        report={model.report}
        showFloatingReportInspector={model.showFloatingReportInspector}
        showInlineCompactReport={model.showInlineCompactReport}
        t={model.t}
        onDelete={model.personalItemsReport.deleteReport}
        onHighlightItemIds={actions.onHighlightItemIds}
        onRegenerate={model.personalItemsReport.generateReport}
      />
      <WardrobeGrid
        highlightedKeys={model.highlightedReportItemKeys}
        isLoading={model.wardrobeItems.isLoading}
        isOverlay={model.isOverlay}
        isFilteredEmpty={
          model.filters.likedOnly && model.wardrobeItems.items.length > 0
        }
        items={model.displayedItems}
        mobileColumns={model.filters.displayedColumns}
        t={model.t}
        onProductClick={model.productDetail.openProductDetail}
        onProductMenuOpen={model.wardrobeItems.handleProductMenuOpen}
      />
    </>
  );
}

function WardrobeScreenActionMenu({
  anchorEl,
  filters,
  hasReport,
  isOverlay,
  isReportPending,
  onAnalyze,
  onClose,
  wardrobeItems,
}: {
  anchorEl: HTMLElement | null;
  filters: WardrobeFiltersModel;
  hasReport: boolean;
  isOverlay: boolean;
  isReportPending: boolean;
  onAnalyze: () => void;
  onClose: () => void;
  wardrobeItems: WardrobeItemsModel;
}) {
  return (
    <WardrobeActionMenu
      anchorEl={anchorEl}
      canAnalyze={wardrobeItems.items.length > 0}
      disabled={
        wardrobeItems.isLoading ||
        wardrobeItems.isDownloadingPdf ||
        wardrobeItems.isUploading ||
        isReportPending
      }
      filter={filters.filter}
      hasReport={hasReport}
      isOverlay={isOverlay}
      likedOnly={filters.likedOnly}
      mobileCardColumns={filters.mobileColumns}
      onAnalyze={onAnalyze}
      onClose={onClose}
      onDownloadPdf={wardrobeItems.handleDownloadPdf}
      onFilterChange={filters.setFilter}
      onLikedOnlyChange={filters.setLikedOnly}
      onMobileCardColumnsChange={filters.updateColumns}
    />
  );
}

function WardrobeScreenDialogs({
  actions,
  isOverlay,
  isUploadDialogOpen,
  isUrlUploadDialogOpen,
  locale,
  productDetail,
  t,
  wardrobeItems,
}: {
  actions: WardrobeScreenContentActions;
  isOverlay: boolean;
  isUploadDialogOpen: boolean;
  isUrlUploadDialogOpen: boolean;
  locale: string;
  productDetail: WardrobeProductDetailModel;
  t: (key: string) => string;
  wardrobeItems: WardrobeItemsModel;
}) {
  return (
    <>
      <WardrobeProductMenu
        anchor={wardrobeItems.productMenu.anchor}
        item={wardrobeItems.productMenu.item}
        originRect={wardrobeItems.productMenu.originRect}
        presentation={wardrobeItems.productMenu.presentation}
        t={t}
        onClose={wardrobeItems.closeProductMenu}
        onRequestRemove={wardrobeItems.setRemoveConfirmItem}
        onSetItemLike={wardrobeItems.handleSetItemLike}
      />
      <WardrobeRemoveConfirmDialog
        item={wardrobeItems.removeConfirmItem}
        isLoading={wardrobeItems.isMutating}
        t={t}
        onClose={() => wardrobeItems.setRemoveConfirmItem(null)}
        onConfirm={wardrobeItems.handleConfirmRemove}
      />
      <WardrobeProductDetailDialog
        isOverlay={isOverlay}
        locale={locale}
        productDetail={productDetail}
        t={t}
        wardrobeItems={wardrobeItems}
      />
      <WardrobeUploadDialog
        open={isUploadDialogOpen}
        isMobile={isOverlay}
        isUploading={wardrobeItems.isUploading}
        progress={wardrobeItems.uploadProgress}
        t={t}
        onClose={actions.onCloseUploadDialog}
        onUpload={actions.onUploadImages}
      />
      <WardrobeUrlUploadDialog
        open={isUrlUploadDialogOpen}
        isMobile={isOverlay}
        isUploading={wardrobeItems.isUploading}
        progress={wardrobeItems.uploadProgress}
        t={t}
        onClose={actions.onCloseUrlUploadDialog}
        onUpload={actions.onUploadUrls}
      />
    </>
  );
}

function WardrobeProductDetailDialog({
  isOverlay,
  locale,
  productDetail,
  t,
  wardrobeItems,
}: {
  isOverlay: boolean;
  locale: string;
  productDetail: WardrobeProductDetailModel;
  t: (key: string) => string;
  wardrobeItems: WardrobeItemsModel;
}) {
  if (!productDetail.productDetailItem) return null;

  return (
    <CapsuleProductDetailDialog
      item={productDetail.productDetailItem}
      open={Boolean(productDetail.productDetailItem)}
      mode={productDetail.productDetailMode}
      isMobile={isOverlay}
      locale={locale}
      t={t}
      onApply={productDetail.handleApplyUploadedProductDetail}
      onClose={productDetail.closeProductDetail}
      onEdit={(item) => {
        productDetail.setProductDetailItem(item);
        productDetail.setProductDetailMode("edit");
      }}
      onReadMode={() => productDetail.setProductDetailMode("read")}
      onRemoveFromPersonalItems={wardrobeItems.handleConfirmRemove}
      onSetItemLike={productDetail.handleSetProductDetailItemLike}
    />
  );
}

export type { WardrobeScreenContentActions, WardrobeScreenContentModel };
export { WardrobeScreenContent };
