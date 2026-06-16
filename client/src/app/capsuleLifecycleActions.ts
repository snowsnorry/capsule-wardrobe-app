import {
  createCapsule,
  deleteCapsule,
  duplicateCapsule,
  fetchCapsule,
  renameCapsule,
  revertCapsule,
  saveCapsule,
  setCapsulePin,
} from "../api/capsules";
import { fromContext, type AppActionContext } from "./actionContext";
import { runContentOperation } from "./capsuleActionOperation";
import { refreshCapsuleList } from "./capsuleListActions";
import { buildEmptyCapsuleDraft } from "./capsuleState";
import type {
  CapsuleMeta,
  CapsuleMutationResponse,
  WardrobeSnapshot,
} from "./appTypes";

async function createNewCapsule(context: AppActionContext) {
  let createdCapsule: CapsuleMeta | null = null;
  await runContentOperation(context, async () => {
    const result = (await createCapsule({
      filters: buildEmptyCapsuleDraft().filters,
    })) as CapsuleMutationResponse;
    createdCapsule = result.capsule || null;
    fromContext<(capsule?: CapsuleMeta | null) => void>(
      context,
      "applyCapsuleState",
    )(result.capsule);
  });
  void refreshCapsuleList(context).catch(() => undefined);
  return createdCapsule;
}

async function openCapsule(context: AppActionContext, capsuleId: string) {
  await runContentOperation(context, async () => {
    const result = (await fetchCapsule(capsuleId)) as {
      capsule?: CapsuleMeta | null;
      snapshot?: WardrobeSnapshot;
    };
    fromContext<(capsule?: CapsuleMeta | null) => void>(
      context,
      "applyCapsuleState",
    )(result.capsule);
    await restoreCapsuleSnapshot(context, result.capsule?.id, result.snapshot);
    await refreshCapsuleList(context);
  });
}

async function restoreCapsuleSnapshot(
  context: AppActionContext,
  capsuleId: string | undefined,
  snapshot: WardrobeSnapshot | undefined,
) {
  await fromContext<
    (
      snapshot?: WardrobeSnapshot,
      capsuleId?: string,
      options?: unknown,
    ) => Promise<void>
  >(context, "applyWardrobeSnapshot")(snapshot, capsuleId, {
    refreshReadyCapsule: false,
  });

  if (snapshot?.status === "pending") {
    fromContext<(capsuleId: string | undefined) => void>(
      context,
      "startCapsuleEventStream",
    )(capsuleId);
  }
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

async function saveCurrentCapsule(
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

async function revertCurrentCapsule(
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

async function renameCurrentCapsule(
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

async function setCurrentCapsulePin(
  context: AppActionContext,
  capsuleId: string,
  pin: boolean,
) {
  await mutateCurrentCapsule(
    context,
    capsuleId,
    () => setCapsulePin(capsuleId, pin) as Promise<CapsuleMutationResponse>,
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

async function duplicateCurrentCapsule(
  context: AppActionContext,
  name: string,
  capsuleId: string,
) {
  let duplicatedCapsule: CapsuleMeta | null = null;
  await mutateCurrentCapsule(
    context,
    capsuleId,
    () => duplicateCapsule(capsuleId, name) as Promise<CapsuleMutationResponse>,
    (result) => {
      duplicatedCapsule = result.capsule || null;
      fromContext<(capsule?: CapsuleMeta | null) => void>(
        context,
        "applyCapsuleState",
      )(result.capsule);
    },
  );
  return duplicatedCapsule;
}

async function deleteCurrentCapsule(
  context: AppActionContext,
  capsuleId: string,
) {
  const activeCapsuleId = fromContext<string>(context, "activeCapsuleId");
  await mutateCurrentCapsule(
    context,
    capsuleId,
    () => deleteCapsule(capsuleId) as Promise<CapsuleMutationResponse>,
    (result) => {
      if (result.activeCapsule || capsuleId === activeCapsuleId) {
        fromContext<(capsule?: CapsuleMeta | null) => void>(
          context,
          "applyCapsuleState",
        )(result.activeCapsule || null);
      }
    },
  );
}

export {
  createNewCapsule,
  deleteCurrentCapsule,
  duplicateCurrentCapsule,
  openCapsule,
  renameCurrentCapsule,
  revertCurrentCapsule,
  saveCurrentCapsule,
  setCurrentCapsulePin,
};
