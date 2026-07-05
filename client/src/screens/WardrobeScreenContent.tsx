import { Alert, Box, Stack } from "@mui/material";
import type { Dispatch, MouseEvent, RefObject, SetStateAction } from "react";
import type { UploadedWardrobeItemUpdatePayload } from "../api/personalItems";
import type {
  MainScreenItem,
  MobileCardColumns,
} from "./mainScreen/MainScreenTypes";
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
import type { WardrobeFilter } from "./WardrobeToolbar";
import WardrobeUploadDialog from "./WardrobeUploadDialog";
import WardrobeUrlUploadDialog from "./WardrobeUrlUploadDialog";
import type { ProductDetailMode } from "./wardrobeScreenTypes";
import type { usePersonalItemsReport } from "./usePersonalItemsReport";
import type { useWardrobeItems } from "./useWardrobeItems";

type WardrobeItemsModel = ReturnType<typeof useWardrobeItems>;
type PersonalItemsReportModel = ReturnType<typeof usePersonalItemsReport>;

type WardrobeFiltersModel = {
  displayedColumns: MobileCardColumns;
  displayedItems: (items: MainScreenItem[]) => MainScreenItem[];
  filter: WardrobeFilter;
  likedOnly: boolean;
  mobileColumns: MobileCardColumns;
  setFilter: Dispatch<SetStateAction<WardrobeFilter>>;
  setLikedOnly: Dispatch<SetStateAction<boolean>>;
  updateColumns: (value: MobileCardColumns) => void;
};

type WardrobeProductDetailModel = {
  closeProductDetail: () => void;
  handleApplyUploadedProductDetail: (
    item: MainScreenItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => Promise<void>;
  handleSetProductDetailItemLike: (
    item: MainScreenItem,
    isLiked: boolean,
  ) => Promise<void>;
  openProductDetail: (item: MainScreenItem) => void;
  productDetailItem: MainScreenItem | null;
  productDetailMode: ProductDetailMode;
  setProductDetailItem: Dispatch<SetStateAction<MainScreenItem | null>>;
  setProductDetailMode: Dispatch<SetStateAction<ProductDetailMode>>;
};

type WardrobeScreenContentModel = {
  canAnalyze: boolean;
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
  scrollContainerRef: RefObject<HTMLElement | null>;
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
      ref={model.scrollContainerRef}
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
          canAnalyze={model.canAnalyze}
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
      canAnalyze={model.canAnalyze}
      filter={model.filters.filter}
      hasReport={model.hasReportOrLoading}
      isMobile={model.isOverlay}
      limitSurfaceEnd={model.showFloatingReportInspector}
      likedOnly={model.filters.likedOnly}
      isLoading={model.isActionBusy}
      showProgress={model.wardrobeItems.isDownloadingPdf}
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
        items={model.wardrobeItems.knownItems}
        report={model.report}
        showFloatingReportInspector={model.showFloatingReportInspector}
        showInlineCompactReport={model.showInlineCompactReport}
        t={model.t}
        onDelete={model.personalItemsReport.deleteReport}
        onHighlightItemIds={actions.onHighlightItemIds}
        onRegenerate={model.personalItemsReport.generateReport}
      />
      <WardrobeGrid
        hasMore={model.wardrobeItems.hasMore}
        highlightedKeys={model.highlightedReportItemKeys}
        isLoading={model.wardrobeItems.isLoading}
        isLoadingMore={model.wardrobeItems.isLoadingMore}
        isOverlay={model.isOverlay}
        isFilteredEmpty={
          model.filters.likedOnly && model.wardrobeItems.knownItems.length > 0
        }
        items={model.displayedItems}
        mobileColumns={model.filters.displayedColumns}
        scrollContainerRef={model.scrollContainerRef}
        t={model.t}
        onLoadMore={model.wardrobeItems.loadMore}
        onProductClick={model.productDetail.openProductDetail}
        onProductMenuOpen={model.wardrobeItems.handleProductMenuOpen}
      />
    </>
  );
}

function WardrobeScreenActionMenu({
  anchorEl,
  canAnalyze,
  filters,
  hasReport,
  isOverlay,
  isReportPending,
  onAnalyze,
  onClose,
  wardrobeItems,
}: {
  anchorEl: HTMLElement | null;
  canAnalyze: boolean;
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
      canAnalyze={canAnalyze}
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

export type {
  PersonalItemsReportModel,
  WardrobeFiltersModel,
  WardrobeItemsModel,
};
export { WardrobeScreenContent };
