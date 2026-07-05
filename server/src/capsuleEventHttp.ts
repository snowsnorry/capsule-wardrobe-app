import {
  buildCapsuleSnapshotWithRegeneration,
  getEffectiveCapsuleSnapshot,
  getCapsuleSnapshotRegeneration,
} from "./capsuleStore.js";
import { buildCapsuleEventSnapshot } from "./ai/capsuleEvents.js";
import { logError } from "./logger.js";

export function createCapsuleEventHandlers({
  getCapsuleImpl,
  getOutfitSetImageJobImpl,
  getPartialRegenerationJobImpl,
  listLikedItemUrlsImpl,
  getWardrobeJobImpl,
  streamCapsuleEventsImpl,
  updateCapsuleSnapshotImpl,
  annotateLikedItems,
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
      activeJob?.status !== "pending"
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

  async function streamCapsuleEventsHandler(req, res) {
    try {
      const capsuleId = String(req.params?.id || "").trim();
      if (!capsuleId) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      const capsule = await getCapsuleImpl(req.user.email, capsuleId);
      if (!capsule) {
        return res.status(404).json({ error: "not_found" });
      }

      const snapshot = await getCapsuleEventSnapshot(req.user.email, capsule);
      const likedUrls = await listLikedItemUrlsImpl(req.user.email);
      await streamCapsuleEventsImpl(req, res, {
        email: req.user.email,
        capsuleId,
        snapshot: annotateLikedItems(snapshot, likedUrls),
      });
      return undefined;
    } catch (error) {
      logError("[capsules/events]", error);
      if (!res.headersSent) {
        return res.status(503).json({ error: "service_unavailable" });
      }
      return undefined;
    }
  }

  return { getCapsuleEventSnapshot, streamCapsuleEventsHandler };
}
