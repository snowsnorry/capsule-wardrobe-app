import {
  removeCatalogItemFromMyWardrobe,
  saveCatalogItemToMyWardrobe,
  updateUploadedWardrobeItem,
  type UploadedWardrobeItemUpdatePayload,
} from "../api/myWardrobe";
import { fromContext, type AppActionContext } from "./actionContext";
import type { WardrobeItem } from "./appTypes";

function applySavedFlagToProfileItems(
  context: AppActionContext,
  url: string,
  isSaved: boolean,
) {
  fromContext<
    (updater: (current: WardrobeItem[] | null) => WardrobeItem[] | null) => void
  >(
    context,
    "setProfileItems",
  )((current) =>
    Array.isArray(current)
      ? current.map((currentItem) =>
          String(currentItem?.url || "").trim() === url
            ? {
                ...currentItem,
                isSavedToWardrobe: isSaved,
                savedToMyWardrobe: isSaved,
              }
            : currentItem,
        )
      : current,
  );
}

function setMyWardrobeStatus(context: AppActionContext, infoKey: string) {
  fromContext<(updater: (current: unknown) => unknown) => void>(
    context,
    "setStatus",
  )((current) => ({
    ...(current as object),
    error: "",
    infoKey,
    infoParams: null,
  }));
}

function setMyWardrobeError(context: AppActionContext, error: string) {
  fromContext<(updater: (current: unknown) => unknown) => void>(
    context,
    "setStatus",
  )((current) => ({
    ...(current as object),
    error,
    infoKey: "",
    infoParams: null,
  }));
}

// eslint-disable-next-line complexity
function getUploadedWardrobeItemId(item: WardrobeItem) {
  const explicitId = item?.wardrobeId;
  if (explicitId !== null && explicitId !== undefined && explicitId !== "") {
    return String(explicitId);
  }

  const itemUrl = String(item?.url || "").trim();
  const wardrobeUrlMatch = itemUrl.match(/^wardrobe:\/\/(.+)$/i);
  if (wardrobeUrlMatch?.[1]) {
    return decodeURIComponent(wardrobeUrlMatch[1].replace(/^\/+/, ""));
  }

  return item?.source === "uploaded" && item?.id != null ? String(item.id) : "";
}

function mergeUpdatedUploadedItem(
  item: WardrobeItem,
  updatedItem: WardrobeItem,
) {
  return {
    ...item,
    ...updatedItem,
    id: item.id ?? updatedItem.id,
    source: "uploaded",
    wardrobeId: updatedItem.id ?? item.wardrobeId,
  };
}

function isSameWardrobeItem(currentItem: WardrobeItem, item: WardrobeItem) {
  const currentId = String(currentItem?.id ?? "");
  const itemId = String(item?.id ?? "");
  const currentUrl = String(currentItem?.url || "").trim();
  const itemUrl = String(item?.url || "").trim();

  return Boolean(
    (currentId && currentId === itemId) ||
    (currentUrl && currentUrl === itemUrl),
  );
}

export async function saveItemToMyWardrobe(
  context: AppActionContext,
  item: WardrobeItem,
) {
  const url = String(item?.url || "").trim();
  if (!url) return;

  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  try {
    await saveCatalogItemToMyWardrobe(url);
    applySavedFlagToProfileItems(context, url, true);
    setMyWardrobeStatus(context, "myWardrobe.saved");
  } catch (error) {
    setMyWardrobeError(
      context,
      (error as { message?: string })?.message === "not_found"
        ? fromContext<(key: string) => string>(
            context,
            "t",
          )("myWardrobe.saveNotFound")
        : fromContext<(key: string) => string>(
            context,
            "t",
          )("myWardrobe.saveFailed"),
    );
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      fromContext<(value: boolean) => void>(
        context,
        "setIsContentOperationLoading",
      )(false);
    }
  }
}

export async function removeItemFromMyWardrobe(
  context: AppActionContext,
  item: WardrobeItem,
) {
  const url = String(item?.url || "").trim();
  if (!url) return;

  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  try {
    await removeCatalogItemFromMyWardrobe(url);
    applySavedFlagToProfileItems(context, url, false);
    setMyWardrobeStatus(context, "myWardrobe.removed");
  } catch {
    setMyWardrobeError(
      context,
      fromContext<(key: string) => string>(
        context,
        "t",
      )("myWardrobe.removeFailed"),
    );
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      fromContext<(value: boolean) => void>(
        context,
        "setIsContentOperationLoading",
      )(false);
    }
  }
}

export async function updateUploadedItemInMyWardrobe(
  context: AppActionContext,
  item: WardrobeItem,
  payload: UploadedWardrobeItemUpdatePayload,
) {
  const id = getUploadedWardrobeItemId(item);
  if (!id) {
    throw new Error("missing_uploaded_item_id");
  }

  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  try {
    const response = (await updateUploadedWardrobeItem(id, payload)) as {
      item?: WardrobeItem | null;
    };
    const mergedItem = mergeUpdatedUploadedItem(item, response.item || payload);
    fromContext<
      (
        updater: (current: WardrobeItem[] | null) => WardrobeItem[] | null,
      ) => void
    >(
      context,
      "setProfileItems",
    )((current) =>
      Array.isArray(current)
        ? current.map((currentItem) =>
            isSameWardrobeItem(currentItem, item) ? mergedItem : currentItem,
          )
        : current,
    );
    setMyWardrobeStatus(context, "myWardrobe.updated");
    return mergedItem;
  } catch (error) {
    setMyWardrobeError(
      context,
      fromContext<(key: string) => string>(
        context,
        "t",
      )("myWardrobe.updateFailed"),
    );
    throw error;
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      fromContext<(value: boolean) => void>(
        context,
        "setIsContentOperationLoading",
      )(false);
    }
  }
}
