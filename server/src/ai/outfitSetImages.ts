import {
  getCapsule,
  getEffectiveCapsuleSnapshot,
  updateCapsuleSavedSnapshot,
  updateCapsuleSnapshot,
} from "../capsuleStore.js";
import { getProfile } from "../profileStore.js";
import { buildCapsuleEventSnapshot, capsuleEventHub } from "./capsuleEvents.js";
import { generateImageWithGemini } from "./geminiImage.js";
import { resolveImageLlmProvider } from "./imageLlm.js";
import { logWardrobeInfo } from "./ai.js";
import { generateImageWithOpenAi } from "./openaiImage.js";
import { buildOutfitSetDescription } from "./outfitSetImageDescription.js";
import {
  areOutfitSetItemIdsEqual,
  buildOutfitSetSnapshotUpdate,
  getOutfitSetsFromSnapshot,
  resolveTargetSetItems,
  updateOutfitSetImageSnapshot,
} from "./outfitSetImageSnapshots.js";
import {
  buildPromptFromTemplate,
  saveOutfitSetDebugArtifacts,
} from "./outfitSetImagePrompt.js";
import {
  getOutfitSetImageRequestContext,
  isValidOutfitSetImageRequest,
} from "./outfitSetImageRequest.js";
import { downloadProductImageAssets } from "./promptImages.js";
import { uploadImageToR2 } from "../r2Storage.js";
import { logError } from "../logger.js";
import { throwIfAborted } from "./abortSignal.js";

async function getOtherActiveOutfitSetImageJob({
  deps,
  email,
  capsuleId,
  jobId,
}) {
  const listActiveJobsForEntityImpl = deps.listActiveJobsForEntityImpl;
  if (typeof listActiveJobsForEntityImpl !== "function") {
    return null;
  }

  try {
    const jobs = await listActiveJobsForEntityImpl({
      email,
      entityType: "capsule",
      entityId: capsuleId,
      kinds: ["outfitSetImageGenerate"],
    });
    const pendingSetIndexes = jobs
      .filter((job) => String(job?.id || "") !== String(jobId || ""))
      .map((job) => Number.parseInt(String(job?.payload?.setIndex), 10))
      .filter((value) => Number.isInteger(value) && value >= 0);

    return pendingSetIndexes.length > 0
      ? { status: "pending", pendingSetIndexes }
      : null;
  } catch (error) {
    logError("[outfit-set-image][pending-jobs]", {
      message: error?.message || "unknown_error",
      capsuleId,
    });
    return null;
  }
}

async function publishOutfitSetSnapshot({
  deps,
  email,
  capsuleId,
  capsule,
  jobId,
  publishSnapshotImpl,
  buildCapsuleEventSnapshotImpl,
}) {
  const outfitSetImageJob = await getOtherActiveOutfitSetImageJob({
    deps,
    email,
    capsuleId,
    jobId,
  });
  publishSnapshotImpl(
    email,
    capsuleId,
    buildCapsuleEventSnapshotImpl({
      capsule,
      outfitSetImageJob,
    }),
  );
}

function createDeleteOutfitSetImage(deps) {
  const {
    buildCapsuleEventSnapshotImpl,
    getCapsuleImpl,
    publishSnapshotImpl,
    updateCapsuleSnapshotImpl,
  } = deps;

  return async function deleteOutfitSetImage(req, res) {
    const { email, capsuleId, setIndex } = getOutfitSetImageRequestContext(req);

    if (!isValidOutfitSetImageRequest({ capsuleId, setIndex })) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const capsule = await getCapsuleImpl(email, capsuleId);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }

    const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
    const { wardrobe, outfitSets } =
      getOutfitSetsFromSnapshot(effectiveSnapshot);
    if (!outfitSets[setIndex]) {
      return res.status(404).json({ error: "not_found" });
    }

    const nextOutfitSets = outfitSets.map((set, index) =>
      index === setIndex ? { ...set, image: null, imageObsolete: false } : set,
    );
    const updatedCapsule = await updateCapsuleSnapshotImpl(
      email,
      capsuleId,
      buildOutfitSetSnapshotUpdate(effectiveSnapshot, wardrobe, nextOutfitSets),
    );

    publishOutfitSetSnapshot({
      deps,
      email,
      capsuleId,
      capsule: updatedCapsule,
      jobId: null,
      publishSnapshotImpl,
      buildCapsuleEventSnapshotImpl,
    });

    return res.json({ ok: true, status: "ready" });
  };
}

