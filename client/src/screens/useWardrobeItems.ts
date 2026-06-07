/* eslint-disable max-lines-per-function */
import { useEffect, useMemo, useState } from "react";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
import { likeItem, removeItemLike } from "../api/likedItems";
import {
  deleteUploadedWardrobeItem,
  downloadMyWardrobePdf,
  fetchMyWardrobeItems,
  removeCatalogItemFromMyWardrobe,
  updateUploadedWardrobeItem,
  uploadWardrobeImages,
  uploadWardrobeUrls,
  type UploadedWardrobeItemUpdatePayload,
} from "../api/myWardrobe";
import { notifyPersonalItemsChanged } from "../app/personalItemsCount";
import type { ProductMenuOpenOptions } from "../components/ClothingCardTypes";
import {
  getCanonicalItemUrl,
  patchLikedStateByUrl,
} from "../utils/likedItemState";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";
import { getSourceFilter, type WardrobeFilter } from "./WardrobeToolbar";
import type { WardrobeProductMenuState } from "./WardrobeProductMenu";
import { getItemFromResponse, getItemsFromResponse } from "./wardrobeResponse";
import {
  getWardrobeDeletionTarget,
  isDifferentWardrobeItem,
} from "./wardrobeDelete";
import { EMPTY_UPLOAD_PROGRESS } from "./wardrobeUploadProgress";

export function useWardrobeItems(
  filter: WardrobeFilter,
  refreshKey: number,
  t: (key: string) => string,
) {
  const source = useMemo(() => getSourceFilter(filter), [filter]);
  const { error, isLoading, items, setError, setItems } = useWardrobeItemsQuery(
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

function useWardrobeItemsQuery(refreshKey: number, t: (key: string) => string) {
  const [items, setItems] = useState<MainScreenItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setError("");
    fetchMyWardrobeItems({ force: refreshKey > 0 })
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
