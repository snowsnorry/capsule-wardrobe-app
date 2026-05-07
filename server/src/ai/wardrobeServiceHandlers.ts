import {
  buildCapsuleSnapshotWithRegeneration,
  buildProfileCapsuleContext,
  getEffectiveCapsuleSnapshot,
  getCapsuleSnapshotRegeneration,
} from "../capsuleStore.js";
import {
  getRequiredCapsule,
  getRequestedWardrobeParams,
  logWardrobeInfo,
} from "./aiCommon.js";
import { getStoredWardrobePayload } from "./capsuleEvents.js";
import { isNoLlmProfileEnabled } from "./llm.js";
import { logError } from "../logger.js";
import type { ErrorWithCode } from "./types.js";
import type {
  WardrobeJobGetter,
  WardrobeJobStarter,
  WardrobeServiceRuntimeDeps,
} from "./wardrobeServiceTypes.js";
import { createWardrobeJobKey } from "./wardrobeJobService.js";

function getCapsuleRequest(req) {
  return {
    capsuleId: String(req.params?.id || "").trim(),
    email: req.user.email,
  };
}

function hasErrorCode(error, code: string) {
  return (
    (error as ErrorWithCode | undefined)?.code === code ||
    (error as Error | undefined)?.message === code
  );
}

function getRawSelectionTextFromError(error) {
  const rawSelectionText = (
    error as { rawSelectionText?: string | null } | undefined
  )?.rawSelectionText;
  return typeof rawSelectionText === "string" &&
    rawSelectionText.trim().length > 0
    ? rawSelectionText.trim()
    : null;
}

function sendWardrobeError(res, error, includeRawSelectionText = false) {
  if (hasErrorCode(error, "invalid_payload")) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  if (hasErrorCode(error, "not_found")) {
    return res.status(404).json({ error: "not_found" });
  }

  logError("[wardrobe-ai]", error);
  return res.status(503).json({
    error: "service_unavailable",
    ...(includeRawSelectionText
      ? { rawSelectionText: getRawSelectionTextFromError(error) }
      : {}),
  });
}

function buildSnapshotPayload(snapshot) {
  return {
    items: snapshot.items,
    outfitSets: snapshot.outfitSets,
    rawSelectionText: snapshot.rawSelectionText,
    ...(snapshot.swimwearReasoning
      ? { swimwearReasoning: snapshot.swimwearReasoning }
      : {}),
    ...(snapshot.swimwearRawSelectionText
      ? { swimwearRawSelectionText: snapshot.swimwearRawSelectionText }
      : {}),
  };
}

function sendPendingCapsuleItems(res, snapshot) {
  return res.status(202).json({
    ok: true,
    status: "pending",
    pendingStage: snapshot.pendingStage,
    pendingRegenerationUrls: snapshot.pendingRegenerationUrls,
    hasPendingAdditionalItems: snapshot.hasPendingAdditionalItems,
    ...buildSnapshotPayload(snapshot),
  });
}

function sendReadyCapsuleItems(res, snapshot) {
  return res.status(200).json({
    ok: true,
    status: "ready",
    ...buildSnapshotPayload(snapshot),
    hasPendingAdditionalItems: false,
  });
}

function sendFailedCapsuleItems({
  deps,
  res,
  email,
  capsuleId,
  activeJob,
  snapshot,
}) {
  if (activeJob?.status === "failed") {
    deps.jobs.delete(createWardrobeJobKey(email, capsuleId));
  }

  return res.status(503).json({
    error: "service_unavailable",
    rawSelectionText: snapshot.rawSelectionText || null,
  });
}

async function clearStaleRegeneration({
  deps,
  email,
  capsuleId,
  capsule,
  partialRegenerationJob,
}) {
  const clearedSnapshot = buildCapsuleSnapshotWithRegeneration(
    getEffectiveCapsuleSnapshot(capsule),
    null,
  );
  const updatedCapsule =
    (await deps.updateCapsuleSnapshotImpl(email, capsuleId, clearedSnapshot)) ||
    capsule;
  const staleSnapshot = deps.buildCapsuleEventSnapshotImpl({
    capsule: updatedCapsule,
    activeJob: {
      status: "failed",
      phase: "failed",
      error: new Error("stale_regeneration"),
    },
    partialRegenerationJob,
  });
  return staleSnapshot;
}

async function getCapsuleSnapshotForItems({
  deps,
  getWardrobeJob,
  email,
  capsuleId,
}) {
  const capsule = getRequiredCapsule(
    capsuleId,
    await deps.getCapsuleImpl(email, capsuleId),
  );
  const activeJob = getWardrobeJob(email, capsuleId);
  const partialRegenerationJob = deps.getPartialRegenerationJobImpl(
    email,
    capsuleId,
  );
  const hasPendingRegeneration = getCapsuleSnapshotRegeneration(
    getEffectiveCapsuleSnapshot(capsule),
  );

  if (hasPendingRegeneration && activeJob?.status !== "pending") {
    return {
      activeJob,
      staleSnapshot: await clearStaleRegeneration({
        deps,
        email,
        capsuleId,
        capsule,
        partialRegenerationJob,
      }),
    };
  }

  return {
    activeJob,
    snapshot: deps.buildCapsuleEventSnapshotImpl({
      capsule,
      activeJob,
      partialRegenerationJob,
    }),
  };
}

