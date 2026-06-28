import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { type UploadedWardrobeItemUpdatePayload } from "../api/personalItems";
import type { JobSnapshot } from "../api/jobs";
import { useI18n } from "../i18n/useI18n";
import { isUploadedWardrobeItemNeedsReview } from "../utils/uploadedWardrobeItemStatus";
import {
  getCanonicalItemUrl,
  isLikedItem,
  patchLikedStateByUrl,
} from "../utils/likedItemState";
import { REPORT_INSPECTOR_LAYOUT_MEDIA } from "./mainScreen/MainScreenHelpers";
import type {
  MainScreenItem,
  MobileCardColumns,
} from "./mainScreen/MainScreenTypes";
import { getHighlightedPersonalItemsReportItemKeys } from "./PersonalItemsReportPanelUtils";
import {
  readStoredWardrobeFilters,
  readStoredWardrobeMobileCardColumns,
  writeStoredWardrobeFilters,
  writeStoredWardrobeMobileCardColumns,
} from "./WardrobeCardLayoutStorage";
import { getSourceFilter, type WardrobeFilter } from "./WardrobeToolbar";
import { filterWardrobeItemsBySource } from "./wardrobeItemMappers";
import {
  WardrobeScreenContent,
  type PersonalItemsReportModel,
  type WardrobeFiltersModel,
  type WardrobeItemsModel,
} from "./WardrobeScreenContent";
import type { ProductDetailMode } from "./wardrobeScreenTypes";
import { usePersonalItemsReport } from "./usePersonalItemsReport";
import { useWardrobeItems } from "./useWardrobeItems";

// eslint-disable-next-line max-lines-per-function
function WardrobeScreen({
  isJobActive = false,
  waitForJobCompletion,
}: {
  isJobActive?: boolean;
  waitForJobCompletion: (jobId: string) => Promise<JobSnapshot>;
}): ReactElement {
  const { t, locale } = useI18n();
  const isOverlay = useMediaQuery("(max-width: 1279.95px)");
  const isReportInspectorLayout = useMediaQuery(REPORT_INSPECTOR_LAYOUT_MEDIA);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUrlUploadDialogOpen, setIsUrlUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportError, setReportError] = useState("");
  const [highlightedReportItemIds, setHighlightedReportItemIds] = useState<
    string[]
  >([]);
  const filters = useWardrobeScreenFilters(isOverlay);
  const personalItemsReport = usePersonalItemsReport({
    setError: setReportError,
    t,
    waitForJobCompletion,
  });
  const wardrobeItems = useWardrobeItems(
    filters.filter,
    refreshKey,
    t,
    waitForJobCompletion,
    {
      onItemsChanged: (reason) => {
        if (reason === "metadata") {
          personalItemsReport.markStale();
          return;
        }
        if (reason === "upload") {
          setRefreshKey((current) => current + 1);
        }
        void personalItemsReport.refreshReport({ force: true });
      },
    },
  );
  const productDetail = useWardrobeProductDetailState(wardrobeItems);
  const reportLayout = useWardrobeReportLayout(
    personalItemsReport,
    isReportInspectorLayout,
  );
  const displayedItems = filters.displayedItems(wardrobeItems.items);
  const highlightedReportItemKeys = useMemo(
    () =>
      getHighlightedPersonalItemsReportItemKeys(
        wardrobeItems.items,
        highlightedReportItemIds,
      ),
    [highlightedReportItemIds, wardrobeItems.items],
  );
  const isActionBusy =
    isJobActive ||
    wardrobeItems.isLoading ||
    wardrobeItems.isDownloadingPdf ||
    wardrobeItems.isUploading ||
    personalItemsReport.isLoadingReport ||
    personalItemsReport.isReportPending;
  const uploadHandlers = useWardrobeUploadDialogHandlers({
    filters,
    setIsUploadDialogOpen,
    setIsUrlUploadDialogOpen,
    wardrobeItems,
  });

  return (
    <WardrobeScreenContent
      actions={{
        onCloseUploadDialog: () => setIsUploadDialogOpen(false),
        onCloseUrlUploadDialog: () => setIsUrlUploadDialogOpen(false),
        onHighlightItemIds: setHighlightedReportItemIds,
        onMenuClose: () => setMenuAnchor(null),
        onOpenMenu: (event) => setMenuAnchor(event.currentTarget),
        onOpenUpload: () => setIsUploadDialogOpen(true),
        onOpenUrlUpload: () => setIsUrlUploadDialogOpen(true),
        onUploadImages: uploadHandlers.handleUploadImages,
        onUploadUrls: uploadHandlers.handleUploadUrls,
      }}
      model={{
        displayedItems,
        filters,
        hasReportOrLoading: reportLayout.hasReportOrLoading,
        highlightedReportItemKeys,
        isActionBusy,
        isOverlay,
        isUploadDialogOpen,
        isUrlUploadDialogOpen,
        locale,
        menuAnchor,
        personalItemsReport,
        productDetail,
        report: reportLayout.report,
        reportError,
        showFloatingReportInspector: reportLayout.showFloatingReportInspector,
        showInlineCompactReport: reportLayout.showInlineCompactReport,
        t,
        wardrobeItems,
      }}
    />
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

function useWardrobeReportLayout(
  personalItemsReport: PersonalItemsReportModel,
  isReportInspectorLayout: boolean,
) {
  const report = personalItemsReport.report;
  const hasReportOrLoading =
    Boolean(report) || personalItemsReport.isLoadingReport;
  const showFloatingReportInspector = Boolean(
    report && isReportInspectorLayout,
  );
  const showInlineCompactReport = Boolean(
    report && !showFloatingReportInspector,
  );

  return {
    hasReportOrLoading,
    report,
    showFloatingReportInspector,
    showInlineCompactReport,
  };
}

function useWardrobeUploadDialogHandlers({
  filters,
  setIsUploadDialogOpen,
  setIsUrlUploadDialogOpen,
  wardrobeItems,
}: {
  filters: WardrobeFiltersModel;
  setIsUploadDialogOpen: Dispatch<SetStateAction<boolean>>;
  setIsUrlUploadDialogOpen: Dispatch<SetStateAction<boolean>>;
  wardrobeItems: WardrobeItemsModel;
}) {
  const completeUpload = (closeDialog: () => void) => {
    handleUploadSuccess(filters.setFilter, filters.setLikedOnly);
    closeDialog();
  };
  const handleUploadImages = async (files: File[]) => {
    const uploaded = await wardrobeItems.handleUploadImages(files);
    if (uploaded) completeUpload(() => setIsUploadDialogOpen(false));
  };
  const handleUploadUrls = async (urls: string[]) => {
    const uploaded = await wardrobeItems.handleUploadUrls(urls);
    if (uploaded) completeUpload(() => setIsUrlUploadDialogOpen(false));
  };

  return { handleUploadImages, handleUploadUrls };
}

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

export default WardrobeScreen;
