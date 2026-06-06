/* eslint-disable max-lines */
import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Alert, Box, Stack } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
import { likeItem, removeItemLike } from "../api/likedItems";
import type { ProductMenuOpenOptions } from "../components/ClothingCardTypes";
import {
  deleteUploadedWardrobeItem,
  downloadMyWardrobePdf,
  fetchMyWardrobeItems,
  removeCatalogItemFromMyWardrobe,
  type MyWardrobeSource,
  type UploadedWardrobeItemUpdatePayload,
  updateUploadedWardrobeItem,
  uploadWardrobeImages,
  uploadWardrobeUrls,
} from "../api/myWardrobe";
import { notifyPersonalItemsChanged } from "../app/personalItemsCount";
import { useI18n } from "../i18n/useI18n";
import { isUploadedWardrobeItemNeedsReview } from "../utils/uploadedWardrobeItemStatus";
import {
  getCanonicalItemUrl,
  isLikedItem,
  patchLikedStateByUrl,
} from "../utils/likedItemState";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "./mainScreen/MainScreenHelpers";
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
  type WardrobeProductMenuState,
} from "./WardrobeProductMenu";
import { getItemFromResponse, getItemsFromResponse } from "./wardrobeResponse";
import {
  getWardrobeDeletionTarget,
  isDifferentWardrobeItem,
} from "./wardrobeDelete";
import { EMPTY_UPLOAD_PROGRESS } from "./wardrobeUploadProgress";
import CapsuleProductDetailDialog from "./mainScreen/CapsuleProductDetailDialog";
import WardrobeUploadDialog from "./WardrobeUploadDialog";
import WardrobeUrlUploadDialog from "./WardrobeUrlUploadDialog";
import WardrobeToolbar, {
  getSourceFilter,
  type WardrobeFilter,
} from "./WardrobeToolbar";

type ProductDetailMode = "read" | "edit";

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
  const displayedItems = useMemo(
    () =>
      likedOnly
        ? wardrobeItems.items.filter((item) => isLikedItem(item))
        : wardrobeItems.items,
    [likedOnly, wardrobeItems.items],
  );
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
            onRemoveFromMyWardrobe={wardrobeItems.handleConfirmRemove}
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

