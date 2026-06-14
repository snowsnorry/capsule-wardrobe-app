import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Alert, Box, Stack } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { type UploadedWardrobeItemUpdatePayload } from "../api/personalItems";
import { useI18n } from "../i18n/useI18n";
import { isUploadedWardrobeItemNeedsReview } from "../utils/uploadedWardrobeItemStatus";
import {
  getCanonicalItemUrl,
  isLikedItem,
  patchLikedStateByUrl,
} from "../utils/likedItemState";
import type {
  MainScreenItem,
  MobileCardColumns,
} from "./mainScreen/MainScreenTypes";
import WardrobeActionMenu from "./WardrobeActionMenu";
import {
  readStoredWardrobeFilters,
  readStoredWardrobeMobileCardColumns,
  writeStoredWardrobeFilters,
  writeStoredWardrobeMobileCardColumns,
} from "./WardrobeCardLayoutStorage";
import WardrobeGrid from "./WardrobeGrid";
import {
  WardrobeProductMenu,
  WardrobeRemoveConfirmDialog,
} from "./WardrobeProductMenu";
import CapsuleProductDetailDialog from "./mainScreen/CapsuleProductDetailDialog";
import WardrobeUploadDialog from "./WardrobeUploadDialog";
import WardrobeUrlUploadDialog from "./WardrobeUrlUploadDialog";
import WardrobeToolbar, {
  getSourceFilter,
  type WardrobeFilter,
} from "./WardrobeToolbar";
import { filterWardrobeItemsBySource } from "./wardrobeItemMappers";
import { wardrobeContentSx, wardrobeScreenSx } from "./wardrobeScreenStyles";
import type { ProductDetailMode } from "./wardrobeScreenTypes";
import { useWardrobeItems } from "./useWardrobeItems";

function WardrobeScreen(): ReactElement {
  const { t, locale } = useI18n();
  const isOverlay = useMediaQuery("(max-width: 1279.95px)");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUrlUploadDialogOpen, setIsUrlUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const filters = useWardrobeScreenFilters(isOverlay);
  const wardrobeItems = useWardrobeItems(filters.filter, refreshKey, t);
  const productDetail = useWardrobeProductDetailState(wardrobeItems);
  const completeUpload = (closeDialog: () => void) => {
    handleUploadSuccess(filters.setFilter, filters.setLikedOnly);
    setRefreshKey((current) => current + 1);
    closeDialog();
  };

  const handleUploadImages = async (files: File[]) => {
    const uploaded = await wardrobeItems.handleUploadImages(files);
    if (uploaded) {
      completeUpload(() => setIsUploadDialogOpen(false));
    }
  };
  const handleUploadUrls = async (urls: string[]) => {
    const uploaded = await wardrobeItems.handleUploadUrls(urls);
    if (uploaded) {
      completeUpload(() => setIsUrlUploadDialogOpen(false));
    }
  };

  return (
    <Box data-testid="wardrobe-screen" sx={wardrobeScreenSx}>
      <Stack
        spacing={2.25}
        data-testid="wardrobe-content"
        sx={wardrobeContentSx}
      >
        <WardrobeToolbar
          filter={filters.filter}
          isMobile={isOverlay}
          likedOnly={filters.likedOnly}
          isLoading={wardrobeItems.isLoading || wardrobeItems.isUploading}
          t={t}
          onFilterChange={filters.setFilter}
          onLikedOnlyChange={filters.setLikedOnly}
          onOpenMenu={(event) => setMenuAnchor(event.currentTarget)}
          onOpenUpload={() => setIsUploadDialogOpen(true)}
          onOpenUrlUpload={() => setIsUrlUploadDialogOpen(true)}
        />
        <WardrobeScreenActionMenu
          anchorEl={menuAnchor}
          filters={filters}
          isOverlay={isOverlay}
          wardrobeItems={wardrobeItems}
          onClose={() => setMenuAnchor(null)}
        />
        {wardrobeItems.error ? (
          <Alert severity="error">{wardrobeItems.error}</Alert>
        ) : null}
        <WardrobeGrid
          isLoading={wardrobeItems.isLoading}
          isOverlay={isOverlay}
          isFilteredEmpty={filters.likedOnly && wardrobeItems.items.length > 0}
          items={filters.displayedItems(wardrobeItems.items)}
          mobileColumns={filters.displayedColumns}
          t={t}
          onProductClick={productDetail.openProductDetail}
          onProductMenuOpen={wardrobeItems.handleProductMenuOpen}
        />
        <WardrobeScreenDialogs
          isOverlay={isOverlay}
          isUploadDialogOpen={isUploadDialogOpen}
          isUrlUploadDialogOpen={isUrlUploadDialogOpen}
          locale={locale}
          productDetail={productDetail}
          t={t}
          wardrobeItems={wardrobeItems}
          onCloseUploadDialog={() => setIsUploadDialogOpen(false)}
          onCloseUrlUploadDialog={() => setIsUrlUploadDialogOpen(false)}
          onUploadImages={handleUploadImages}
          onUploadUrls={handleUploadUrls}
        />
      </Stack>
    </Box>
  );
}

