import {
  removeCatalogItemFromMyWardrobe,
  saveCatalogItemToMyWardrobe,
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
                is_saved_to_wardrobe: isSaved,
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