// Keeps Wardrobe network state and item mutations in one place.
// eslint-disable-next-line max-lines-per-function
function useWardrobeItems(
  filter: WardrobeFilter,
  refreshKey: number,
  t: (key: string) => string,
) {
  const source = useMemo(() => getSourceFilter(filter), [filter]);
  const { error, isLoading, items, setError, setItems } = useWardrobeItemsQuery(
    source,
    refreshKey,
    t,
  );
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(EMPTY_UPLOAD_PROGRESS);
  const [productMenu, setProductMenu] = useState<WardrobeProductMenuState>({
    anchor: null,
    url: "",
    item: null,
  });
  const [removeConfirmItem, setRemoveConfirmItem] =
    useState<MainScreenItem | null>(null);
  const closeProductMenu = () =>
    setProductMenu((current) => ({ ...current, anchor: null }));
  const handleProductMenuOpen = (
    anchor: HTMLElement,
    url: string,
    item: MainScreenItem,
    options: ProductMenuOpenOptions,
  ) => {
    setProductMenu({
      anchor,
      url,
      item,
      presentation: options.presentation,
      ...(options.originRect ? { originRect: options.originRect } : {}),
    });
  };
  const handleConfirmRemove = async (item: MainScreenItem) => {
    const target = getWardrobeDeletionTarget(item);
    if (!target) return;

    setIsMutating(true);
    try {
      if (target.kind === "uploaded") {
        await deleteUploadedWardrobeItem(target.id);
      } else {
        await removeCatalogItemFromMyWardrobe(target.url);
      }
      setError("");
      setItems((current) =>
        current.filter((currentItem) =>
          isDifferentWardrobeItem(currentItem, item, target),
        ),
      );
      notifyPersonalItemsChanged();
    } catch {
      setError(t("wardrobe.removeFailed"));
    } finally {
      setIsMutating(false);
    }
  };
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadMyWardrobePdf({ source });
      setError("");
    } catch {
      setError(t("wardrobe.downloadFailed"));
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  const handleUploadImages = async (files: File[]) => {
    if (files.length === 0) {
      return false;
    }

    setIsUploading(true);
    setUploadProgress({
      ...EMPTY_UPLOAD_PROGRESS,
      total: files.length,
    });
    try {
      await uploadWardrobeImages(files, {
        onProgress: setUploadProgress,
      });
      setError("");
      notifyPersonalItemsChanged();
      return true;
    } catch {
      setError(t("wardrobe.uploadFailed"));
      return false;
    } finally {
      setIsUploading(false);
    }
  };
  const handleUploadUrls = async (urls: string[]) => {
    if (urls.length === 0) {
      return false;
    }

    setIsUploading(true);
    setUploadProgress({
      ...EMPTY_UPLOAD_PROGRESS,
      total: urls.length,
    });
    try {
      await uploadWardrobeUrls(urls, {
        onProgress: setUploadProgress,
      });
      setError("");
      notifyPersonalItemsChanged();
      return true;
    } catch {
      setError(t("wardrobe.urlUploadFailed"));
      return false;
    } finally {
      setIsUploading(false);
    }
  };
  const handleUpdateUploadedItem = async (
    item: MainScreenItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => {
    const id = item?.id;
    if (!id) {
      throw new Error("missing_uploaded_item_id");
    }

    setIsMutating(true);
    try {
      const response = await updateUploadedWardrobeItem(id, payload);
      const updatedItem = getItemFromResponse(response) || {
        ...item,
        ...payload,
      };
      setError("");
      setItems((current) =>
        sortWardrobeItems(
          current.map((currentItem) =>
            String(currentItem?.id || "") === String(id)
              ? updatedItem
              : currentItem,
          ),
        ),
      );
      return updatedItem;
    } catch (error) {
      setError(t("wardrobe.updateFailed"));
      throw error;
    } finally {
      setIsMutating(false);
    }
  };
  const handleSetItemLike = async (item: MainScreenItem, isLiked: boolean) => {
    const itemUrl = getCanonicalItemUrl(item);
    if (!itemUrl) {
      return;
    }

    const previousItems = items;
    const previousProductMenu = productMenu;
    setItems((current) => patchLikedStateByUrl(current, itemUrl, isLiked));
    setProductMenu((current) =>
      patchLikedStateByUrl(current, itemUrl, isLiked),
    );
    try {
      if (isLiked) {
        await likeItem(itemUrl);
      } else {
        await removeItemLike(itemUrl);
      }
      setError("");
    } catch {
      setItems(previousItems);
      setProductMenu(previousProductMenu);
      setError(t("wardrobe.likeFailed"));
    }
  };

  return {
    closeProductMenu,
    error,
    handleConfirmRemove,
    handleDownloadPdf,
    handleProductMenuOpen,
    handleSetItemLike,
    handleUpdateUploadedItem,
    handleUploadImages,
    handleUploadUrls,
    isDownloadingPdf,
    isLoading,
    isMutating,
    isUploading,
    items,
    productMenu,
    removeConfirmItem,
    setRemoveConfirmItem,
    uploadProgress,
  };
}

function useWardrobeItemsQuery(
  source: MyWardrobeSource | null,
  refreshKey: number,
  t: (key: string) => string,
) {
  const [items, setItems] = useState<MainScreenItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setError("");
    fetchMyWardrobeItems({ source, force: refreshKey > 0 })
      .then((response) => {
        if (isActive) {
          setItems(sortWardrobeItems(getItemsFromResponse(response)));
        }
      })
      .catch(() => {
        if (isActive) {
          setItems([]);
          setError(t("wardrobe.loadFailed"));
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [refreshKey, source, t]);

  return { error, isLoading, items, setError, setItems };
}

const wardrobeScreenSx = {
  height: "100%",
  minHeight: 0,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehaviorY: "contain",
  WebkitOverflowScrolling: "touch",
  pt: { xs: 0, md: 2 },
  pb: 2,
} as const;

const wardrobeContentSx = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  px: { xs: 2, md: 3 },
  boxSizing: "border-box",
  minWidth: 0,
  minHeight: "100%",
} as const;

export default WardrobeScreen;