function buildOutfitSetGeneratedImage(
  result,
  { uploadImageToR2Impl, capsuleId, setIndex },
) {
  return result?.image?.base64
    ? uploadImageToR2Impl({
        buffer: Buffer.from(result.image.base64, "base64"),
        mimeType: result.image.mimeType || "image/png",
        capsuleId,
        setIndex,
        namespace: "generated",
      })
    : null;
}

async function generateOutfitSetImageAsset({
  deps,
  email,
  capsuleId,
  setIndex,
  setItems,
  signal,
}) {
  const {
    buildOutfitSetDescriptionImpl,
    downloadProductImageAssetsImpl,
    generateImageWithGeminiImpl,
    generateImageWithOpenAiImpl,
    getProfileImpl,
    uploadImageToR2Impl,
  } = deps;
  const prompt = buildPromptFromTemplate(setItems, {
    buildOutfitSetDescriptionImpl,
  });
  saveOutfitSetDebugArtifacts({ prompt });
  const imageAssetsById = await downloadProductImageAssetsImpl(setItems);
  throwIfAborted(signal);
  const images = setItems
    .map((item) => imageAssetsById[String(item?.id || "").trim()] || null)
    .filter(Boolean);
  const userProfile = await getProfileImpl(email);
  const imageLlmResolution = resolveImageLlmProvider(userProfile);
  const imageLlmStartedAt = Date.now();
  const generateImageImpl =
    imageLlmResolution.provider === "gemini"
      ? generateImageWithGeminiImpl
      : generateImageWithOpenAiImpl;
  const result = await generateImageImpl(prompt, {
    images,
    model: imageLlmResolution.model,
    signal,
  });
  throwIfAborted(signal);
  const generatedImage = await buildOutfitSetGeneratedImage(result, {
    uploadImageToR2Impl,
    capsuleId,
    setIndex,
  });
  logWardrobeInfo("outfit-set-image-llm-completed", {
    llmProvider: imageLlmResolution.provider,
    llmModel: imageLlmResolution.model,
    requestedImageLlm: imageLlmResolution.requestedImageLlm,
    fallbackReason: imageLlmResolution.fallbackReason,
    llmDurationMs: Date.now() - imageLlmStartedAt,
    imageCount: images.length,
  });
  return generatedImage;
}