function useWardrobeScreenFilters(isOverlay: boolean) {
  const [filter, setFilter] = useState<WardrobeFilter>(
    () => readStoredWardrobeFilters().filter,
  );
  const [likedOnly, setLikedOnly] = useState(
    () => readStoredWardrobeFilters().likedOnly,
  );
  const [mobileColumns, setMobileColumns] = useState<MobileCardColumns>(() =>
    readStoredWardrobeMobileCardColumns(),
  );
  const source = getSourceFilter(filter);
  const displayedItems = (items: MainScreenItem[]) => {
    const sourceItems = filterWardrobeItemsBySource(items, source);
    return likedOnly
      ? sourceItems.filter((item) => isLikedItem(item))
      : sourceItems;
  };
  const displayedColumns = isOverlay ? mobileColumns : 2;
  useEffect(() => {
    writeStoredWardrobeFilters({ filter, likedOnly });
  }, [filter, likedOnly]);
  const updateColumns = (value: MobileCardColumns) => {
    setMobileColumns(value);
    writeStoredWardrobeMobileCardColumns(value);
  };

  return {
    displayedColumns,
    displayedItems,
    filter,
    likedOnly,
    mobileColumns,
    setFilter,
    setLikedOnly,
    updateColumns,
  };
}

type WardrobeItemsModel = ReturnType<typeof useWardrobeItems>;

function useWardrobeProductDetailState(wardrobeItems: WardrobeItemsModel) {
  const [productDetailItem, setProductDetailItem] =
    useState<MainScreenItem | null>(null);
  const [productDetailMode, setProductDetailMode] =
    useState<ProductDetailMode>("read");

  const handleApplyUploadedProductDetail = async (
    item: MainScreenItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => {
    const updated = await wardrobeItems.handleUpdateUploadedItem(item, payload);
    setProductDetailItem(updated);
    setProductDetailMode("read");
  };
  const openProductDetail = (item: MainScreenItem) => {
    setProductDetailMode(
      isUploadedWardrobeItemNeedsReview(item) ? "edit" : "read",
    );
    setProductDetailItem(item);
  };
  const closeProductDetail = () => {
    setProductDetailItem(null);
    setProductDetailMode("read");
  };
  const handleSetProductDetailItemLike = async (
    item: MainScreenItem,
    isLiked: boolean,
  ) => {
    const itemUrl = getCanonicalItemUrl(item);
    if (!itemUrl) {
      return;
    }

    const previousItem = productDetailItem;
    setProductDetailItem(
      patchLikedStateByUrl(productDetailItem, itemUrl, isLiked),
    );
    try {
      await wardrobeItems.handleSetItemLike(item, isLiked);
    } catch (error) {
      setProductDetailItem(previousItem);
      throw error;
    }
  };

  return {
    closeProductDetail,
    handleApplyUploadedProductDetail,
    handleSetProductDetailItemLike,
    openProductDetail,
    productDetailItem,
    productDetailMode,
    setProductDetailItem,
    setProductDetailMode,
  };
}

function handleUploadSuccess(
  setFilter: (filter: WardrobeFilter) => void,
  setLikedOnly: (likedOnly: boolean) => void,
) {
  setFilter("uploaded");
  setLikedOnly(false);
}

function WardrobeScreenActionMenu({
  anchorEl,
  filters,
  isOverlay,
  onClose,
  wardrobeItems,
}: {
  anchorEl: HTMLElement | null;
  filters: ReturnType<typeof useWardrobeScreenFilters>;
  isOverlay: boolean;
  onClose: () => void;
  wardrobeItems: WardrobeItemsModel;
}) {
  return (
    <WardrobeActionMenu
      anchorEl={anchorEl}
      disabled={
        wardrobeItems.isLoading ||
        wardrobeItems.isDownloadingPdf ||
        wardrobeItems.isUploading
      }
      filter={filters.filter}
      isOverlay={isOverlay}
      likedOnly={filters.likedOnly}
      mobileCardColumns={filters.mobileColumns}
      onClose={onClose}
      onDownloadPdf={wardrobeItems.handleDownloadPdf}
      onFilterChange={filters.setFilter}
      onLikedOnlyChange={filters.setLikedOnly}
      onMobileCardColumnsChange={filters.updateColumns}
    />
  );
}

function WardrobeScreenDialogs({
  isOverlay,
  isUploadDialogOpen,
  isUrlUploadDialogOpen,
  locale,
  onCloseUploadDialog,
  onCloseUrlUploadDialog,
  onUploadImages,
  onUploadUrls,
  productDetail,
  t,
  wardrobeItems,
}: {
  isOverlay: boolean;
  isUploadDialogOpen: boolean;
  isUrlUploadDialogOpen: boolean;
  locale: string;
  onCloseUploadDialog: () => void;
  onCloseUrlUploadDialog: () => void;
  onUploadImages: (files: File[]) => Promise<void>;
  onUploadUrls: (urls: string[]) => Promise<void>;
  productDetail: ReturnType<typeof useWardrobeProductDetailState>;
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
      {productDetail.productDetailItem ? (
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
      ) : null}
      <WardrobeUploadDialog
        open={isUploadDialogOpen}
        isMobile={isOverlay}
        isUploading={wardrobeItems.isUploading}
        progress={wardrobeItems.uploadProgress}
        t={t}
        onClose={onCloseUploadDialog}
        onUpload={onUploadImages}
      />
      <WardrobeUrlUploadDialog
        open={isUrlUploadDialogOpen}
        isMobile={isOverlay}
        isUploading={wardrobeItems.isUploading}
        progress={wardrobeItems.uploadProgress}
        t={t}
        onClose={onCloseUrlUploadDialog}
        onUpload={onUploadUrls}
      />
    </>
  );
}

export default WardrobeScreen;
