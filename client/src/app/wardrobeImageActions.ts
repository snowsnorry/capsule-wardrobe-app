import {
  deleteOutfitSetImage as requestOutfitSetImageDeletion,
  generateOutfitSetImage as requestOutfitSetImageGeneration,
} from "../api/wardrobe";
import { fromContext, type AppActionContext } from "./actionContext";
import { startCapsuleEventStream } from "./wardrobeStreamActions";
import type { OutfitSetSnapshot, WardrobeMutationResponse } from "./appTypes";

function clearNotificationFlow(context: AppActionContext) {
  fromContext<{ current: string }>(
    context,
    "pendingNotificationKindRef",
  ).current = "";
  fromContext<() => void>(context, "closeNotificationPrompt")();
}

function startImageNotificationFlow(context: AppActionContext) {
  fromContext<(kind: string, llm?: string) => void>(
    context,
    "startPendingNotificationFlow",
  )(
    "image",
    fromContext<{ imageLlm: string }>(context, "settingsProfile").imageLlm,
  );
}

function setStatusError(context: AppActionContext, error: unknown) {
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

function handleOutfitSetImageError(
  context: AppActionContext,
  setIndex: number,
  error: unknown,
) {
  if (!fromContext<{ current: boolean }>(context, "isMountedRef").current) {
    return;
  }
  clearPendingImage(context, setIndex);
  clearNotificationFlow(context);
  setStatusError(context, error);
}

function waitForQueuedOutfitSetImage(
  context: AppActionContext,
  capsuleId: string,
  setIndex: number,
  jobId: string,
) {
  startImageNotificationFlow(context);
  const waitForJobCompletion = fromContext<
    (jobId: string) => Promise<{
      status: string;
      error?: { code?: string | null } | null;
    }>
  >(context, "waitForJobCompletion");
  void waitForJobCompletion(jobId)
    .then((finishedJob) => {
      if (finishedJob.status !== "completed") {
        throw new Error(finishedJob.error?.code || "service_unavailable");
      }
      startCapsuleEventStream(context, capsuleId);
    })
    .catch((error) => {
      handleOutfitSetImageError(context, setIndex, error);
    });
}

function applyReadyOutfitSetImage(
  context: AppActionContext,
  setIndex: number,
  image: string,
) {
  fromContext<
    (updater: (current: OutfitSetSnapshot[]) => OutfitSetSnapshot[]) => void
  >(
    context,
    "setProfileOutfitSets",
  )((current) =>
    current.map((set, index) =>
      index === setIndex
        ? { ...set, image: image || null, imageObsolete: false }
        : set,
    ),
  );
}

function handleOutfitSetImageGenerationResponse({
  capsuleId,
  context,
  response,
  setIndex,
}: {
  capsuleId: string;
  context: AppActionContext;
  response: WardrobeMutationResponse;
  setIndex: number;
}) {
  if (response?.job && typeof response.job.id === "string") {
    waitForQueuedOutfitSetImage(context, capsuleId, setIndex, response.job.id);
    return;
  }
  if (response?.status === "pending") {
    startImageNotificationFlow(context);
    startCapsuleEventStream(context, capsuleId);
    return;
  }
  if (typeof response?.image === "string") {
    applyReadyOutfitSetImage(context, setIndex, response.image);
  }
  clearPendingImage(context, setIndex);
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
    handleOutfitSetImageGenerationResponse({
      capsuleId,
      context,
      response,
      setIndex: normalizedSetIndex,
    });
  } catch (error) {
    handleOutfitSetImageError(context, normalizedSetIndex, error);
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