export function createGetCapsuleItems(
  deps: WardrobeServiceRuntimeDeps,
  getWardrobeJob: WardrobeJobGetter,
) {
  return async function getCapsuleItems(req, res) {
    try {
      const { email, capsuleId } = getCapsuleRequest(req);
      const { activeJob, snapshot, staleSnapshot } =
        await getCapsuleSnapshotForItems({
          deps,
          getWardrobeJob,
          email,
          capsuleId,
        });

      if (staleSnapshot) {
        return res.status(503).json({
          error: "service_unavailable",
          rawSelectionText: staleSnapshot.rawSelectionText || null,
        });
      }
      if (snapshot.status === "failed") {
        return sendFailedCapsuleItems({
          deps,
          res,
          email,
          capsuleId,
          activeJob,
          snapshot,
        });
      }
      if (snapshot.status === "pending") {
        return sendPendingCapsuleItems(res, snapshot);
      }
      return sendReadyCapsuleItems(res, snapshot);
    } catch (error) {
      return sendWardrobeError(res, error);
    }
  };
}

function sendPendingPartialRegeneration(res) {
  return res.status(202).json({
    ok: true,
    status: "pending",
    pendingStage: "regenerate",
  });
}

function sendPendingWardrobeJob(res, activeJob) {
  return res.status(202).json({
    ok: true,
    status: "pending",
    pendingStage: activeJob.phase === "extras" ? "extras" : "capsule",
    hasPendingAdditionalItems: activeJob.phase === "extras",
  });
}

function getShouldAutoRenameNewCapsule(capsule) {
  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const storedWardrobe = getStoredWardrobePayload({
    items: effectiveSnapshot?.data?.wardrobe,
  });
  return capsule?.status === "new" && !storedWardrobe?.items?.length;
}

function buildPendingFullRegenerationSnapshot(
  effectiveSnapshot,
  requestId: string,
) {
  return buildCapsuleSnapshotWithRegeneration(effectiveSnapshot, {
    status: "pending",
    kind: "full",
    startedAt: new Date().toISOString(),
    requestId,
  });
}

async function buildFullRegenerationCapsule({
  deps,
  email,
  capsuleId,
  capsule,
  requestId,
}) {
  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const pendingSnapshot = buildPendingFullRegenerationSnapshot(
    effectiveSnapshot,
    requestId,
  );
  const updatedCapsule = await deps.updateCapsuleSnapshotImpl(
    email,
    capsuleId,
    pendingSnapshot,
  );
  return {
    rollbackSnapshot: buildCapsuleSnapshotWithRegeneration(
      effectiveSnapshot,
      null,
    ),
    generationCapsule: {
      ...capsule,
      ...(updatedCapsule || {}),
      draft: pendingSnapshot,
    },
  };
}

function logFullRegenerationRequest(deps, profile, capsule, logContext) {
  const generationProfile = buildProfileCapsuleContext(profile, capsule, {
    forceEmptyWardrobe: true,
  });
  const noLlm = isNoLlmProfileEnabled(generationProfile);
  logWardrobeInfo(
    "capsule-request-received",
    {
      ...getRequestedWardrobeParams(generationProfile, { forceRefresh: true }),
      noLlm: noLlm || undefined,
    },
    logContext,
  );
}

function publishFullRegenerationSnapshot({
  deps,
  email,
  capsuleId,
  capsule,
  job,
  partialRegenerationJob,
}) {
  deps.publishSnapshotImpl(
    email,
    capsuleId,
    deps.buildCapsuleEventSnapshotImpl({
      capsule,
      activeJob: job,
      partialRegenerationJob,
    }),
  );
}

async function startFullRegeneration({
  deps,
  startWardrobeJob,
  email,
  capsuleId,
  profile,
  capsule,
  partialRegenerationJob,
}) {
  const logContext = { capsuleRequestId: deps.randomUuidImpl() };
  const { rollbackSnapshot, generationCapsule } =
    await buildFullRegenerationCapsule({
      deps,
      email,
      capsuleId,
      capsule,
      requestId: logContext.capsuleRequestId,
    });
  logFullRegenerationRequest(deps, profile, generationCapsule, logContext);
  const job = startWardrobeJob({
    email,
    capsuleId,
    profile,
    capsule: generationCapsule,
    logContext,
    options: {
      allowAutoRename: getShouldAutoRenameNewCapsule(capsule),
      forceEmptyWardrobe: true,
      rollbackSnapshot,
    },
  });
  publishFullRegenerationSnapshot({
    deps,
    email,
    capsuleId,
    capsule: generationCapsule,
    job,
    partialRegenerationJob,
  });
}

function sendStartedFullRegeneration(res) {
  return res.status(202).json({
    ok: true,
    status: "pending",
    pendingStage: "capsule",
    hasPendingAdditionalItems: false,
  });
}

export function createRegenerateCapsuleWardrobe(
  deps: WardrobeServiceRuntimeDeps,
  getWardrobeJob: WardrobeJobGetter,
  startWardrobeJob: WardrobeJobStarter,
) {
  return async function regenerateCapsuleWardrobe(req, res) {
    try {
      const { email, capsuleId } = getCapsuleRequest(req);
      const profile = await deps.getProfileImpl(email);
      const capsule = getRequiredCapsule(
        capsuleId,
        await deps.getCapsuleImpl(email, capsuleId),
      );
      const activeJob = getWardrobeJob(email, capsuleId);
      const partialRegenerationJob = deps.getPartialRegenerationJobImpl(
        email,
        capsuleId,
      );

      if (partialRegenerationJob?.status === "pending") {
        return sendPendingPartialRegeneration(res);
      }
      if (activeJob?.status === "pending") {
        return sendPendingWardrobeJob(res, activeJob);
      }
      if (activeJob?.status === "failed") {
        deps.jobs.delete(createWardrobeJobKey(email, capsuleId));
      }

      await startFullRegeneration({
        deps,
        startWardrobeJob,
        email,
        capsuleId,
        profile,
        capsule,
        partialRegenerationJob,
      });
      return sendStartedFullRegeneration(res);
    } catch (error) {
      return sendWardrobeError(res, error, true);
    }
  };
}
