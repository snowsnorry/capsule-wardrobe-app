import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
import { likeItem, removeItemLike } from "../api/likedItems";
import {
  deleteUploadedWardrobeItem,
  downloadPersonalItemsPdf,
  removeCatalogItemFromPersonalItems,
  updateUploadedWardrobeItem,
  uploadWardrobeImages,
  uploadWardrobeUrls,
  type PersonalItemSource,
  type UploadedWardrobeItemUpdatePayload,
} from "../api/personalItems";
import type { JobResponse, JobSnapshot } from "../api/jobs";
import { notifyPersonalItemsChanged } from "../app/personalItemsCount";
import type { ProductMenuOpenOptions } from "../components/ClothingCardTypes";
import {
  getCanonicalItemUrl,
  patchLikedStateByUrl,
} from "../utils/likedItemState";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";
import type { WardrobeProductMenuState } from "./WardrobeProductMenu";
import { getItemFromResponse } from "./wardrobeResponse";
import {
  getWardrobeDeletionTarget,
  isDifferentWardrobeItem,
} from "./wardrobeDelete";
import { EMPTY_UPLOAD_PROGRESS } from "./wardrobeUploadProgress";

type SetItems = Dispatch<SetStateAction<MainScreenItem[]>>;
type SetError = Dispatch<SetStateAction<string>>;
type Translate = (key: string) => string;
export type WardrobeItemsChangedReason = "items" | "metadata" | "upload";
type ItemsChangedCallback = (reason: WardrobeItemsChangedReason) => void;

function isTerminalJob(job: JobResponse["job"]) {
  return job.status === "completed" || job.status === "failed";
}

function applyCompletedUpload(
  job: JobResponse["job"],
  onItemsChanged?: ItemsChangedCallback,
) {
  if (job.status !== "completed") {
    throw new Error(job.error?.code || "service_unavailable");
  }
  notifyPersonalItemsChanged();
  onItemsChanged?.("upload");
}

function useWardrobeProductMenuState() {
  const [productMenu, setProductMenu] = useState<WardrobeProductMenuState>({
    anchor: null,
    url: "",
    item: null,
  });

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

  return {
    closeProductMenu,
    handleProductMenuOpen,
    productMenu,
    setProductMenu,
  };
}

function useWardrobeRemoveAction({
  onItemsChanged,
  setError,
  setIsMutating,
  setItems,
  t,
}: {
  onItemsChanged?: ItemsChangedCallback;
  setError: SetError;
  setIsMutating: Dispatch<SetStateAction<boolean>>;
  setItems: SetItems;
  t: Translate;
}) {
  return async (item: MainScreenItem) => {
    const target = getWardrobeDeletionTarget(item);
    if (!target) return;

    setIsMutating(true);
    try {
      if (target.kind === "uploaded") {
        await deleteUploadedWardrobeItem(target.id);
      } else {
        await removeCatalogItemFromPersonalItems(target.url);
      }
      setError("");
      setItems((current) =>
        current.filter((currentItem) =>
          isDifferentWardrobeItem(currentItem, item, target),
        ),
      );
      notifyPersonalItemsChanged();
      onItemsChanged?.("items");
    } catch {
      setError(t("wardrobe.removeFailed"));
    } finally {
      setIsMutating(false);
    }
  };
}

function useWardrobeDownloadPdfAction({
  setError,
  source,
  t,
}: {
  setError: SetError;
  source: PersonalItemSource | null;
  t: Translate;
}) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadPersonalItemsPdf({ source });
      setError("");
    } catch {
      setError(t("wardrobe.downloadFailed"));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return { handleDownloadPdf, isDownloadingPdf };
}

function useWardrobeUploadActions({
  onItemsChanged,
  setError,
  t,
  waitForJobCompletion,
}: {
  onItemsChanged?: ItemsChangedCallback;
  setError: SetError;
  t: Translate;
  waitForJobCompletion: (jobId: string) => Promise<JobSnapshot>;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(EMPTY_UPLOAD_PROGRESS);

  const runUpload = async (
    count: number,
    upload: () => Promise<JobResponse>,
    errorKey: string,
  ) => {
    if (count === 0) {
      return false;
    }

    setIsUploading(true);
    setUploadProgress({ ...EMPTY_UPLOAD_PROGRESS, total: count });
    try {
      const { job } = await upload();
      setError("");
      if (isTerminalJob(job)) {
        applyCompletedUpload(job, onItemsChanged);
        setIsUploading(false);
        return true;
      }
      void waitForJobCompletion(job.id)
        .then((finishedJob) => {
          applyCompletedUpload(finishedJob, onItemsChanged);
        })
        .catch(() => {
          setError(t(errorKey));
        })
        .finally(() => {
          setIsUploading(false);
        });
      setIsUploading(false);
      return true;
    } catch {
      setError(t(errorKey));
      setIsUploading(false);
      return false;
    }
  };

  return {
    handleUploadImages: (files: File[]) =>
      runUpload(
        files.length,
        () => uploadWardrobeImages(files, { onProgress: setUploadProgress }),
        "wardrobe.uploadFailed",
      ),
    handleUploadUrls: (urls: string[]) =>
      runUpload(
        urls.length,
        () => uploadWardrobeUrls(urls, { onProgress: setUploadProgress }),
        "wardrobe.urlUploadFailed",
      ),
    isUploading,
    uploadProgress,
  };
}

function useWardrobeUploadedItemUpdateAction({
  onItemsChanged,
  setError,
  setIsMutating,
  setItems,
  t,
}: {
  onItemsChanged?: ItemsChangedCallback;
  setError: SetError;
  setIsMutating: Dispatch<SetStateAction<boolean>>;
  setItems: SetItems;
  t: Translate;
}) {
  return async (
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
      onItemsChanged?.("metadata");
      return updatedItem;
    } catch (error) {
      setError(t("wardrobe.updateFailed"));
      throw error;
    } finally {
      setIsMutating(false);
    }
  };
}

function useWardrobeItemLikeAction({
  items,
  productMenu,
  setError,
  setItems,
  setProductMenu,
  t,
}: {
  items: MainScreenItem[];
  productMenu: WardrobeProductMenuState;
  setError: SetError;
  setItems: SetItems;
  setProductMenu: Dispatch<SetStateAction<WardrobeProductMenuState>>;
  t: Translate;
}) {
  return async (item: MainScreenItem, isLiked: boolean) => {
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
}

export {
  useWardrobeDownloadPdfAction,
  useWardrobeItemLikeAction,
  useWardrobeProductMenuState,
  useWardrobeRemoveAction,
  useWardrobeUploadedItemUpdateAction,
  useWardrobeUploadActions,
};
