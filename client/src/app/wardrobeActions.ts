import {
  deleteOutfitSetImage as requestOutfitSetImageDeletion,
  generateOutfitSetImage as requestOutfitSetImageGeneration,
  regenerateCapsuleWardrobe,
  regenerateSelectedWardrobeItems,
  subscribeCapsuleEvents,
} from "../api/wardrobe";
import { downloadCapsulePdf } from "../api/capsules";
import { fromContext, type AppActionContext } from "./actionContext";
import type {
  OutfitSetSnapshot,
  WardrobeItem,
  WardrobeMutationResponse,
  WardrobeSnapshot,
} from "./appTypes";

export function handleWardrobeError(context: AppActionContext) {
  fromContext<(value: []) => void>(context, "setProfileItems")([]);
  fromContext<(value: []) => void>(context, "setProfileOutfitSets")([]);
  fromContext<(value: []) => void>(context, "setPendingImageSetIndexes")([]);
  fromContext<(value: []) => void>(context, "setSelectedRegenerationUrls")([]);
  fromContext<(value: []) => void>(
    context,
    "setPartialRegenerationPendingUrls",
  )([]);
  fromContext<(value: boolean) => void>(
    context,
    "setIsPartialRegenerationLoading",
  )(false);
  fromContext<(value: boolean) => void>(context, "setIsWardrobePending")(false);
  fromContext<(value: boolean) => void>(
    context,
    "setHasPendingAdditionalItems",
  )(false);
  fromContext<(value: boolean) => void>(context, "setIsLoadingItems")(false);
}

export function stopCapsuleEventStream(context: AppActionContext) {
  const abortRef = fromContext<{ current: AbortController | null }>(
    context,
    "capsuleEventsAbortRef",
  );
  if (!abortRef.current) return;
  abortRef.current.abort();
  abortRef.current = null;
}

function clearNotificationFlow(context: AppActionContext) {
  fromContext<{ current: string }>(
    context,
    "pendingNotificationKindRef",
  ).current = "";
  fromContext<() => void>(context, "closeNotificationPrompt")();
}

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

export function startCapsuleEventStream(
  context: AppActionContext,
  capsuleId: string | undefined,
) {
  const normalizedCapsuleId = String(capsuleId || "").trim();
  if (!normalizedCapsuleId) return Promise.resolve();

  stopCapsuleEventStream(context);
  const abortController = new AbortController();
  fromContext<{ current: AbortController | null }>(
    context,
    "capsuleEventsAbortRef",
  ).current = abortController;

  return subscribeCapsuleEvents({
    capsuleId: normalizedCapsuleId,
    signal: abortController.signal,
    onMessage(event) {
      if (
        event.event !== "snapshot" ||
        !fromContext<{ current: boolean }>(context, "isMountedRef").current
      )
        return;
      fromContext<
        (snapshot?: WardrobeSnapshot, capsuleId?: string) => Promise<void>
      >(context, "applyWardrobeSnapshot")(
        event.data,
        normalizedCapsuleId,
      ).catch(() => {
        if (
          fromContext<{ current: boolean }>(context, "isMountedRef").current
        ) {
          failWardrobeStream(context);
        }
      });
    },
    onError(error) {
      if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
        failWardrobeStream(context, error);
      }
    },
  }).catch((error) => {
    if (
      !abortController.signal.aborted &&
      fromContext<{ current: boolean }>(context, "isMountedRef").current
    ) {
      failWardrobeStream(context, error);
    }
  });
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
  fromContext<(value: boolean) => void>(context, "setIsLoadingItems")(true);
  try {
    const response = (await regenerateCapsuleWardrobe({
      capsuleId,
    })) as WardrobeMutationResponse;
    handlePendingWardrobeResponse(context, response, "full", capsuleId);
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

function handlePendingWardrobeResponse(
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

export async function generateOutfitSetImage(
  context: AppActionContext,
  setIndex: number | string | null | undefined,
) {
  const normalizedSetIndex = Number.parseInt(String(setIndex ?? ""), 10);
  const capsuleId = fromContext<string>(context, "activeCapsuleId");
  if (
    !capsuleId ||
    !Number.isInteger(normalizedSetIndex) ||
    normalizedSetIndex < 0
  )
    return;

  setPendingImage(context, normalizedSetIndex);
  try {
    const response = (await requestOutfitSetImageGeneration({
      capsuleId,
      setIndex: normalizedSetIndex,
    })) as WardrobeMutationResponse;
    if (response?.status === "pending") {
      fromContext<(kind: string, llm?: string) => void>(
        context,
        "startPendingNotificationFlow",
      )(
        "image",
        fromContext<{ imageLlm: string }>(context, "settingsProfile").imageLlm,
      );
      startCapsuleEventStream(context, capsuleId);
      return;
    }
    clearPendingImage(context, normalizedSetIndex);
  } catch (error) {
    if (!fromContext<{ current: boolean }>(context, "isMountedRef").current)
      return;
    clearPendingImage(context, normalizedSetIndex);
    clearNotificationFlow(context);
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

function setPendingImage(context: AppActionContext, setIndex: number) {
  fromContext<(updater: (current: number[]) => number[]) => void>(
    context,
    "setPendingImageSetIndexes",
  )((current) =>
    current.includes(setIndex)
      ? current
      : [...current, setIndex].sort((left, right) => left - right),
  );
}

function clearPendingImage(context: AppActionContext, setIndex: number) {
  fromContext<(updater: (current: number[]) => number[]) => void>(
    context,
    "setPendingImageSetIndexes",
  )((current) => current.filter((value) => value !== setIndex));
}

export async function deleteGeneratedOutfitSetImage(
  context: AppActionContext,
  setIndex: number | string | null | undefined,
) {
  const normalizedSetIndex = Number.parseInt(String(setIndex ?? ""), 10);
  const capsuleId = fromContext<string>(context, "activeCapsuleId");
  if (
    !capsuleId ||
    !Number.isInteger(normalizedSetIndex) ||
    normalizedSetIndex < 0
  )
    return;

  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  try {
    await requestOutfitSetImageDeletion({
      capsuleId,
      setIndex: normalizedSetIndex,
    });
    fromContext<
      (updater: (current: OutfitSetSnapshot[]) => OutfitSetSnapshot[]) => void
    >(
      context,
      "setProfileOutfitSets",
    )((current) =>
      current.map((set, index) =>
        index === normalizedSetIndex
          ? { ...set, image: null, imageObsolete: false }
          : set,
      ),
    );
    startCapsuleEventStream(context, capsuleId);
  } catch (error) {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
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
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      fromContext<(value: boolean) => void>(
        context,
        "setIsContentOperationLoading",
      )(false);
    }
  }
}
