import {
  buildCapsuleSnapshotWithRegeneration,
  getEffectiveCapsuleSnapshot,
  getCapsuleSnapshotRegeneration,
} from "./capsuleStore.js";
import { buildCapsuleEventSnapshot } from "./ai/capsuleEvents.js";

function isActiveWardrobeJob(job) {
  return ["pending", "queued", "running"].includes(job?.status);
}

export function createCapsuleEventHandlers({
  getOutfitSetImageJobImpl,
  getPartialRegenerationJobImpl,
  getWardrobeJobImpl,
  updateCapsuleSnapshotImpl,
}) {
  async function getCapsuleEventSnapshot(email, capsule) {
    const capsuleId = String(capsule?.id || "").trim();
    const activeJob = capsuleId
      ? await getWardrobeJobImpl(email, capsuleId)
      : null;
    let snapshotCapsule = capsule;

    if (
      capsuleId &&
      getCapsuleSnapshotRegeneration(getEffectiveCapsuleSnapshot(capsule)) &&
      !isActiveWardrobeJob(activeJob)
    ) {
      const clearedSnapshot = buildCapsuleSnapshotWithRegeneration(
        getEffectiveCapsuleSnapshot(capsule),
        null,
      );
      snapshotCapsule =
        (await updateCapsuleSnapshotImpl(email, capsuleId, clearedSnapshot)) ||
        capsule;
      return buildCapsuleEventSnapshot({
        capsule: snapshotCapsule,
        activeJob: {
          status: "failed",
          phase: "failed",
          error: new Error("stale_regeneration"),
        },
        partialRegenerationJob: null,
        outfitSetImageJob: capsuleId
          ? await getOutfitSetImageJobImpl(email, capsuleId)
          : null,
      });
    }

    return buildCapsuleEventSnapshot({
      capsule: snapshotCapsule,
      activeJob,
      partialRegenerationJob: capsuleId
        ? await getPartialRegenerationJobImpl(email, capsuleId)
        : null,
      outfitSetImageJob: capsuleId
        ? await getOutfitSetImageJobImpl(email, capsuleId)
        : null,
    });
  }

  return { getCapsuleEventSnapshot };
}
