import { randomUUID } from "node:crypto";
import {
  getProductsByUrlsForEmailInOrder,
  listWardrobeItemsByUrlsForEmail,
} from "../db.js";
import {
  getOutfit,
  getEffectiveOutfitSnapshot,
  updateOutfitSnapshot,
} from "../outfitStore.js";
import { getOutfitItems } from "../outfitHttp.js";
import { getProfile } from "../profileStore.js";
import { uploadImageToR2 } from "../r2Storage.js";
import { logError } from "../logger.js";
import { logWardrobeInfo } from "./ai.js";
import { generateImageWithGemini } from "./geminiImage.js";
import { resolveImageLlmProvider } from "./imageLlm.js";
import { generateImageWithOpenAi } from "./openaiImage.js";
import { buildOutfitSetDescription } from "./outfitSetImageDescription.js";
import {
  buildPromptFromTemplate,
  saveOutfitSetDebugArtifacts,
} from "./outfitSetImagePrompt.js";
import {
  createOutfitImageJobKey,
  deleteOutfitImageJob,
  getOutfitImageJob,
  getOutfitImageJobByKey,
  setPendingOutfitImageJob,
} from "./outfitImageJobs.js";
import { downloadProductImageAssets } from "./promptImages.js";
import { buildOutfitEventSnapshot, outfitEventHub } from "./outfitEvents.js";

function getOutfitImageRequestContext(req) {
  return {
    email: String(req?.user?.email || "")
      .trim()
      .toLowerCase(),
    outfitId: String(req?.params?.id || "").trim(),
  };
}

function isValidOutfitImageRequest({ outfitId }) {
  return Boolean(outfitId);
}

function buildOutfitImageSnapshotUpdate(
  effectiveSnapshot,
  image,
  imageObsolete,
) {
  return {
    ...(effectiveSnapshot || { items: [] }),
    image,
    imageObsolete: Boolean(imageObsolete),
  };
}

function getSnapshotItemRefs(snapshot) {
  return Array.isArray(snapshot?.items) ? snapshot.items : [];
}

function areOutfitSnapshotItemsEqual(left, right) {
  return (
    JSON.stringify(getSnapshotItemRefs(left)) ===
    JSON.stringify(getSnapshotItemRefs(right))
  );
}

function publishOutfitImageSnapshot({
  email,
  outfitId,
  outfit,
  publishSnapshotImpl,
}) {
  publishSnapshotImpl(
    email,
    outfitId,
    buildOutfitEventSnapshot({
      outfit,
      pendingImage: Boolean(getOutfitImageJob(email, outfitId)),
    }),
  );
}

function buildOutfitGeneratedImage(result, { uploadImageToR2Impl, outfitId }) {
  return result?.image?.base64
    ? uploadImageToR2Impl({
        buffer: Buffer.from(result.image.base64, "base64"),
        mimeType: result.image.mimeType || "image/png",
        capsuleId: outfitId,
        setIndex: 0,
        namespace: "outfit",
      })
    : null;
}

async function generateOutfitImageAsset({ deps, email, outfitId, items }) {
  const {
    buildOutfitSetDescriptionImpl,
    downloadProductImageAssetsImpl,
    generateImageWithGeminiImpl,
    generateImageWithOpenAiImpl,
    getProfileImpl,
    uploadImageToR2Impl,
  } = deps;
  const prompt = buildPromptFromTemplate(items, {
    buildOutfitSetDescriptionImpl,
  });
  saveOutfitSetDebugArtifacts({ prompt });
  const imageAssetsById = await downloadProductImageAssetsImpl(items);
  const images = items
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
  const generatedImage = await buildOutfitGeneratedImage(result, {
    uploadImageToR2Impl,
    outfitId,
  });
  logWardrobeInfo("outfit-image-llm-completed", {
    llmProvider: imageLlmResolution.provider,
    llmModel: imageLlmResolution.model,
    requestedImageLlm: imageLlmResolution.requestedImageLlm,
    fallbackReason: imageLlmResolution.fallbackReason,
    llmDurationMs: Date.now() - imageLlmStartedAt,
    imageCount: images.length,
  });
  return generatedImage;
}

async function runOutfitImageJob({
  deps,
  email,
  outfitId,
  outfit,
  effectiveSnapshot,
  items,
  jobKey,
}) {
  const { getOutfitImpl, publishSnapshotImpl, updateOutfitSnapshotImpl } = deps;
  let currentOutfit = outfit;

  try {
    const generatedImage = await generateOutfitImageAsset({
      deps,
      email,
      outfitId,
      items,
    });
    const latestOutfit = await getOutfitImpl(email, outfitId);
    if (!latestOutfit) {
      currentOutfit = null;
      return;
    }
    const latestEffectiveSnapshot = getEffectiveOutfitSnapshot(latestOutfit);
    currentOutfit = await updateOutfitSnapshotImpl(
      email,
      outfitId,
      buildOutfitImageSnapshotUpdate(
        latestEffectiveSnapshot,
        generatedImage?.url || null,
        Boolean(generatedImage?.url) &&
          !areOutfitSnapshotItemsEqual(
            effectiveSnapshot,
            latestEffectiveSnapshot,
          ),
      ),
    );
  } catch (error) {
    logError("[outfit-image]", {
      message: error?.message || "unknown_error",
      stack: typeof error?.stack === "string" ? error.stack : null,
      outfitId,
    });
  } finally {
    deleteOutfitImageJob(jobKey);
    publishOutfitImageSnapshot({
      email,
      outfitId,
      outfit: currentOutfit,
      publishSnapshotImpl,
    });
  }
}

