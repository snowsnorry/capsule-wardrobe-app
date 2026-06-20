import { useEffect, useMemo, useState } from "react";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
import { fetchPersonalItems } from "../api/personalItems";
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
import { getItemsFromResponse } from "./wardrobeResponse";

export function useWardrobeItems(
  filter: WardrobeFilter,
  refreshKey: number,
  t: (key: string) => string,
  options: {
    onItemsChanged?: (reason: WardrobeItemsChangedReason) => void;
  } = {},
) {
  const source = useMemo(() => getSourceFilter(filter), [filter]);
  const { error, isLoading, items, setError, setItems } = useWardrobeItemsQuery(
    refreshKey,
    t,
  );
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
  });
  const handleConfirmRemove = useWardrobeRemoveAction({
    onItemsChanged: options.onItemsChanged,
    setError,
    setIsMutating,
    setItems,
    t,
  });
  const handleUpdateUploadedItem = useWardrobeUploadedItemUpdateAction({
    onItemsChanged: options.onItemsChanged,
    setError,
    setIsMutating,
    setItems,
    t,
  });
  const handleSetItemLike = useWardrobeItemLikeAction({
    items,
    productMenu: productMenuState.productMenu,
    setError,
    setItems,
    setProductMenu: productMenuState.setProductMenu,
    t,
  });

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
    isDownloadingPdf: downloadPdfAction.isDownloadingPdf,
    isLoading,
    isMutating,
    isUploading: uploadActions.isUploading,
    items,
    productMenu: productMenuState.productMenu,
    removeConfirmItem,
    setRemoveConfirmItem,
    uploadProgress: uploadActions.uploadProgress,
  };
}

function useWardrobeItemsQuery(refreshKey: number, t: (key: string) => string) {
  const [items, setItems] = useState<MainScreenItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setError("");
    fetchPersonalItems({ force: refreshKey > 0 })
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
  }, [refreshKey, t]);

  return { error, isLoading, items, setError, setItems };
}
