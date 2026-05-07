import crypto from "node:crypto";
import { getProfile } from "../profileStore.js";
import {
  buildProfileCapsuleContext,
  getCapsule,
  getEffectiveCapsuleSnapshot,
  updateCapsuleSnapshot,
} from "../capsuleStore.js";
import {
  buildCapsuleEventSnapshot,
  capsuleEventHub,
  getStoredWardrobePayload,
} from "./capsuleEvents.js";
import {
  createPartialRegenerationJobKey,
  getPartialRegenerationJobFromStore,
  partialRegenerationJobs,
} from "./partialRegenerationJobs.js";
import { isNoLlmProfileEnabled } from "./llm.js";
import { countItemsByKey, logWardrobeInfo } from "./ai.js";
import type {
  LogContextLike,
  UserProfileLike,
  WardrobeGenerationResult,
  PartialRegenerationJobState,
  WardrobeUiItemLike,
} from "./types.js";
import {
  buildStoredWardrobePayloadFromResult,
  isValidSelectedItemUrls,
  remapOutfitSetsAfterPartialRegeneration,
} from "./regenerateSelectedPrompt.js";
import { regenerateCapsuleWardrobe } from "./regenerateSelectedGeneration.js";
import { logError } from "../logger.js";

const COMPLETED_JOB_TTL_MS = 5 * 60 * 1000;

type PartialRegenerationServiceDependencies = {
  getProfileImpl?: typeof getProfile;
  getCapsuleImpl?: typeof getCapsule;
  updateCapsuleSnapshotImpl?: typeof updateCapsuleSnapshot;
  regenerateCapsuleWardrobeImpl?: (
    userProfile?: UserProfileLike | null,
    products?: WardrobeUiItemLike[] | null,
    logContext?: LogContextLike | null,
  ) => Promise<WardrobeGenerationResult>;
  buildCapsuleEventSnapshotImpl?: typeof buildCapsuleEventSnapshot;
  publishSnapshotImpl?: (
    email: string,
    capsuleId: string,
    snapshot: unknown,
  ) => void;
  jobs?: Map<string, PartialRegenerationJobState>;
  nowMsImpl?: () => number;
  setTimeoutImpl?: typeof setTimeout;
  randomUuidImpl?: () => string;
};

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

