import {
  regenerateCapsuleWardrobe,
  regenerateSelectedWardrobeItems,
} from "../api/wardrobe";
import { downloadCapsulePdf } from "../api/capsules";
import { fromContext, type AppActionContext } from "./actionContext";
import {
  clearNotificationFlow,
  handleWardrobeError,
  startCapsuleEventStream,
  stopCapsuleEventStream,
} from "./wardrobeStreamActions";
import type { WardrobeItem, WardrobeMutationResponse } from "./appTypes";

function failWardrobeStream(context: AppActionContext, error?: unknown) {
  stopCapsuleEventStream(context);
  clearNotificationFlow(context);
  handleWardrobeError(context);
  if (error) {
    fromContext<(updater: (current: unknown) => unknown) => void>(
      context,
      "setStatus",
    )((current) => ({
      ...(current as object),
      error: fromContext<(error: unknown) => string>(
        context,
        "resolveErrorMessage",
      )(error),
    }));
  }
}

export async function refreshWardrobe(context: AppActionContext) {
  const capsuleId = fromContext<string>(context, "activeCapsuleId");
  fromContext<(value: []) => void>(context, "setSelectedRegenerationUrls")([]);
  fromContext<{ current: string[] }>(
    context,
    "pendingRegenerationUrlsRef",
  ).current = [];
  fromContext<{ current: WardrobeItem[] }>(
    context,
    "regenerationBaseItemsRef",
  ).current = [];
  fromContext<{ current: string }>(
    context,
    "manualWardrobeRegenerationCapsuleIdRef",
  ).current = capsuleId;
  stopCapsuleEventStream(context);
  fromContext<(value: []) => void>(
    context,
    "setPartialRegenerationPendingUrls",
  )([]);
  fromContext<(value: boolean) => void>(
    context,
    "setIsPartialRegenerationLoading",
  )(false);
  fromContext<(updater: (current: unknown) => unknown) => void>(
    context,
    "setStatus",
  )((current) => ({
    ...(current as object),
    error: "",
  }));
  fromContext<(value: boolean) => void>(context, "setIsLoadingItems")(true);
  try {
    const response = (await regenerateCapsuleWardrobe({
      capsuleId,
    })) as WardrobeMutationResponse;
    await handlePendingWardrobeResponse(context, response, "full", capsuleId);
  } catch (error) {
    failWardrobeStream(context);
    fromContext<(updater: (current: unknown) => unknown) => void>(
      context,
      "setStatus",
    )((current) => ({
      ...(current as object),
      error: fromContext<(error: unknown) => string>(
        context,
        "resolveErrorMessage",
      )(error),
    }));
  }
}

async function handlePendingWardrobeResponse(
  context: AppActionContext,
  response: WardrobeMutationResponse,
  notificationKind: string,
  capsuleId: string,
) {
  if (response?.status === "pending") {
    fromContext<(kind: string, llm?: string) => void>(
      context,
      "startPendingNotificationFlow",
    )(notificationKind);
    startCapsuleEventStream(context, capsuleId);
    return;
  }
  if (response?.status === "ready" || Array.isArray(response?.items)) {
    await fromContext<
      (
        snapshot: WardrobeMutationResponse,
        capsuleId?: string,
        options?: { refreshReadyCapsule?: boolean },
      ) => Promise<void>
    >(context, "applyWardrobeSnapshot")(response, capsuleId);
    return;
  }
  fromContext<(value: boolean) => void>(context, "setIsLoadingItems")(false);
}

export async function downloadWardrobePdf(
  context: AppActionContext,
  capsuleId: string,
) {
  if (!capsuleId) return;
  fromContext<(value: boolean) => void>(
    context,
    "setIsDownloadingWardrobePdf",
  )(true);
  try {
    await downloadCapsulePdf(capsuleId);
  } catch {
    fromContext<(updater: (current: unknown) => unknown) => void>(
      context,
      "setStatus",
    )((current) => ({
      ...(current as object),
      error: fromContext<(key: string) => string>(
        context,
        "t",
      )("errors.downloadFailed"),
    }));
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      fromContext<(value: boolean) => void>(
        context,
        "setIsDownloadingWardrobePdf",
      )(false);
    }
  }
}

