import {
  createCapsule,
  deleteCapsule,
  duplicateCapsule,
  fetchCapsule,
  renameCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  updateCapsuleFilters,
} from "../api/capsules";
import { initialStatus } from "./appConstants";
import { buildCapsuleStatus, buildEmptyCapsuleDraft } from "./capsuleState";
import { fromContext, type AppActionContext } from "./actionContext";
import { refreshCapsuleList } from "./capsuleListActions";
import type {
  CapsuleDraft,
  CapsuleListResponse,
  CapsuleMeta,
  CapsuleMutationResponse,
  WardrobeSnapshot,
} from "./appTypes";

async function runContentOperation(
  context: AppActionContext,
  operation: () => Promise<void>,
) {
  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  try {
    await operation();
  } finally {
    fromContext<(value: boolean) => void>(
      context,
      "setIsContentOperationLoading",
    )(false);
  }
}

export async function createNewCapsule(context: AppActionContext) {
  await runContentOperation(context, async () => {
    const result = (await createCapsule({
      filters: buildEmptyCapsuleDraft().filters,
    })) as CapsuleMutationResponse;
    fromContext<(capsule?: CapsuleMeta | null) => void>(
      context,
      "applyCapsuleState",
    )(result.capsule);
    await refreshCapsuleList(context);
  });
}

export async function openCapsule(
  context: AppActionContext,
  capsuleId: string,
) {
  await runContentOperation(context, async () => {
    const result = (await fetchCapsule(capsuleId)) as {
      capsule?: CapsuleMeta | null;
      snapshot?: WardrobeSnapshot;
    };
    fromContext<(capsule?: CapsuleMeta | null) => void>(
      context,
      "applyCapsuleState",
    )(result.capsule);
    await fromContext<
      (
        capsuleId?: string,
        snapshot?: WardrobeSnapshot,
        options?: unknown,
      ) => Promise<void>
    >(context, "restoreCapsuleSnapshot")(result.capsule?.id, result.snapshot, {
      shouldResumeEvents: true,
    });
    await refreshCapsuleList(context);
  });
}

async function mutateCurrentCapsule(
  context: AppActionContext,
  capsuleId: string,
  mutation: () => Promise<CapsuleMutationResponse>,
  applyResult: (result: CapsuleMutationResponse) => void,
) {
  if (!capsuleId) return;
  await runContentOperation(context, async () => {
    const result = await mutation();
    applyResult(result);
    await refreshCapsuleList(context);
  });
}

export async function saveCurrentCapsule(
  context: AppActionContext,
  capsuleId: string,
) {
  await mutateCurrentCapsule(
    context,
    capsuleId,
    () => saveCapsule(capsuleId) as Promise<CapsuleMutationResponse>,
    (result) => {
      if (capsuleId === fromContext<string>(context, "activeCapsuleId")) {
        fromContext<(capsule?: CapsuleMeta | null) => void>(
          context,
          "setActiveCapsuleMeta",
        )(result.capsule);
      }
    },
  );
}

export async function revertCurrentCapsule(
  context: AppActionContext,
  capsuleId: string,
) {
  await mutateCurrentCapsule(
    context,
    capsuleId,
    () => revertCapsule(capsuleId) as Promise<CapsuleMutationResponse>,
    (result) => {
      if (capsuleId === fromContext<string>(context, "activeCapsuleId")) {
        fromContext<(capsule?: CapsuleMeta | null) => void>(
          context,
          "applyCapsuleState",
        )(result.capsule);
      }
    },
  );
}

export async function renameCurrentCapsule(
  context: AppActionContext,
  name: string,
  capsuleId: string,
) {
  await mutateCurrentCapsule(
    context,
    capsuleId,
    () => renameCapsule(capsuleId, name) as Promise<CapsuleMutationResponse>,
    (result) => {
      if (capsuleId === fromContext<string>(context, "activeCapsuleId")) {
        fromContext<(capsule?: CapsuleMeta | null) => void>(
          context,
          "setActiveCapsuleMeta",
        )(result.capsule);
      }
    },
  );
}

export async function duplicateCurrentCapsule(
  context: AppActionContext,
  name: string,
  capsuleId: string,
) {
  await mutateCurrentCapsule(
    context,
    capsuleId,
    () => duplicateCapsule(capsuleId, name) as Promise<CapsuleMutationResponse>,
    (result) => {
      fromContext<(capsule?: CapsuleMeta | null) => void>(
        context,
        "applyCapsuleState",
      )(result.capsule);
    },
  );
}

export async function deleteCurrentCapsule(
  context: AppActionContext,
  capsuleId: string,
) {
  await mutateCurrentCapsule(
    context,
    capsuleId,
    () => deleteCapsule(capsuleId) as Promise<CapsuleMutationResponse>,
    (result) => {
      if (result.activeCapsule) {
        fromContext<(capsule?: CapsuleMeta | null) => void>(
          context,
          "applyCapsuleState",
        )(result.activeCapsule);
      }
    },
  );
}

export async function searchUserCapsules(query: string) {
  const result = (await searchCapsules(query)) as CapsuleListResponse;
  return result.capsules || [];
}

export { refreshCapsuleList } from "./capsuleListActions";
export {
  importSharedCapsuleToApp,
  shareCurrentCapsule,
} from "./capsuleShareActions";

export async function resetProfileFilters(context: AppActionContext) {
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

export async function applyCapsuleFilters(context: AppActionContext) {
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
    applyFilterUpdateResult(context, result, draft, capsuleId);
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

function applyFilterUpdateResult(
  context: AppActionContext,
  result: CapsuleMutationResponse,
  draft: CapsuleDraft,
  capsuleId: string,
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
  fromContext<(value: boolean) => void>(context, "setIsLoadingItems")(true);
  if (result?.status === "pending") {
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
