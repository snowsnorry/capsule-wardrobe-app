import { useEffect, useMemo, useState } from "react";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
import type { JobSnapshot } from "../api/jobs";
import { usePaginatedPersonalItems } from "../hooks/usePaginatedPersonalItems";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";
import { getSourceFilter, type WardrobeFilter } from "./WardrobeToolbar";
import {
  useWardrobeDownloadPdfAction,
  useWardrobeItemLikeAction,
  useWardrobeProductMenuState,
  useWardrobeRemoveAction,
  useWardrobeUploadedItemUpdateAction,
  useWardrobeUploadActions,
  type WardrobeItemsChangedReason,
} from "./wardrobeItemActions";

// eslint-disable-next-line max-params
export function useWardrobeItems(
  filter: WardrobeFilter,
  likedOnly: boolean,
  refreshKey: number,
  t: (key: string) => string,
  waitForJobCompletion: (jobId: string) => Promise<JobSnapshot>,
  options: {
    onItemsChanged?: (reason: WardrobeItemsChangedReason) => void;
  } = {},
) {
  const source = useMemo(() => getSourceFilter(filter), [filter]);
  const query = usePaginatedPersonalItems<MainScreenItem>({
    forceKey: refreshKey,
    likedOnly,
    source,
  });
  const items = useMemo(() => sortWardrobeItems(query.items), [query.items]);
  const knownItems = useMemo(
    () => sortWardrobeItems(query.knownItems),
    [query.knownItems],
  );
  const [error, setError] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [removeConfirmItem, setRemoveConfirmItem] =
    useState<MainScreenItem | null>(null);
  const productMenuState = useWardrobeProductMenuState();
  const downloadPdfAction = useWardrobeDownloadPdfAction({
    setError,
    source,
    t,
  });
  const uploadActions = useWardrobeUploadActions({
    onItemsChanged: options.onItemsChanged,
    setError,
    t,
    waitForJobCompletion,
  });
  const handleConfirmRemove = useWardrobeRemoveAction({
    onItemsChanged: options.onItemsChanged,
    setError,
    setIsMutating,
    setItems: query.setItems,
    t,
  });
  const handleUpdateUploadedItem = useWardrobeUploadedItemUpdateAction({
    onItemsChanged: options.onItemsChanged,
    setError,
    setIsMutating,
    setItems: query.setItems,
    t,
  });
  const handleSetItemLike = useWardrobeItemLikeAction({
    productMenu: productMenuState.productMenu,
    setError,
    setItems: query.setItems,
    setProductMenu: productMenuState.setProductMenu,
    t,
  });

  useEffect(() => {
    setError(query.error ? t("wardrobe.loadFailed") : "");
  }, [query.error, t]);

  return {
    closeProductMenu: productMenuState.closeProductMenu,
    error,
    handleConfirmRemove,
    handleDownloadPdf: downloadPdfAction.handleDownloadPdf,
    handleProductMenuOpen: productMenuState.handleProductMenuOpen,
    handleSetItemLike,
    handleUpdateUploadedItem,
    handleUploadImages: uploadActions.handleUploadImages,
    handleUploadUrls: uploadActions.handleUploadUrls,
    hasMore: query.hasMore,
    isDownloadingPdf: downloadPdfAction.isDownloadingPdf,
    isLoading: query.isLoading,
    isLoadingMore: query.isLoadingMore,
    isMutating,
    isUploading: uploadActions.isUploading,
    items,
    knownItems,
    loadMore: query.loadMore,
    productMenu: productMenuState.productMenu,
    removeConfirmItem,
    setRemoveConfirmItem,
    uploadProgress: uploadActions.uploadProgress,
  };
}
