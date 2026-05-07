import { subscribeCapsuleEvents } from "../api/wardrobe";
import { fromContext, type AppActionContext } from "./actionContext";
import type { WardrobeSnapshot } from "./appTypes";

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

export function clearNotificationFlow(context: AppActionContext) {
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
