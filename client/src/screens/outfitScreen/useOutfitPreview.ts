import { useEffect, useRef, useState } from "react";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/personalItems";
import type { OutfitItemSnapshot, WardrobeItem } from "../../app/appTypes";
import {
  getCanonicalItemUrl,
  patchLikedStateByUrl,
} from "../../utils/likedItemState";
import { isUploadedWardrobeItemNeedsReview } from "../../utils/uploadedWardrobeItemStatus";
import { getPreviewComparableKey } from "./OutfitScreenHelpers";
import { getOutfitItem, getPreviewItemKey } from "./outfitItemMappers";
import type { ProductDetailMode } from "./OutfitScreenTypes";

function useOutfitPreview({
  items,
  onSetItemLike,
  onUpdateUploadedWardrobeItem,
  replaceItems,
}: {
  items: OutfitItemSnapshot[];
  onSetItemLike: (item: WardrobeItem, isLiked: boolean) => Promise<void>;
  onUpdateUploadedWardrobeItem?: (
    item: WardrobeItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) =>
    | Promise<WardrobeItem | null | undefined>
    | WardrobeItem
    | null
    | undefined;
  replaceItems: (nextItems: OutfitItemSnapshot[]) => void;
}) {
  const [previewItem, setPreviewItem] = useState<WardrobeItem | null>(null);
  const [previewMode, setPreviewMode] = useState<ProductDetailMode>("read");
  const previewItemKeyRef = useRef("");
  const previewItemKey = getPreviewItemKey(previewItem);

  useEffect(() => {
    if (!previewItemKey) {
      previewItemKeyRef.current = "";
      setPreviewMode("read");
      return;
    }

    if (previewItemKeyRef.current !== previewItemKey) {
      previewItemKeyRef.current = previewItemKey;
      setPreviewMode(
        isUploadedWardrobeItemNeedsReview(previewItem) ? "edit" : "read",
      );
    }
  }, [previewItemKey, previewItem]);

  const closePreview = () => {
    setPreviewItem(null);
    setPreviewMode("read");
  };

  const applyUploadedProductDetail = async (
    item: WardrobeItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => {
    const updated = await onUpdateUploadedWardrobeItem?.(item, payload);
    const nextItem = updated || { ...item, ...payload };
    const comparableKey = getPreviewComparableKey(item);
    setPreviewItem(nextItem);
    setPreviewMode("read");
    replaceItems(
      items.map((entry) => {
        const item = getOutfitItem(entry);
        return item && getPreviewComparableKey(item) === comparableKey
          ? { ...entry, item: nextItem }
          : entry;
      }),
    );
  };

  const setPreviewItemLike = async (item: WardrobeItem, isLiked: boolean) => {
    const itemUrl = getCanonicalItemUrl(item);
    if (!itemUrl) return;

    const previousItem = previewItem;
    setPreviewItem(patchLikedStateByUrl(previewItem, itemUrl, isLiked));
    try {
      await onSetItemLike(item, isLiked);
    } catch (error) {
      setPreviewItem(previousItem);
      throw error;
    }
  };

  return {
    applyUploadedProductDetail,
    closePreview,
    previewItem,
    previewMode,
    setPreviewItem,
    setPreviewItemLike,
    setPreviewMode,
  };
}

export { useOutfitPreview };