async function runOutfitSetImageJob({
  deps,
  email,
  capsuleId,
  setIndex,
  capsule,
  outfitSets,
  setItems,
  jobId = null,
  rethrowErrors = false,
  signal,
}) {
  const {
    buildCapsuleEventSnapshotImpl,
    getCapsuleImpl,
    publishSnapshotImpl,
    updateCapsuleSavedSnapshotImpl,
    updateCapsuleSnapshotImpl,
  } = deps;
  let currentCapsule = capsule;

  try {
    throwIfAborted(signal);
    const generatedImage = await generateOutfitSetImageAsset({
      deps,
      email,
      capsuleId,
      setIndex,
      setItems,
      signal,
    });
    throwIfAborted(signal);
    const latestCapsule = await getCapsuleImpl(email, capsuleId);
    if (!latestCapsule) {
      currentCapsule = null;
      return;
    }
    const latestEffectiveSnapshot = getEffectiveCapsuleSnapshot(latestCapsule);
    const { wardrobe: latestWardrobe, outfitSets: latestOutfitSets } =
      getOutfitSetsFromSnapshot(latestEffectiveSnapshot);
    if (!latestOutfitSets[setIndex]) {
      currentCapsule = latestCapsule;
      return;
    }

    const nextOutfitSets = latestOutfitSets.map((set, index) =>
      index === setIndex
        ? {
            ...set,
            image: generatedImage?.url || null,
            imageObsolete:
              Boolean(generatedImage?.url) &&
              !areOutfitSetItemIdsEqual(outfitSets[setIndex], set),
          }
        : set,
    );
    currentCapsule = await updateOutfitSetImageSnapshot({
      capsule: latestCapsule,
      capsuleId,
      email,
      nextSnapshot: buildOutfitSetSnapshotUpdate(
        latestEffectiveSnapshot,
        latestWardrobe,
        nextOutfitSets,
      ),
      updateCapsuleSavedSnapshotImpl,
      updateCapsuleSnapshotImpl,
    });
  } catch (error) {
    logError("[outfit-set-image]", {
      message: error?.message || "unknown_error",
      stack: typeof error?.stack === "string" ? error.stack : null,
      capsuleId,
      setIndex,
    });
    if (rethrowErrors) {
      throw error;
    }
  } finally {
    await publishOutfitSetSnapshot({
      deps,
      email,
      capsuleId,
      capsule: currentCapsule,
      jobId,
      publishSnapshotImpl,
      buildCapsuleEventSnapshotImpl,
    });
  }
}

async function runOutfitSetImageGenerationJob({
  deps,
  email,
  capsuleId,
  setIndex,
  jobId = null,
  signal = null,
}) {
  const { getCapsuleImpl } = deps;
  if (!isValidOutfitSetImageRequest({ capsuleId, setIndex })) {
    const error = new Error("invalid_payload") as Error & { code?: string };
    error.code = "invalid_payload";
    throw error;
  }
  const capsule = await getCapsuleImpl(email, capsuleId);
  if (!capsule) {
    const error = new Error("not_found") as Error & { code?: string };
    error.code = "not_found";
    throw error;
  }
  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const { wardrobe, outfitSets } = getOutfitSetsFromSnapshot(effectiveSnapshot);
  if (!outfitSets[setIndex]) {
    const error = new Error("not_found") as Error & { code?: string };
    error.code = "not_found";
    throw error;
  }
  const setItems = resolveTargetSetItems(wardrobe, setIndex);
  if (!Array.isArray(setItems) || setItems.length < 3) {
    const error = new Error("invalid_payload") as Error & { code?: string };
    error.code = "invalid_payload";
    throw error;
  }
  await runOutfitSetImageJob({
    deps,
    email,
    capsuleId,
    setIndex,
    capsule,
    outfitSets,
    setItems,
    jobId,
    rethrowErrors: true,
    signal,
  });
  return { capsuleId, setIndex };
}

const DEFAULT_OUTFIT_SET_IMAGE_DEPS = {
  buildCapsuleEventSnapshotImpl: buildCapsuleEventSnapshot as (
    payload?: Record<string, unknown>,
  ) => unknown,
  buildOutfitSetDescriptionImpl: buildOutfitSetDescription,
  downloadProductImageAssetsImpl: downloadProductImageAssets,
  generateImageWithGeminiImpl: generateImageWithGemini,
  generateImageWithOpenAiImpl: generateImageWithOpenAi,
  getCapsuleImpl: getCapsule,
  getProfileImpl: getProfile,
  publishSnapshotImpl: (email, capsuleId, snapshot) =>
    capsuleEventHub.publish(email, capsuleId, snapshot),
  updateCapsuleSavedSnapshotImpl: updateCapsuleSavedSnapshot,
  updateCapsuleSnapshotImpl: updateCapsuleSnapshot,
  uploadImageToR2Impl: uploadImageToR2,
};

export { buildPromptFromTemplate, runOutfitSetImageGenerationJob };

export const deleteOutfitSetImage = createDeleteOutfitSetImage(
  DEFAULT_OUTFIT_SET_IMAGE_DEPS,
);
