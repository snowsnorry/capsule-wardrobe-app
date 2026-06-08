import { useEffect, useMemo, useState } from "react";
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

// Main screen composition stays local so toolbar, menus, dialogs, and grid share state.
// eslint-disable-next-line max-lines-per-function
function WardrobeScreen(): ReactElement {
  const { t, locale } = useI18n();
  const isOverlay = useMediaQuery("(max-width: 1279.95px)");
  const [filter, setFilter] = useState<WardrobeFilter>(
    () => readStoredWardrobeFilters().filter,
  );
  const [likedOnly, setLikedOnly] = useState(
    () => readStoredWardrobeFilters().likedOnly,
  );
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUrlUploadDialogOpen, setIsUrlUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileColumns, setMobileColumns] = useState<MobileCardColumns>(() =>
    readStoredWardrobeMobileCardColumns(),
  );
  const [productDetailItem, setProductDetailItem] =
    useState<MainScreenItem | null>(null);
  const [productDetailMode, setProductDetailMode] =
    useState<ProductDetailMode>("read");
  const wardrobeItems = useWardrobeItems(filter, refreshKey, t);
  const source = getSourceFilter(filter);
  const displayedItems = useMemo(() => {
    const sourceItems = filterWardrobeItemsBySource(
      wardrobeItems.items,
      source,
    );
    return likedOnly
      ? sourceItems.filter((item) => isLikedItem(item))
      : sourceItems;
  }, [likedOnly, source, wardrobeItems.items]);
  const displayedColumns = isOverlay ? mobileColumns : 2;
  useEffect(() => {
    writeStoredWardrobeFilters({ filter, likedOnly });
  }, [filter, likedOnly]);
  const updateColumns = (value: MobileCardColumns) => {
    setMobileColumns(value);
    writeStoredWardrobeMobileCardColumns(value);
  };
  const handleUploadImages = async (files: File[]) => {
    const uploaded = await wardrobeItems.handleUploadImages(files);
    if (uploaded) {
      setFilter("uploaded");
      setLikedOnly(false);
      setRefreshKey((current) => current + 1);
      setIsUploadDialogOpen(false);
    }
  };
  const handleUploadUrls = async (urls: string[]) => {
    const uploaded = await wardrobeItems.handleUploadUrls(urls);
    if (uploaded) {
      setFilter("uploaded");
      setLikedOnly(false);
      setRefreshKey((current) => current + 1);
      setIsUrlUploadDialogOpen(false);
    }
  };
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

  return (
    <Box data-testid="wardrobe-screen" sx={wardrobeScreenSx}>
      <Stack
        spacing={2.25}
        data-testid="wardrobe-content"
        sx={wardrobeContentSx}
      >
        <WardrobeToolbar
          filter={filter}
          isMobile={isOverlay}
          likedOnly={likedOnly}
          isLoading={wardrobeItems.isLoading || wardrobeItems.isUploading}
          t={t}
          onFilterChange={setFilter}
          onLikedOnlyChange={setLikedOnly}
          onOpenMenu={(event) => setMenuAnchor(event.currentTarget)}
          onOpenUpload={() => setIsUploadDialogOpen(true)}
          onOpenUrlUpload={() => setIsUrlUploadDialogOpen(true)}
        />
        <WardrobeActionMenu
          anchorEl={menuAnchor}
          disabled={
            wardrobeItems.isLoading ||
            wardrobeItems.isDownloadingPdf ||
            wardrobeItems.isUploading
          }
          filter={filter}
          isOverlay={isOverlay}
          likedOnly={likedOnly}
          mobileCardColumns={mobileColumns}
          onClose={() => setMenuAnchor(null)}
          onDownloadPdf={wardrobeItems.handleDownloadPdf}
          onFilterChange={setFilter}
          onLikedOnlyChange={setLikedOnly}
          onMobileCardColumnsChange={updateColumns}
        />
        {wardrobeItems.error ? (
          <Alert severity="error">{wardrobeItems.error}</Alert>
        ) : null}
        <WardrobeGrid
          isLoading={wardrobeItems.isLoading}
          isOverlay={isOverlay}
          isFilteredEmpty={likedOnly && wardrobeItems.items.length > 0}
          items={displayedItems}
          mobileColumns={displayedColumns}
          t={t}
          onProductClick={openProductDetail}
          onProductMenuOpen={wardrobeItems.handleProductMenuOpen}
        />
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
        {productDetailItem ? (
          <CapsuleProductDetailDialog
            item={productDetailItem}
            open={Boolean(productDetailItem)}
            mode={productDetailMode}
            isMobile={isOverlay}
            locale={locale}
            t={t}
            onApply={handleApplyUploadedProductDetail}
            onClose={closeProductDetail}
            onEdit={(item) => {
              setProductDetailItem(item);
              setProductDetailMode("edit");
            }}
            onReadMode={() => setProductDetailMode("read")}
            onRemoveFromPersonalItems={wardrobeItems.handleConfirmRemove}
            onSetItemLike={handleSetProductDetailItemLike}
          />
        ) : null}
        <WardrobeUploadDialog
          open={isUploadDialogOpen}
          isMobile={isOverlay}
          isUploading={wardrobeItems.isUploading}
          progress={wardrobeItems.uploadProgress}
          t={t}
          onClose={() => setIsUploadDialogOpen(false)}
          onUpload={handleUploadImages}
        />
        <WardrobeUrlUploadDialog
          open={isUrlUploadDialogOpen}
          isMobile={isOverlay}
          isUploading={wardrobeItems.isUploading}
          progress={wardrobeItems.uploadProgress}
          t={t}
          onClose={() => setIsUrlUploadDialogOpen(false)}
          onUpload={handleUploadUrls}
        />
      </Stack>
    </Box>
  );
}

export default WardrobeScreen;