export function toggleRegenerationSelection(
  context: AppActionContext,
  item: WardrobeItem,
) {
  const itemUrl = String(item?.url || "").trim();
  if (!itemUrl || fromContext<boolean>(context, "isPartialRegenerationLoading"))
    return;
  fromContext<(updater: (current: string[]) => string[]) => void>(
    context,
    "setSelectedRegenerationUrls",
  )((current) =>
    current.includes(itemUrl)
      ? current.filter((url) => url !== itemUrl)
      : [...current, itemUrl],
  );
}

export async function regenerateSelectedItems(context: AppActionContext) {
  const selectedUrls = fromContext<string[]>(
    context,
    "selectedRegenerationUrls",
  );
  const capsuleId = fromContext<string>(context, "activeCapsuleId");
  if (
    selectedUrls.length === 0 ||
    fromContext<boolean>(context, "isPartialRegenerationLoading") ||
    !capsuleId
  )
    return;

  const existingItems = Array.isArray(
    fromContext<WardrobeItem[] | null>(context, "profileItems"),
  )
    ? fromContext<WardrobeItem[]>(context, "profileItems")
    : [];
  preparePartialRegeneration(context, selectedUrls, existingItems);
  try {
    const response = (await regenerateSelectedWardrobeItems({
      itemUrls: selectedUrls,
      capsuleId,
    })) as WardrobeMutationResponse;
    if (response?.status === "pending") {
      fromContext<(kind: string) => void>(
        context,
        "startPendingNotificationFlow",
      )("partial");
      startCapsuleEventStream(context, capsuleId);
      return;
    }
    fromContext<(value: boolean) => void>(
      context,
      "setIsPartialRegenerationLoading",
    )(false);
  } catch (error) {
    handlePartialRegenerationError(context, error, existingItems);
  }
}

export {
  deleteGeneratedOutfitSetImage,
  generateOutfitSetImage,
} from "./wardrobeImageActions";
export {
  removeItemFromPersonalItems,
  saveItemToPersonalItems,
  updateUploadedItemInPersonalItems,
} from "./wardrobeItemActions";
export {
  handleWardrobeError,
  startCapsuleEventStream,
  stopCapsuleEventStream,
} from "./wardrobeStreamActions";

function preparePartialRegeneration(
  context: AppActionContext,
  pendingUrls: string[],
  existingItems: WardrobeItem[],
) {
  fromContext<(value: []) => void>(context, "setSelectedRegenerationUrls")([]);
  fromContext<{ current: string[] }>(
    context,
    "pendingRegenerationUrlsRef",
  ).current = pendingUrls;
  fromContext<{ current: WardrobeItem[] }>(
    context,
    "regenerationBaseItemsRef",
  ).current = existingItems;
  fromContext<(value: string[]) => void>(
    context,
    "setPartialRegenerationPendingUrls",
  )(pendingUrls);
  fromContext<(value: boolean) => void>(
    context,
    "setIsPartialRegenerationLoading",
  )(true);
}

function handlePartialRegenerationError(
  context: AppActionContext,
  error: unknown,
  existingItems: WardrobeItem[],
) {
  if (!fromContext<{ current: boolean }>(context, "isMountedRef").current)
    return;
  fromContext<(value: WardrobeItem[]) => void>(
    context,
    "setProfileItems",
  )(existingItems);
  fromContext<{ current: string[] }>(
    context,
    "pendingRegenerationUrlsRef",
  ).current = [];
  fromContext<{ current: WardrobeItem[] }>(
    context,
    "regenerationBaseItemsRef",
  ).current = [];
  fromContext<(value: []) => void>(
    context,
    "setPartialRegenerationPendingUrls",
  )([]);
  fromContext<(value: boolean) => void>(
    context,
    "setIsPartialRegenerationLoading",
  )(false);
  clearNotificationFlow(context);
  fromContext<(updater: (current: unknown) => unknown) => void>(
    context,
    "setStatus",
  )((current) => ({
    ...(current as object),
    error:
      (error as { message?: string })?.message === "invalid_payload"
        ? fromContext<(error: unknown) => string>(
            context,
            "resolveErrorMessage",
          )(error)
        : fromContext<(key: string) => string>(
            context,
            "t",
          )("errors.regenerateSelectedFailed"),
  }));
}
