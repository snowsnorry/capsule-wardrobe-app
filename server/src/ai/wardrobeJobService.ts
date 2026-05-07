import {
  buildProfileCapsuleContext,
  getEffectiveCapsuleSnapshot,
} from "../capsuleStore.js";
import { appendUniqueWardrobeItems } from "./aiSelectionPrompt.js";
import {
  buildErrorLogContext,
  buildWardrobePayload,
  countItemsByKey,
  logWardrobeInfo,
} from "./aiCommon.js";
import { getStoredWardrobePayload } from "./capsuleEvents.js";
import { logError } from "../logger.js";
import type {
  LogContextLike,
  WardrobeGenerationResult,
  WardrobeJobState,
} from "./types.js";
import type {
  StartWardrobeJobInput,
  WardrobeServiceRuntimeDeps,
} from "./wardrobeServiceTypes.js";
import {
  publishWardrobeSnapshot,
  updateWardrobeCapsuleSnapshot,
} from "./wardrobeJobSnapshots.js";

const COMPLETED_JOB_TTL_MS = 5 * 60 * 1000;

type WardrobeJobRunInput = StartWardrobeJobInput & {
  deps: WardrobeServiceRuntimeDeps;
  job: WardrobeJobState;
  jobKey: string;
};

type BaseWardrobeResult = {
  currentCapsule: StartWardrobeJobInput["capsule"];
  generationProfile: ReturnType<typeof buildProfileCapsuleContext>;
  items: WardrobeGenerationResult["items"];
  wardrobe: WardrobeGenerationResult;
};

export function createWardrobeJobKey(email, capsuleId) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const normalizedCapsuleId = String(capsuleId || "").trim();
  return normalizedCapsuleId
    ? `${normalizedEmail}::${normalizedCapsuleId}`
    : normalizedEmail;
}

export function getWardrobeJobForService(
  deps: WardrobeServiceRuntimeDeps,
  email: string,
  capsuleId: string,
) {
  const jobKey = createWardrobeJobKey(email, capsuleId);
  const job = deps.jobs.get(jobKey);
  if (!job) {
    return null;
  }

  if (
    job.status !== "pending" &&
    deps.nowMsImpl() - job.updatedAt > COMPLETED_JOB_TTL_MS
  ) {
    deps.jobs.delete(jobKey);
    return null;
  }

  return job;
}

function scheduleWardrobeJobCleanup(
  deps: WardrobeServiceRuntimeDeps,
  jobKey: string,
  job: WardrobeJobState,
) {
  const cleanupTimer = deps.setTimeoutImpl(() => {
    if (deps.jobs.get(jobKey) === job && job.status !== "pending") {
      deps.jobs.delete(jobKey);
    }
  }, COMPLETED_JOB_TTL_MS);
  cleanupTimer?.unref?.();
}

function isFirstContentGenerationForNewCapsule(capsule, baseSnapshot) {
  const storedWardrobe = getStoredWardrobePayload({
    items: baseSnapshot?.data?.wardrobe,
  });
  return capsule?.status === "new" && !storedWardrobe?.items?.length;
}

async function applyWardrobeAutoRename({
  deps,
  email,
  capsuleId,
  currentCapsule,
  wardrobe,
  shouldRename,
}) {
  if (!shouldRename || !capsuleId || !wardrobe.shortCapsuleName) {
    return currentCapsule;
  }

  return (
    (await deps.renameCapsuleImpl(
      email,
      capsuleId,
      wardrobe.shortCapsuleName,
    )) || currentCapsule
  );
}

function logCapsuleTotalCompleted(
  deps,
  startedAt: number,
  items,
  logContext: LogContextLike,
) {
  logWardrobeInfo(
    "capsule-total-completed",
    {
      totalDurationMs: deps.nowMsImpl() - startedAt,
      itemsTotal: items.length,
      itemsByCategory: countItemsByKey(items),
    },
    logContext,
  );
}

async function generateBaseWardrobe(
  input: WardrobeJobRunInput,
  logContext: LogContextLike,
): Promise<BaseWardrobeResult> {
  const { deps, email, capsuleId, profile, capsule, options = {} } = input;
  const baseSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const generationProfile = buildProfileCapsuleContext(profile, capsule, {
    forceEmptyWardrobe: Boolean(options.forceEmptyWardrobe),
  });
  const wardrobe = await deps.generateCapsuleWardrobeImpl(
    generationProfile,
    logContext,
  );
  const items = wardrobe.items;

  if (items.length === 0) {
    throw new Error("AI response has no valid wardrobe items");
  }

  const payload = buildWardrobePayload({
    items,
    outfitSets: wardrobe.outfitSets,
    rawSelectionText: wardrobe.rawSelectionText,
  });
  let currentCapsule = await updateWardrobeCapsuleSnapshot({
    deps,
    email,
    capsuleId,
    capsule,
    baseSnapshot,
    payload,
  });
  currentCapsule = await applyWardrobeAutoRename({
    deps,
    email,
    capsuleId,
    currentCapsule,
    wardrobe,
    shouldRename:
      options.allowAutoRename !== false &&
      isFirstContentGenerationForNewCapsule(capsule, baseSnapshot),
  });
  logWardrobeInfo(
    "capsule-base-completed",
    {
      baseDurationMs: deps.nowMsImpl() - input.job.startedAt,
      capsuleItemsTotal: items.length,
      capsuleItemsByCategory: countItemsByKey(items),
    },
    logContext,
  );
  input.job.result = payload;

  return { currentCapsule, generationProfile, items, wardrobe };
}

