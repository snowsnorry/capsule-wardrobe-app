import {
  buildCapsuleSnapshotWithRegeneration,
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
  StartWardrobeJobOptions,
  WardrobeServiceRuntimeDeps,
} from "./wardrobeServiceTypes.js";
import {
  publishWardrobeSnapshot,
  updateWardrobeCapsuleSnapshot,
} from "./wardrobeJobSnapshots.js";
import { throwIfAborted } from "./abortSignal.js";

type WardrobeJobRunInput = {
  deps: WardrobeServiceRuntimeDeps;
  email: string;
  capsuleId: string;
  profile: Awaited<ReturnType<WardrobeServiceRuntimeDeps["getProfileImpl"]>>;
  capsule: Awaited<ReturnType<WardrobeServiceRuntimeDeps["getCapsuleImpl"]>>;
  logContext?: LogContextLike | null;
  options?: StartWardrobeJobOptions;
  job: WardrobeJobState;
  rethrowErrors?: boolean;
  signal?: AbortSignal | null;
  updateProgress?: (update: {
    phase?: string | null;
    current?: number;
    total?: number | null;
    label?: string | null;
  }) => Promise<void>;
};

type BaseWardrobeResult = {
  currentCapsule: WardrobeJobRunInput["capsule"];
  generationProfile: ReturnType<typeof buildProfileCapsuleContext>;
  items: WardrobeGenerationResult["items"];
  wardrobe: WardrobeGenerationResult;
};

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
  throwIfAborted(input.signal);
  const baseSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const generationProfile = buildProfileCapsuleContext(profile, capsule, {
    forceEmptyWardrobe: Boolean(options.forceEmptyWardrobe),
  });
  const wardrobe = await deps.generateCapsuleWardrobeImpl(
    generationProfile,
    logContext,
    { signal: input.signal },
  );
  throwIfAborted(input.signal);
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
  throwIfAborted(input.signal);
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
  const shouldGenerateSwimwear =
    deps.shouldGenerateSwimwearImpl(baseResult.generationProfile) ||
    deps.shouldCompleteSelectedSwimwearImpl(baseResult.wardrobe.selectedItems);

  if (!shouldGenerateSwimwear) {
    logCapsuleTotalCompleted(deps, job.startedAt, baseResult.items, logContext);
    return baseResult.currentCapsule;
  }

  job.phase = "extras";
  job.updatedAt = deps.nowMsImpl();
  await input.updateProgress?.({
    phase: "extras",
    current: 1,
    label: "Generating additional items",
  });
  publishWardrobeSnapshot(
    deps,
    email,
    capsuleId,
    baseResult.currentCapsule,
    job,
  );

  try {
    throwIfAborted(input.signal);
    const swimwear = await deps.generateSwimwearAdditionImpl({
      userProfile: baseResult.generationProfile,
      selectedCapsuleItems: baseResult.wardrobe.selectedItems,
      promptEmbeddings: baseResult.wardrobe.promptEmbeddings,
      logContext,
      signal: input.signal,
    });
    throwIfAborted(input.signal);
    return await applySwimwearAddition(input, baseResult, swimwear, logContext);
  } catch (error) {
    const errorCode = String(error?.code || error?.message || "");
    if (errorCode === "job_aborted" || errorCode === "job_deadline_exceeded") {
      throw error;
    }
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
  const errorCode = String(error?.code || error?.message || "");
  job.status = "failed";
  job.phase = "failed";
  job.updatedAt = deps.nowMsImpl();
  job.error = error;
  logError("[wardrobe-ai]", buildErrorLogContext(logContext), error);
  const restoredCapsule =
    errorCode === "job_aborted" || errorCode === "job_deadline_exceeded"
      ? currentCapsule
      : await restoreRollbackSnapshot(input, currentCapsule, logContext);
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
    if (input.rethrowErrors) {
      throw error;
    }
  }
}

async function preparePersistedWardrobeGenerationJob(
  deps: WardrobeServiceRuntimeDeps,
  email: string,
  capsuleId: string,
) {
  const profile = await deps.getProfileImpl(email);
  const capsule = await deps.getCapsuleImpl(email, capsuleId);
  if (!capsule) {
    const error = new Error("not_found") as Error & { code?: string };
    error.code = "not_found";
    throw error;
  }

  const requestId = deps.randomUuidImpl();
  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const pendingSnapshot = buildCapsuleSnapshotWithRegeneration(
    effectiveSnapshot,
    {
      status: "pending",
      kind: "full",
      startedAt: new Date().toISOString(),
      requestId,
    },
  );
  const updatedCapsule = await deps.updateCapsuleSnapshotImpl(
    email,
    capsuleId,
    pendingSnapshot,
  );
  return {
    capsule,
    effectiveSnapshot,
    generationCapsule: {
      ...capsule,
      ...(updatedCapsule || {}),
      draft: pendingSnapshot,
    },
    profile,
    requestId,
  };
}

export async function runPersistedWardrobeGenerationJobForService(
  deps: WardrobeServiceRuntimeDeps,
  {
    email,
    capsuleId,
    signal = null,
    updateProgress = async () => undefined,
  }: {
    email: string;
    capsuleId: string;
    signal?: AbortSignal | null;
    updateProgress?: (update: {
      phase?: string | null;
      current?: number;
      total?: number | null;
      label?: string | null;
    }) => Promise<void>;
  },
) {
  const prepared = await preparePersistedWardrobeGenerationJob(
    deps,
    email,
    capsuleId,
  );
  const job: WardrobeJobState = {
    capsuleRequestId: prepared.requestId,
    status: "pending",
    startedAt: deps.nowMsImpl(),
    updatedAt: deps.nowMsImpl(),
    promise: null,
    phase: "capsule",
    result: null,
  };
  deps.publishSnapshotImpl(
    email,
    capsuleId,
    deps.buildCapsuleEventSnapshotImpl({
      capsule: prepared.generationCapsule,
      activeJob: job,
    }),
  );
  await updateProgress({
    phase: "capsule",
    current: 0,
    label: "Generating capsule",
  });
  await runWardrobeJob({
    email,
    capsuleId,
    profile: prepared.profile,
    capsule: prepared.generationCapsule,
    logContext: { capsuleRequestId: prepared.requestId },
    options: {
      allowAutoRename: isFirstContentGenerationForNewCapsule(
        prepared.capsule,
        prepared.effectiveSnapshot,
      ),
      forceEmptyWardrobe: true,
      rollbackSnapshot: buildCapsuleSnapshotWithRegeneration(
        prepared.effectiveSnapshot,
        null,
      ),
    },
    deps,
    job,
    rethrowErrors: true,
    signal,
    updateProgress,
  });
  return { capsuleId };
}
