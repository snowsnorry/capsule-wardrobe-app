import {
  regenerateCapsuleWardrobe,
  regenerateSelectedWardrobeItems,
} from "../api/wardrobe";
import { downloadCapsulePdf, fetchCapsule } from "../api/capsules";
import type { JobResponse, JobSnapshot } from "../api/jobs";
import { fromContext, type AppActionContext } from "./actionContext";
import {
  clearNotificationFlow,
  handleWardrobeError,
  startCapsuleEventStream,
  stopCapsuleEventStream,
} from "./wardrobeStreamActions";
import type { WardrobeItem } from "./appTypes";

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

function throwIfJobFailed(response: JobResponse) {
  if (response.job.status !== "failed") return;
  throw new Error(response.job.error?.code || "service_unavailable");
}

function isMounted(context: AppActionContext) {
  return fromContext<{ current: boolean }>(context, "isMountedRef").current;
}

async function reconcileCapsuleGenerationJob(
  context: AppActionContext,
  capsuleId: string,
  job: JobSnapshot,
) {
  if (!isMounted(context)) return;

  try {
    const result = (await fetchCapsule(capsuleId)) as {
      snapshot?: Record<string, unknown>;
    };
    if (!isMounted(context) || !result.snapshot) return;

    if (job.status === "failed") {
      result.snapshot = { ...result.snapshot, status: "failed" };
    }
    await fromContext<(snapshot: unknown, capsuleId: string) => Promise<void>>(
      context,
      "applyWardrobeSnapshot",
    )(result.snapshot, capsuleId);
  } catch {
    if (!isMounted(context) || job.status !== "failed") return;
    await fromContext<(snapshot: unknown, capsuleId: string) => Promise<void>>(
      context,
      "applyWardrobeSnapshot",
    )(
      {
        status: "failed",
        items: fromContext<WardrobeItem[] | null>(context, "profileItems"),
        outfitSets: fromContext<unknown[]>(context, "profileOutfitSets"),
      },
      capsuleId,
    );
  }
}

export function watchCapsuleGenerationJob(
  context: AppActionContext,
  capsuleId: string,
  jobId: string,
) {
  void fromContext<(jobId: string) => Promise<JobSnapshot>>(
    context,
    "waitForJobCompletion",
  )(jobId)
    .then((job) => reconcileCapsuleGenerationJob(context, capsuleId, job))
    .catch(() => undefined);
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
    const response = await regenerateCapsuleWardrobe({ capsuleId });
    throwIfJobFailed(response);
    fromContext<(kind: string, llm?: string) => void>(
      context,
      "startPendingNotificationFlow",
    )("full");
    startCapsuleEventStream(context, capsuleId);
    watchCapsuleGenerationJob(context, capsuleId, response.job.id);
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
    throwIfJobFailed(
      await regenerateSelectedWardrobeItems({
        itemUrls: selectedUrls,
        capsuleId,
      }),
    );
    fromContext<(kind: string) => void>(
      context,
      "startPendingNotificationFlow",
    )("partial");
    startCapsuleEventStream(context, capsuleId);
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