async function addSwimwearIfNeeded(
  input: WardrobeJobRunInput,
  baseResult: BaseWardrobeResult,
  logContext: LogContextLike,
) {
  const { deps, email, capsuleId, job } = input;
  if (!deps.shouldGenerateSwimwearImpl(baseResult.generationProfile)) {
    logCapsuleTotalCompleted(deps, job.startedAt, baseResult.items, logContext);
    return baseResult.currentCapsule;
  }

  job.phase = "extras";
  job.updatedAt = deps.nowMsImpl();
  publishWardrobeSnapshot(
    deps,
    email,
    capsuleId,
    baseResult.currentCapsule,
    job,
  );

  try {
    const swimwear = await deps.generateSwimwearAdditionImpl({
      userProfile: baseResult.generationProfile,
      selectedCapsuleItems: baseResult.wardrobe.selectedItems,
      promptEmbeddings: baseResult.wardrobe.promptEmbeddings,
      logContext,
    });
    return await applySwimwearAddition(input, baseResult, swimwear, logContext);
  } catch (error) {
    logError(
      "[wardrobe-ai][swimwear]",
      buildErrorLogContext(logContext),
      error,
    );
    logCapsuleTotalCompleted(deps, job.startedAt, baseResult.items, logContext);
    return baseResult.currentCapsule;
  }
}

async function applySwimwearAddition(
  input: WardrobeJobRunInput,
  baseResult,
  swimwear,
  logContext: LogContextLike,
) {
  const { deps, email, capsuleId, capsule, job } = input;
  const finalItems = appendUniqueWardrobeItems(
    baseResult.items,
    swimwear.items,
  );
  const finalPayload = buildWardrobePayload({
    items: finalItems,
    outfitSets: baseResult.wardrobe.outfitSets,
    rawSelectionText: baseResult.wardrobe.rawSelectionText,
    swimwearReasoning: swimwear.reasoning,
    swimwearRawSelectionText: swimwear.rawSelectionText,
  });
  const currentCapsule = await updateWardrobeCapsuleSnapshot({
    deps,
    email,
    capsuleId,
    capsule: baseResult.currentCapsule || capsule,
    baseSnapshot: getEffectiveCapsuleSnapshot(capsule),
    payload: finalPayload,
  });
  logCapsuleTotalCompleted(deps, job.startedAt, finalItems, logContext);
  job.result = finalPayload;
  return currentCapsule;
}

async function restoreRollbackSnapshot(
  input: WardrobeJobRunInput,
  currentCapsule,
  logContext: LogContextLike,
) {
  const { deps, email, capsuleId, options = {} } = input;
  if (!capsuleId || !options.rollbackSnapshot) {
    return currentCapsule;
  }

  try {
    return (
      (await deps.updateCapsuleSnapshotImpl(
        email,
        capsuleId,
        options.rollbackSnapshot,
      )) || currentCapsule
    );
  } catch (rollbackError) {
    logError(
      "[wardrobe-ai][rollback]",
      buildErrorLogContext(logContext),
      rollbackError,
    );
    return currentCapsule;
  }
}

function markWardrobeJobCompleted(deps, email, capsuleId, capsule, job) {
  job.status = "completed";
  job.phase = "completed";
  job.updatedAt = deps.nowMsImpl();
  publishWardrobeSnapshot(deps, email, capsuleId, capsule, job);
}

async function markWardrobeJobFailed(
  input: WardrobeJobRunInput,
  currentCapsule,
  error,
  logContext: LogContextLike,
) {
  const { deps, email, capsuleId, job } = input;
  job.status = "failed";
  job.phase = "failed";
  job.updatedAt = deps.nowMsImpl();
  job.error = error;
  logError("[wardrobe-ai]", buildErrorLogContext(logContext), error);
  const restoredCapsule = await restoreRollbackSnapshot(
    input,
    currentCapsule,
    logContext,
  );
  publishWardrobeSnapshot(deps, email, capsuleId, restoredCapsule, job);
}

async function runWardrobeJob(input: WardrobeJobRunInput) {
  const logContext = {
    capsuleRequestId: input.job.capsuleRequestId,
    startedAt: input.job.startedAt,
  };
  let currentCapsule = input.capsule;

  try {
    const baseResult = await generateBaseWardrobe(input, logContext);
    currentCapsule = await addSwimwearIfNeeded(input, baseResult, logContext);
    markWardrobeJobCompleted(
      input.deps,
      input.email,
      input.capsuleId,
      currentCapsule,
      input.job,
    );
  } catch (error) {
    await markWardrobeJobFailed(input, currentCapsule, error, logContext);
  } finally {
    scheduleWardrobeJobCleanup(input.deps, input.jobKey, input.job);
  }
}

export function startWardrobeJobForService(
  deps: WardrobeServiceRuntimeDeps,
  input: StartWardrobeJobInput,
) {
  const jobKey = createWardrobeJobKey(input.email, input.capsuleId);
  const existing = getWardrobeJobForService(deps, input.email, input.capsuleId);
  if (existing?.status === "pending") {
    return existing;
  }

  const startedAt = deps.nowMsImpl();
  const job: WardrobeJobState = {
    capsuleRequestId:
      input.logContext?.capsuleRequestId || deps.randomUuidImpl(),
    status: "pending",
    startedAt,
    updatedAt: deps.nowMsImpl(),
    promise: null,
    phase: "capsule",
    result: null,
  };
  deps.jobs.set(jobKey, job);
  job.promise = runWardrobeJob({ ...input, deps, job, jobKey });
  return job;
}
