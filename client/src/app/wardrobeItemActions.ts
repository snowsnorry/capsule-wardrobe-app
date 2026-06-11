import {
  removeCatalogItemFromPersonalItems,
  saveCatalogItemToPersonalItems,
  updateUploadedWardrobeItem,
  type UploadedWardrobeItemUpdatePayload,
} from "../api/personalItems";
import { fromContext, type AppActionContext } from "./actionContext";
import type { WardrobeItem } from "./appTypes";
import { notifyPersonalItemsChanged } from "./personalItemsCount";

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
              }
            : currentItem,
        )
      : current,
  );
}

function setPersonalItemsStatus(context: AppActionContext, infoKey: string) {
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

function setPersonalItemsError(context: AppActionContext, error: string) {
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

function getUploadedWardrobeItemId(item: WardrobeItem) {
  const explicitId = item?.wardrobeId;
  if (explicitId !== null && explicitId !== undefined && explicitId !== "") {
    return String(explicitId);
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
  const currentIds = [currentItem?.id, currentItem?.wardrobeId]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const itemIds = [item?.id, item?.wardrobeId]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return currentIds.some((currentId) => itemIds.includes(currentId));
}

export async function saveItemToPersonalItems(
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
    await saveCatalogItemToPersonalItems(url);
    applySavedFlagToProfileItems(context, url, true);
    setPersonalItemsStatus(context, "wardrobe.saved");
    notifyPersonalItemsChanged();
  } catch (error) {
    setPersonalItemsError(
      context,
      (error as { message?: string })?.message === "not_found"
        ? fromContext<(key: string) => string>(
            context,
            "t",
          )("wardrobe.saveNotFound")
        : fromContext<(key: string) => string>(
            context,
            "t",
          )("wardrobe.saveFailed"),
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

export async function removeItemFromPersonalItems(
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
    await removeCatalogItemFromPersonalItems(url);
    applySavedFlagToProfileItems(context, url, false);
    setPersonalItemsStatus(context, "wardrobe.removed");
    notifyPersonalItemsChanged();
  } catch {
    setPersonalItemsError(
      context,
      fromContext<(key: string) => string>(
        context,
        "t",
      )("wardrobe.removeFailed"),
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

export async function updateUploadedItemInPersonalItems(
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
    setPersonalItemsStatus(context, "wardrobe.updated");
    return mergedItem;
  } catch (error) {
    setPersonalItemsError(
      context,
      fromContext<(key: string) => string>(
        context,
        "t",
      )("wardrobe.updateFailed"),
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
