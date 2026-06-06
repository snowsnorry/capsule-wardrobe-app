import { likeItem, removeItemLike } from "../api/likedItems";
import {
  getCanonicalItemUrl,
  patchLikedStateByUrl,
} from "../utils/likedItemState";
import { fromContext, type AppActionContext } from "./actionContext";
import type { CapsuleMeta, WardrobeItem } from "./appTypes";

export async function setItemLike(
  context: AppActionContext,
  item: WardrobeItem,
  isLiked: boolean,
) {
  const itemUrl = getCanonicalItemUrl(item);
  if (!itemUrl) {
    return;
  }

  const snapshot = getLocallyVisibleItemsSnapshot(context);
  patchLocallyVisibleItems(context, itemUrl, isLiked);
  try {
    if (isLiked) {
      await likeItem(itemUrl);
      return;
    }
    await removeItemLike(itemUrl);
  } catch (error) {
    restoreLocallyVisibleItems(context, snapshot);
    fromContext<(updater: (current: unknown) => unknown) => void>(
      context,
      "setStatus",
    )((current) => ({
      ...(current as object),
      error: fromContext<(key: string) => string>(
        context,
        "t",
      )("wardrobe.likeFailed"),
    }));
    throw error;
  }
}

function getLocallyVisibleItemsSnapshot(context: AppActionContext) {
  return {
    activeCapsuleMeta: fromContext<CapsuleMeta | null>(
      context,
      "activeCapsuleMeta",
    ),
    capsuleList: fromContext<CapsuleMeta[]>(context, "capsuleList"),
    profileItems: fromContext<WardrobeItem[] | null>(context, "profileItems"),
  };
}

function restoreLocallyVisibleItems(
  context: AppActionContext,
  snapshot: ReturnType<typeof getLocallyVisibleItemsSnapshot>,
) {
  fromContext<(value: WardrobeItem[] | null) => void>(
    context,
    "setProfileItems",
  )(snapshot.profileItems);
  fromContext<(value: CapsuleMeta | null) => void>(
    context,
    "setActiveCapsuleMeta",
  )(snapshot.activeCapsuleMeta);
  fromContext<(value: CapsuleMeta[]) => void>(
    context,
    "setCapsuleList",
  )(snapshot.capsuleList);
}

function patchLocallyVisibleItems(
  context: AppActionContext,
  itemUrl: string,
  isLiked: boolean,
) {
  fromContext<
    (updater: (current: WardrobeItem[] | null) => WardrobeItem[] | null) => void
  >(
    context,
    "setProfileItems",
  )((current) => patchLikedStateByUrl(current, itemUrl, isLiked));
  fromContext<
    (updater: (current: CapsuleMeta | null) => CapsuleMeta | null) => void
  >(
    context,
    "setActiveCapsuleMeta",
  )((current) => patchLikedStateByUrl(current, itemUrl, isLiked));
  fromContext<(updater: (current: CapsuleMeta[]) => CapsuleMeta[]) => void>(
    context,
    "setCapsuleList",
  )((current) => patchLikedStateByUrl(current, itemUrl, isLiked));
}
