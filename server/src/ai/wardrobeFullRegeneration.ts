import {
  buildCapsuleSnapshotWithRegeneration,
  buildProfileCapsuleContext,
  getEffectiveCapsuleSnapshot,
} from "../capsuleStore.js";
import { getRequestedWardrobeParams, logWardrobeInfo } from "./aiCommon.js";
import { getStoredWardrobePayload } from "./capsuleEvents.js";
import { isNoLlmProfileEnabled } from "./llm.js";

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

export async function startFullRegeneration({
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

export function sendStartedFullRegeneration(res) {
  return res.status(202).json({
    ok: true,
    status: "pending",
    pendingStage: "capsule",
    hasPendingAdditionalItems: false,
  });
}
