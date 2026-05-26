/* eslint-disable max-lines */
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent, ReactElement } from "react";
import { Alert, Box, Stack } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
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
import { useI18n } from "../i18n/useI18n";
import { isUploadedWardrobeItemNeedsReview } from "../utils/uploadedWardrobeItemStatus";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "./mainScreen/MainScreenHelpers";
import type {
  MainScreenItem,
  MobileCardColumns,
} from "./mainScreen/MainScreenTypes";
import MyWardrobeActionMenu from "./MyWardrobeActionMenu";
import {
  readStoredMyWardrobeMobileCardColumns,
  writeStoredMyWardrobeMobileCardColumns,
} from "./MyWardrobeCardLayoutStorage";
import MyWardrobeGrid from "./MyWardrobeGrid";
import {
  MyWardrobeProductMenu,
  MyWardrobeRemoveConfirmDialog,
  type MyWardrobeProductMenuState,
} from "./MyWardrobeProductMenu";
import {
  getItemFromResponse,
  getItemsFromResponse,
} from "./myWardrobeResponse";
import {
  getMyWardrobeDeletionTarget,
  isDifferentWardrobeItem,
} from "./myWardrobeDelete";
import { EMPTY_UPLOAD_PROGRESS } from "./myWardrobeUploadProgress";
import CapsuleProductDetailDialog from "./mainScreen/CapsuleProductDetailDialog";
import WardrobeUploadDialog from "./WardrobeUploadDialog";
import WardrobeUrlUploadDialog from "./WardrobeUrlUploadDialog";
import MyWardrobeToolbar, {
  getSourceFilter,
  type MyWardrobeFilter,
} from "./MyWardrobeToolbar";

type ProductDetailMode = "read" | "edit";

// Main screen composition stays local so toolbar, menus, dialogs, and grid share state.
// eslint-disable-next-line max-lines-per-function
function MyWardrobeScreen(): ReactElement {
  const { t, locale } = useI18n();
  const isOverlay = useMediaQuery("(max-width: 1279.95px)");
  const [filter, setFilter] = useState<MyWardrobeFilter>("all");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUrlUploadDialogOpen, setIsUrlUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileColumns, setMobileColumns] = useState<MobileCardColumns>(() =>
    readStoredMyWardrobeMobileCardColumns(),
  );
  const [productDetailItem, setProductDetailItem] =
    useState<MainScreenItem | null>(null);
  const [productDetailMode, setProductDetailMode] =
    useState<ProductDetailMode>("read");
  const wardrobeItems = useMyWardrobeItems(filter, refreshKey, t);
  const displayedColumns = isOverlay ? mobileColumns : 2;
  const updateColumns = (value: MobileCardColumns) => {
    setMobileColumns(value);
    writeStoredMyWardrobeMobileCardColumns(value);
  };
  const handleUploadImages = async (files: File[]) => {
    const uploaded = await wardrobeItems.handleUploadImages(files);
    if (uploaded) {
      setFilter("uploaded");
      setRefreshKey((current) => current + 1);
      setIsUploadDialogOpen(false);
    }
  };
  const handleUploadUrls = async (urls: string[]) => {
    const uploaded = await wardrobeItems.handleUploadUrls(urls);
    if (uploaded) {
      setFilter("uploaded");
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

  return (
    <Box data-testid="my-wardrobe-screen" sx={myWardrobeScreenSx}>
      <Stack
        spacing={2.25}
        data-testid="my-wardrobe-content"
        sx={myWardrobeContentSx}
      >
        <MyWardrobeToolbar
          filter={filter}
          isMobile={isOverlay}
          isLoading={wardrobeItems.isLoading || wardrobeItems.isUploading}
          t={t}
          onFilterChange={setFilter}
          onOpenMenu={(event) => setMenuAnchor(event.currentTarget)}
          onOpenUpload={() => setIsUploadDialogOpen(true)}
          onOpenUrlUpload={() => setIsUrlUploadDialogOpen(true)}
        />
        <MyWardrobeActionMenu
          anchorEl={menuAnchor}
          disabled={
            wardrobeItems.isLoading ||
            wardrobeItems.isDownloadingPdf ||
            wardrobeItems.isUploading
          }
          isOverlay={isOverlay}
          mobileCardColumns={mobileColumns}
          onClose={() => setMenuAnchor(null)}
          onDownloadPdf={wardrobeItems.handleDownloadPdf}
          onMobileCardColumnsChange={updateColumns}
        />
        {wardrobeItems.error ? (
          <Alert severity="error">{wardrobeItems.error}</Alert>
        ) : null}
        <MyWardrobeGrid
          isLoading={wardrobeItems.isLoading}
          isOverlay={isOverlay}
          items={wardrobeItems.items}
          mobileColumns={displayedColumns}
          t={t}
          onProductClick={openProductDetail}
          onProductMenuClick={wardrobeItems.handleProductMenuClick}
        />
        <MyWardrobeProductMenu
          anchor={wardrobeItems.productMenu.anchor}
          item={wardrobeItems.productMenu.item}
          t={t}
          onClose={wardrobeItems.closeProductMenu}
          onRequestRemove={wardrobeItems.setRemoveConfirmItem}
        />
        <MyWardrobeRemoveConfirmDialog
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

// Keeps My Wardrobe network state and item mutations in one place.
// eslint-disable-next-line max-lines-per-function
function useMyWardrobeItems(
  filter: MyWardrobeFilter,
  refreshKey: number,
  t: (key: string) => string,
) {
  const source = useMemo(() => getSourceFilter(filter), [filter]);
  const { error, isLoading, items, setError, setItems } =
    useMyWardrobeItemsQuery(source, refreshKey, t);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(EMPTY_UPLOAD_PROGRESS);
  const [productMenu, setProductMenu] = useState<MyWardrobeProductMenuState>({
    anchor: null,
    url: "",
    item: null,
  });
  const [removeConfirmItem, setRemoveConfirmItem] =
    useState<MainScreenItem | null>(null);
  const closeProductMenu = () =>
    setProductMenu((current) => ({ ...current, anchor: null }));
  const handleProductMenuClick = (
    event: MouseEvent<HTMLButtonElement>,
    url: string,
    item: MainScreenItem,
  ) => {
    setProductMenu({ anchor: event.currentTarget, url, item });
  };
  const handleConfirmRemove = async (item: MainScreenItem) => {
    const target = getMyWardrobeDeletionTarget(item);
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
    } catch {
      setError(t("myWardrobe.removeFailed"));
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
      setError(t("myWardrobe.downloadFailed"));
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
      return true;
    } catch {
      setError(t("myWardrobe.uploadFailed"));
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
      return true;
    } catch {
      setError(t("myWardrobe.urlUploadFailed"));
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
      setError(t("myWardrobe.updateFailed"));
      throw error;
    } finally {
      setIsMutating(false);
    }
  };

  return {
    closeProductMenu,
    error,
    handleConfirmRemove,
    handleDownloadPdf,
    handleProductMenuClick,
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

function useMyWardrobeItemsQuery(
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
          setError(t("myWardrobe.loadFailed"));
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

const myWardrobeScreenSx = {
  height: "100%",
  minHeight: 0,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehaviorY: "contain",
  WebkitOverflowScrolling: "touch",
  pt: { xs: 0, md: 2 },
  pb: 2,
} as const;

const myWardrobeContentSx = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  px: { xs: 2, md: 3 },
  boxSizing: "border-box",
  minWidth: 0,
  minHeight: "100%",
} as const;

export default MyWardrobeScreen;
