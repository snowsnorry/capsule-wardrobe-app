import { fetchCapsule, updateCapsuleFilters } from "../api/capsules";
import { initialStatus } from "./appConstants";
import { fromContext, type AppActionContext } from "./actionContext";
import { runContentOperation } from "./capsuleActionOperation";
import { refreshCapsuleList } from "./capsuleListActions";
import { buildCapsuleStatus } from "./capsuleState";
import type {
  CapsuleDraft,
  CapsuleMeta,
  CapsuleMutationResponse,
} from "./appTypes";

async function resetProfileFilters(context: AppActionContext) {
  fromContext<(value: unknown) => void>(context, "setStatus")(initialStatus);
  fromContext<(value: []) => void>(context, "setSelectedRegenerationUrls")([]);
  fromContext<(value: []) => void>(
    context,
    "setPartialRegenerationPendingUrls",
  )([]);
  fromContext<(value: boolean) => void>(
    context,
    "setIsPartialRegenerationLoading",
  )(false);
  await runContentOperation(context, async () => {
    const capsuleId = fromContext<string>(context, "activeCapsuleId");
    if (!capsuleId) return;
    const result = (await fetchCapsule(capsuleId)) as {
      capsule?: CapsuleMeta | null;
    };
    fromContext<(capsule?: CapsuleMeta | null) => void>(
      context,
      "applyCapsuleState",
    )(result.capsule);
  }).catch((error) => {
    fromContext<(value: unknown) => void>(
      context,
      "setStatus",
    )({
      loading: false,
      error: fromContext<(error: unknown) => string>(
        context,
        "resolveErrorMessage",
      )(error),
      infoKey: "",
      infoParams: null,
    });
  });
}

async function applyCapsuleFilters(context: AppActionContext) {
  const capsuleId = fromContext<string>(context, "activeCapsuleId");
  if (!capsuleId) return;

  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  fromContext<(value: unknown) => void>(
    context,
    "setStatus",
  )({ loading: true, error: "", infoKey: "", infoParams: null });
  try {
    const draft = fromContext<() => CapsuleDraft>(
      context,
      "buildCurrentDraftSnapshot",
    )();
    const result = (await updateCapsuleFilters(capsuleId, draft.filters, {
      regenerate: true,
    })) as CapsuleMutationResponse;
    throwIfFilterRegenerationFailed(result);
    applyFilterUpdateResult(context, result, draft);
    await refreshCapsuleList(context);
    startFilterRegeneration(context, result, capsuleId);
    fromContext<(value: unknown) => void>(
      context,
      "setStatus",
    )({
      loading: false,
      error: "",
      infoKey: "profile.updated",
      infoParams: null,
    });
  } catch (error) {
    fromContext<(value: unknown) => void>(
      context,
      "setStatus",
    )({
      loading: false,
      error: fromContext<(error: unknown) => string>(
        context,
        "resolveErrorMessage",
      )(error),
      infoKey: "",
      infoParams: null,
    });
  } finally {
    fromContext<(value: boolean) => void>(
      context,
      "setIsContentOperationLoading",
    )(false);
  }
}

function throwIfFilterRegenerationFailed(result: CapsuleMutationResponse) {
  if (result?.job?.status !== "failed") return;
  throw new Error(result.job.error?.code || "service_unavailable");
}

function shouldStartFilterRegenerationStream(result: CapsuleMutationResponse) {
  if (result?.status === "pending") return true;
  const job = result?.job;
  return Boolean(
    job &&
    job.kind === "capsuleGenerate" &&
    (job.status === "queued" || job.status === "running"),
  );
}

function applyFilterUpdateResult(
  context: AppActionContext,
  result: CapsuleMutationResponse,
  draft: CapsuleDraft,
) {
  fromContext<
    (
      updater: (current: CapsuleMeta | null) => CapsuleMeta | null | undefined,
    ) => void
  >(
    context,
    "setActiveCapsuleMeta",
  )((current) => {
    if (result?.capsule || !current) return result?.capsule || current;
    const next = {
      ...current,
      draft: {
        filters: draft.filters,
        data: { wardrobe: null, rejectedUrls: [] },
      },
    };
    return { ...next, status: buildCapsuleStatus(next) };
  });
}

function prepareFilterRegenerationState(
  context: AppActionContext,
  capsuleId: string,
) {
  fromContext<(value: []) => void>(context, "setProfileItems")([]);
  fromContext<(value: []) => void>(context, "setProfileOutfitSets")([]);
  fromContext<(value: []) => void>(context, "setPendingImageSetIndexes")([]);
  fromContext<{ current: string }>(
    context,
    "manualWardrobeRegenerationCapsuleIdRef",
  ).current = capsuleId;
}

function startFilterRegeneration(
  context: AppActionContext,
  result: CapsuleMutationResponse,
  capsuleId: string,
) {
  if (shouldStartFilterRegenerationStream(result)) {
    prepareFilterRegenerationState(context, capsuleId);
    fromContext<(value: boolean) => void>(context, "setIsLoadingItems")(true);
    fromContext<(kind: string) => void>(
      context,
      "startPendingNotificationFlow",
    )("full");
    fromContext<(capsuleId: string) => void>(
      context,
      "startCapsuleEventStream",
    )(capsuleId);
    return;
  }
  fromContext<(value: boolean) => void>(context, "setIsLoadingItems")(false);
}

export { applyCapsuleFilters, resetProfileFilters };
