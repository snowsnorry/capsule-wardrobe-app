import {
  buildProfileCapsuleContext,
  getEffectiveCapsuleSnapshot,
} from "../capsuleStore.js";
import {
  buildCapsuleEventSnapshot,
  getStoredWardrobePayload,
} from "./capsuleEvents.js";
import {
  createPartialRegenerationJobKey,
  getPartialRegenerationJobFromStore,
} from "./partialRegenerationJobs.js";
import { countItemsByKey, logWardrobeInfo } from "./ai.js";
import {
  buildStoredWardrobePayloadFromResult,
  remapOutfitSetsAfterPartialRegeneration,
} from "./regenerateSelectedPrompt.js";
import { logError } from "../logger.js";
import type { PartialRegenerationJobState } from "./types.js";

export const COMPLETED_JOB_TTL_MS = 5 * 60 * 1000;

function scheduleJobCleanup(
  deps,
  jobKey: string,
  job: PartialRegenerationJobState,
) {
  const cleanupTimer = deps.setTimeoutImpl(() => {
    if (deps.jobs.get(jobKey) === job && job.status !== "pending") {
      deps.jobs.delete(jobKey);
    }
  }, COMPLETED_JOB_TTL_MS);
  cleanupTimer?.unref?.();
}

export function getPartialRegenerationJobForService(
  deps,
  email: string,
  capsuleId: string,
) {
  return getPartialRegenerationJobFromStore({
    email,
    capsuleId,
    jobs: deps.jobs,
    nowMs: deps.nowMsImpl(),
    completedJobTtlMs: COMPLETED_JOB_TTL_MS,
  });
}

export function publishPartialRegenerationSnapshot(
  deps,
  email,
  capsuleId,
  capsule,
  job,
) {
  deps.publishSnapshotImpl(
    email,
    capsuleId,
    deps.buildCapsuleEventSnapshotImpl({
      capsule,
      partialRegenerationJob: job,
    }),
  );
}

async function buildUpdatedCapsuleForPartialRegeneration({
  deps,
  email,
  capsuleId,
  capsule,
  payload,
}) {
  const baseSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const snapshot = {
    filters: baseSnapshot?.filters,
    data: {
      wardrobe: payload,
      rejectedUrls: baseSnapshot?.data?.rejectedUrls || [],
      regeneration: baseSnapshot?.data?.regeneration || null,
    },
  };

  return capsuleId
    ? deps.updateCapsuleSnapshotImpl(email, capsuleId, snapshot)
    : { ...capsule, draft: snapshot };
}

async function runPartialRegenerationJob({
  deps,
  email,
  capsuleId,
  profile,
  capsule,
  selectedProducts,
  storedWardrobe,
  jobKey,
  job,
}) {
  const startedAt = job.startedAt;
  const jobLogContext = { capsuleRequestId: job.capsuleRequestId, startedAt };
  let currentCapsule = capsule;

  try {
    const result = await deps.regenerateCapsuleWardrobeImpl(
      {
        ...buildProfileCapsuleContext(profile, capsule),
      },
      selectedProducts,
      jobLogContext,
    );
    const payload = buildStoredWardrobePayloadFromResult(
      result,
      storedWardrobe,
    );
    payload.outfitSets = remapOutfitSetsAfterPartialRegeneration({
      currentItems: storedWardrobe?.items || [],
      nextItems: result?.items || [],
      pendingUrls: job.pendingItemUrls,
      outfitSets: storedWardrobe?.outfitSets || [],
    });
    currentCapsule = await buildUpdatedCapsuleForPartialRegeneration({
      deps,
      email,
      capsuleId,
      capsule,
      payload,
    });
    job.result = payload;
    job.status = "completed";
    job.phase = "completed";
    job.updatedAt = deps.nowMsImpl();
    logWardrobeInfo(
      "regenerate-total-completed",
      {
        totalDurationMs: deps.nowMsImpl() - startedAt,
        itemsTotal: payload.items.length,
        itemsByCategory: countItemsByKey(payload.items),
      },
      jobLogContext,
    );
  } catch (error) {
    job.status = "failed";
    job.phase = "failed";
    job.updatedAt = deps.nowMsImpl();
    job.error = error;
    logError("[wardrobe-ai][regenerate-selected]", error);
  } finally {
    publishPartialRegenerationSnapshot(
      deps,
      email,
      capsuleId,
      currentCapsule,
      job,
    );
    scheduleJobCleanup(deps, jobKey, job);
  }
}

export function startPartialRegenerationJobForService(
  deps,
  {
    email,
    capsuleId,
    profile,
    capsule,
    selectedProducts,
    storedWardrobe,
    logContext = null,
  },
) {
  const jobKey = createPartialRegenerationJobKey(email, capsuleId);
  const existing = getPartialRegenerationJobForService(deps, email, capsuleId);
  if (existing?.status === "pending") {
    return existing;
  }

  const startedAt = deps.nowMsImpl();
  const job: PartialRegenerationJobState = {
    capsuleRequestId: logContext?.capsuleRequestId || deps.randomUuidImpl(),
    status: "pending",
    phase: "regenerate",
    startedAt,
    updatedAt: startedAt,
    pendingItemUrls: selectedProducts
      .map((item) => String(item?.url || "").trim())
      .filter(Boolean),
    result: null,
    promise: null,
  };
  deps.jobs.set(jobKey, job);
  job.promise = runPartialRegenerationJob({
    deps,
    email,
    capsuleId,
    profile,
    capsule,
    selectedProducts,
    storedWardrobe,
    jobKey,
    job,
  });
  return job;
}

export function buildCapsuleEventSnapshotForService(payload) {
  return buildCapsuleEventSnapshot(payload);
}

export function getStoredWardrobePayloadForService(payload) {
  return getStoredWardrobePayload(payload);
}