function getPartialRegenerationJobForService(
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

function publishPartialRegenerationSnapshot(
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

function startPartialRegenerationJobForService(
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

function getPartialRegenerationRequest(req) {
  return {
    capsuleId: String(req.params?.id || "").trim(),
    email: req.user.email,
    itemUrls: Array.isArray(req.body?.itemUrls)
      ? req.body.itemUrls
          .map((itemUrl) => String(itemUrl || "").trim())
          .filter(Boolean)
      : [],
  };
}

function clearFinishedPartialJob(deps, email, capsuleId, activeJob) {
  if (activeJob?.status === "completed" || activeJob?.status === "failed") {
    deps.jobs.delete(createPartialRegenerationJobKey(email, capsuleId));
  }
}

function getSelectedProductsFromWardrobe(storedWardrobe, itemUrls) {
  const storedItemsByUrl = new Map(
    storedWardrobe.items
      .filter((item) => item && typeof item === "object")
      .map((item) => [String(item.url || "").trim(), item])
      .filter(([itemUrl]) => itemUrl),
  );
  return itemUrls
    .map((itemUrl) => storedItemsByUrl.get(itemUrl))
    .filter(Boolean);
}

function getNextRejectedUrls(effectiveSnapshot, itemUrls) {
  return [
    ...new Set(
      [
        ...(Array.isArray(effectiveSnapshot?.data?.rejectedUrls)
          ? effectiveSnapshot.data.rejectedUrls
          : []),
        ...itemUrls,
      ]
        .map((itemUrl) => String(itemUrl || "").trim())
        .filter(Boolean),
    ),
  ];
}

function buildPartialWardrobePayload(storedWardrobe, itemUrls) {
  const selectedItemUrlSet = new Set(itemUrls);
  return {
    items: storedWardrobe.items.filter(
      (item) => !selectedItemUrlSet.has(String(item?.url || "").trim()),
    ),
    outfitSets: storedWardrobe.outfitSets || [],
    rawSelectionText: storedWardrobe.rawSelectionText || null,
    swimwearReasoning: storedWardrobe.swimwearReasoning || null,
    swimwearRawSelectionText: storedWardrobe.swimwearRawSelectionText || null,
  };
}

function buildPartialGenerationCapsule(
  capsule,
  effectiveSnapshot,
  partialPayload,
  nextRejectedUrls,
) {
  return {
    ...capsule,
    draft: {
      filters: effectiveSnapshot?.filters,
      data: {
        wardrobe: partialPayload,
        rejectedUrls: nextRejectedUrls,
        regeneration: effectiveSnapshot?.data?.regeneration || null,
      },
    },
  };
}

async function updatePartialRegenerationSnapshot({
  deps,
  email,
  capsuleId,
  effectiveSnapshot,
  partialPayload,
  nextRejectedUrls,
}) {
  await deps.updateCapsuleSnapshotImpl(email, capsuleId, {
    filters: effectiveSnapshot?.filters,
    data: {
      wardrobe: partialPayload,
      rejectedUrls: nextRejectedUrls,
      regeneration: effectiveSnapshot?.data?.regeneration || null,
    },
  });
}

function sendStoredWardrobeValidationError(res, itemUrls, storedWardrobe) {
  if (!isValidSelectedItemUrls(itemUrls)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  if (!storedWardrobe?.items?.length) {
    return res.status(404).json({ error: "not_found" });
  }

  return null;
}

function sendPendingRegenerationResponse(res) {
  return res.status(202).json({
    ok: true,
    status: "pending",
    pendingStage: "regenerate",
  });
}

function createRegenerateSelectedWardrobeItems(
  deps,
  getPartialRegenerationJob,
  startPartialRegenerationJob,
) {
  return async function regenerateSelectedWardrobeItems(req, res) {
    try {
      const { email, capsuleId, itemUrls } = getPartialRegenerationRequest(req);
      const profile = await deps.getProfileImpl(email);
      if (!capsuleId) {
        return res.status(400).json({ error: "invalid_payload" });
      }
      const capsule = await deps.getCapsuleImpl(email, capsuleId);
      if (!capsule) {
        return res.status(404).json({ error: "not_found" });
      }
      const activeJob = getPartialRegenerationJob(email, capsuleId);
      if (activeJob?.status === "pending") {
        return sendPendingRegenerationResponse(res);
      }
      clearFinishedPartialJob(deps, email, capsuleId, activeJob);
      const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
      const storedWardrobe = getStoredWardrobePayload({
        items: effectiveSnapshot?.data?.wardrobe,
      });
      const validationResponse = sendStoredWardrobeValidationError(
        res,
        itemUrls,
        storedWardrobe,
      );
      if (validationResponse) {
        return validationResponse;
      }
      const selectedProducts = getSelectedProductsFromWardrobe(
        storedWardrobe,
        itemUrls,
      );
      if (selectedProducts.length !== itemUrls.length) {
        return res.status(400).json({ error: "invalid_payload" });
      }
      const nextRejectedUrls = getNextRejectedUrls(effectiveSnapshot, itemUrls);
      const partialPayload = buildPartialWardrobePayload(
        storedWardrobe,
        itemUrls,
      );
      await updatePartialRegenerationSnapshot({
        deps,
        email,
        capsuleId,
        effectiveSnapshot,
        partialPayload,
        nextRejectedUrls,
      });
      const generationCapsule = buildPartialGenerationCapsule(
        capsule,
        effectiveSnapshot,
        partialPayload,
        nextRejectedUrls,
      );
      const generationProfile = buildProfileCapsuleContext(
        profile,
        generationCapsule,
      );
      const logContext = {
        capsuleRequestId: deps.randomUuidImpl(),
        source: "partial-regeneration",
      };
      logWardrobeInfo(
        "regenerate-request-received",
        {
          itemUrls,
          noLlm: isNoLlmProfileEnabled(generationProfile) || undefined,
        },
        logContext,
      );
      const job = startPartialRegenerationJob(
        email,
        capsuleId,
        profile,
        generationCapsule,
        selectedProducts,
        storedWardrobe,
        logContext,
      );
      publishPartialRegenerationSnapshot(
        deps,
        email,
        capsuleId,
        generationCapsule,
        job,
      );
      return sendPendingRegenerationResponse(res);
    } catch (error) {
      logError("[wardrobe-ai][regenerate-selected]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  };
}

export function createPartialRegenerationService({
  getProfileImpl = getProfile,
  getCapsuleImpl = getCapsule,
  updateCapsuleSnapshotImpl = updateCapsuleSnapshot,
  regenerateCapsuleWardrobeImpl = regenerateCapsuleWardrobe,
  buildCapsuleEventSnapshotImpl = buildCapsuleEventSnapshot,
  publishSnapshotImpl = (email, capsuleId, snapshot) =>
    capsuleEventHub.publish(email, capsuleId, snapshot),
  jobs = partialRegenerationJobs,
  nowMsImpl = () => Date.now(),
  setTimeoutImpl = setTimeout,
  randomUuidImpl = () => crypto.randomUUID(),
}: PartialRegenerationServiceDependencies = {}) {
  const deps = {
    buildCapsuleEventSnapshotImpl,
    getCapsuleImpl,
    getProfileImpl,
    jobs,
    nowMsImpl,
    publishSnapshotImpl,
    randomUuidImpl,
    regenerateCapsuleWardrobeImpl,
    setTimeoutImpl,
    updateCapsuleSnapshotImpl,
  };

  function getPartialRegenerationJob(email: string, capsuleId: string) {
    return getPartialRegenerationJobForService(deps, email, capsuleId);
  }

  function startPartialRegenerationJob(...args) {
    const [
      email,
      capsuleId,
      profile,
      capsule,
      selectedProducts,
      storedWardrobe,
      logContext = null,
    ] = args;
    return startPartialRegenerationJobForService(deps, {
      email,
      capsuleId,
      profile,
      capsule,
      selectedProducts,
      storedWardrobe,
      logContext,
    });
  }

  const regenerateSelectedWardrobeItems = createRegenerateSelectedWardrobeItems(
    deps,
    getPartialRegenerationJob,
    startPartialRegenerationJob,
  );

  return {
    getPartialRegenerationJob,
    startPartialRegenerationJob,
    regenerateSelectedWardrobeItems,
  };
}
