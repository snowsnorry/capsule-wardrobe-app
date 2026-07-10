import { fromContext, type AppActionContext } from "./actionContext";

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

export function startCapsuleEventStream(
  _context: AppActionContext,
  _capsuleId: string | undefined,
) {
  return Promise.resolve();
}
