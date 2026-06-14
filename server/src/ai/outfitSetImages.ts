import { randomUUID } from "node:crypto";
import type { OutfitSetImageServiceOptions } from "./outfitSetImageServiceTypes.js";
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
  resolveSnapshotUpdater,
  resolveTargetSetItems,
  updateOutfitSetImageSnapshot,
} from "./outfitSetImageSnapshots.js";
import {
  buildPromptFromTemplate,
  saveOutfitSetDebugArtifacts,
} from "./outfitSetImagePrompt.js";
import {
  createOutfitSetImageJobKey,
  deleteOutfitSetImageJob,
  getOutfitSetImageJob,
  getOutfitSetImageJobByKey,
  setPendingOutfitSetImageJob,
} from "./outfitSetImageJobs.js";
import {
  getOutfitSetImageRequestContext,
  isValidOutfitSetImageRequest,
} from "./outfitSetImageRequest.js";
import { downloadProductImageAssets } from "./promptImages.js";
import { uploadImageToR2 } from "../r2Storage.js";
import { logError } from "../logger.js";

function publishOutfitSetSnapshot({
  email,
  capsuleId,
  capsule,
  publishSnapshotImpl,
  buildCapsuleEventSnapshotImpl,
}) {
  publishSnapshotImpl(
    email,
    capsuleId,
    buildCapsuleEventSnapshotImpl({
      capsule,
      outfitSetImageJob: getOutfitSetImageJob(email, capsuleId),
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
      email,
      capsuleId,
      capsule: updatedCapsule,
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
  });
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
  jobKey,
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
    const generatedImage = await generateOutfitSetImageAsset({
      deps,
      email,
      capsuleId,
      setIndex,
      setItems,
    });
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
  } finally {
    deleteOutfitSetImageJob(jobKey);
    publishOutfitSetSnapshot({
      email,
      capsuleId,
      capsule: currentCapsule,
      publishSnapshotImpl,
      buildCapsuleEventSnapshotImpl,
    });
  }
}

function createGenerateOutfitSetImage(deps) {
  const { buildCapsuleEventSnapshotImpl, getCapsuleImpl, publishSnapshotImpl } =
    deps;

  return async function generateOutfitSetImage(req, res) {
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
    const targetSet = outfitSets[setIndex];
    if (!targetSet) {
      return res.status(404).json({ error: "not_found" });
    }

    if (
      typeof targetSet?.image === "string" &&
      targetSet.image.trim().length > 0
    ) {
      return res.json({ ok: true, status: "ready" });
    }

    const setItems = resolveTargetSetItems(wardrobe, setIndex);
    if (!Array.isArray(setItems) || setItems.length < 3) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const jobKey = createOutfitSetImageJobKey(email, capsuleId, setIndex);
    if (getOutfitSetImageJobByKey(jobKey)?.status === "pending") {
      return res.status(202).json({ ok: true, status: "pending" });
    }

    setPendingOutfitSetImageJob(jobKey, {
      id: randomUUID(),
      status: "pending",
      setIndex,
    });
    publishOutfitSetSnapshot({
      email,
      capsuleId,
      capsule,
      publishSnapshotImpl,
      buildCapsuleEventSnapshotImpl,
    });
    runOutfitSetImageJob({
      deps,
      email,
      capsuleId,
      setIndex,
      capsule,
      outfitSets,
      setItems,
      jobKey,
    });

    return res.status(202).json({ ok: true, status: "pending" });
  };
}

function createOutfitSetImageService(
  options: OutfitSetImageServiceOptions = {},
) {
  const {
    getCapsuleImpl = getCapsule,
    getProfileImpl,
    updateCapsuleSavedSnapshotImpl = undefined,
    updateCapsuleSnapshotImpl = updateCapsuleSnapshot,
    publishSnapshotImpl = ((email, capsuleId, snapshot) =>
      capsuleEventHub.publish(email, capsuleId, snapshot)) as (
      email: string,
      capsuleId: string,
      snapshot: unknown,
    ) => void | boolean,
    buildCapsuleEventSnapshotImpl = buildCapsuleEventSnapshot as (
      payload?: Record<string, unknown>,
    ) => unknown,
    downloadProductImageAssetsImpl = downloadProductImageAssets,
    generateImageWithOpenAiImpl = generateImageWithOpenAi,
    generateImageWithGeminiImpl = generateImageWithGemini,
    uploadImageToR2Impl = uploadImageToR2,
    buildOutfitSetDescriptionImpl = buildOutfitSetDescription,
  } = options;
  const deps = {
    buildCapsuleEventSnapshotImpl,
    buildOutfitSetDescriptionImpl,
    downloadProductImageAssetsImpl,
    generateImageWithGeminiImpl,
    generateImageWithOpenAiImpl,
    getCapsuleImpl,
    getProfileImpl: resolveSnapshotUpdater(getProfileImpl, getProfile),
    publishSnapshotImpl,
    updateCapsuleSavedSnapshotImpl: resolveSnapshotUpdater(
      updateCapsuleSavedSnapshotImpl,
      updateCapsuleSavedSnapshot,
    ),
    updateCapsuleSnapshotImpl,
    uploadImageToR2Impl,
  };

  return {
    deleteOutfitSetImage: createDeleteOutfitSetImage(deps),
    generateOutfitSetImage: createGenerateOutfitSetImage(deps),
  };
}

const outfitSetImageService = createOutfitSetImageService();

export {
  buildPromptFromTemplate,
  createOutfitSetImageService,
  getOutfitSetImageJob,
};

export const deleteOutfitSetImage = outfitSetImageService.deleteOutfitSetImage;
export const generateOutfitSetImage =
  outfitSetImageService.generateOutfitSetImage;