function createDeleteOutfitImage(deps) {
  const { getOutfitImpl, publishSnapshotImpl, updateOutfitSnapshotImpl } = deps;

  return async function deleteOutfitImage(req, res) {
    const { email, outfitId } = getOutfitImageRequestContext(req);
    if (!isValidOutfitImageRequest({ outfitId })) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const outfit = await getOutfitImpl(email, outfitId);
    if (!outfit) {
      return res.status(404).json({ error: "not_found" });
    }

    const updatedOutfit = await updateOutfitSnapshotImpl(
      email,
      outfitId,
      buildOutfitImageSnapshotUpdate(
        getEffectiveOutfitSnapshot(outfit),
        null,
        false,
      ),
    );
    publishOutfitImageSnapshot({
      email,
      outfitId,
      outfit: updatedOutfit,
      publishSnapshotImpl,
    });
    return res.json({ ok: true, status: "ready" });
  };
}

function createGenerateOutfitImage(deps) {
  const { getOutfitImpl, getOutfitItemsImpl, publishSnapshotImpl } = deps;

  return async function generateOutfitImage(req, res) {
    const { email, outfitId } = getOutfitImageRequestContext(req);
    if (!isValidOutfitImageRequest({ outfitId })) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const outfit = await getOutfitImpl(email, outfitId);
    if (!outfit) {
      return res.status(404).json({ error: "not_found" });
    }

    const effectiveSnapshot = getEffectiveOutfitSnapshot(outfit);
    if (
      typeof effectiveSnapshot?.image === "string" &&
      effectiveSnapshot.image.trim().length > 0
    ) {
      return res.json({ ok: true, status: "ready" });
    }

    const items = await getOutfitItemsImpl(outfit, {
      email,
      getProductsByUrlsForEmailImpl: deps.getProductsByUrlsForEmailImpl,
      listWardrobeItemsByUrlsImpl: deps.listWardrobeItemsByUrlsImpl,
    });
    if (!Array.isArray(items) || items.length < 3) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const jobKey = createOutfitImageJobKey(email, outfitId);
    if (getOutfitImageJobByKey(jobKey)?.status === "pending") {
      return res.status(202).json({ ok: true, status: "pending" });
    }

    setPendingOutfitImageJob(jobKey, {
      id: randomUUID(),
      status: "pending",
    });
    publishOutfitImageSnapshot({
      email,
      outfitId,
      outfit,
      publishSnapshotImpl,
    });
    runOutfitImageJob({
      deps,
      email,
      outfitId,
      outfit,
      effectiveSnapshot,
      items,
      jobKey,
    });

    return res.status(202).json({ ok: true, status: "pending" });
  };
}

// eslint-disable-next-line complexity
function createOutfitImageService({
  getOutfitImpl = getOutfit,
  getOutfitItemsImpl = getOutfitItems,
  getProfileImpl = getProfile,
  updateOutfitSnapshotImpl = updateOutfitSnapshot,
  publishSnapshotImpl = ((email, outfitId, snapshot) =>
    outfitEventHub.publish(email, outfitId, snapshot)) as (
    email: string,
    outfitId: string,
    snapshot: unknown,
  ) => void | boolean,
  downloadProductImageAssetsImpl = downloadProductImageAssets,
  generateImageWithOpenAiImpl = generateImageWithOpenAi,
  generateImageWithGeminiImpl = generateImageWithGemini,
  uploadImageToR2Impl = uploadImageToR2,
  buildOutfitSetDescriptionImpl = buildOutfitSetDescription,
  getProductsByUrlsForEmailImpl = getProductsByUrlsForEmailInOrder,
  listWardrobeItemsByUrlsImpl = listWardrobeItemsByUrlsForEmail,
} = {}) {
  const deps = {
    buildOutfitSetDescriptionImpl,
    downloadProductImageAssetsImpl,
    generateImageWithGeminiImpl,
    generateImageWithOpenAiImpl,
    getOutfitImpl,
    getOutfitItemsImpl,
    getProductsByUrlsForEmailImpl,
    getProfileImpl,
    listWardrobeItemsByUrlsImpl,
    publishSnapshotImpl,
    updateOutfitSnapshotImpl,
    uploadImageToR2Impl,
  };

  return {
    deleteOutfitImage: createDeleteOutfitImage(deps),
    generateOutfitImage: createGenerateOutfitImage(deps),
  };
}

const outfitImageService = createOutfitImageService();

export { createOutfitImageService };

export const deleteOutfitImage = outfitImageService.deleteOutfitImage;
export const generateOutfitImage = outfitImageService.generateOutfitImage;
