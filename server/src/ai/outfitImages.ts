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
import { downloadProductImageAssets } from "./promptImages.js";
import { buildOutfitEventSnapshot, outfitEventHub } from "./outfitEvents.js";
import { throwIfAborted } from "./abortSignal.js";

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

async function hasOtherActiveOutfitImageJob({ deps, email, outfitId, jobId }) {
  const listActiveJobsForEntityImpl = deps.listActiveJobsForEntityImpl;
  if (typeof listActiveJobsForEntityImpl !== "function") {
    return false;
  }

  try {
    const jobs = await listActiveJobsForEntityImpl({
      email,
      entityType: "outfit",
      entityId: outfitId,
      kinds: ["outfitImageGenerate"],
    });
    return jobs.some((job) => String(job?.id || "") !== String(jobId || ""));
  } catch (error) {
    logError("[outfit-image][pending-jobs]", {
      message: error?.message || "unknown_error",
      outfitId,
    });
    return false;
  }
}

async function publishOutfitImageSnapshot({
  deps,
  email,
  outfitId,
  outfit,
  jobId,
  publishSnapshotImpl,
}) {
  const pendingImage = await hasOtherActiveOutfitImageJob({
    deps,
    email,
    outfitId,
    jobId,
  });
  publishSnapshotImpl(
    email,
    outfitId,
    buildOutfitEventSnapshot({
      outfit,
      pendingImage,
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

async function generateOutfitImageAsset({
  deps,
  email,
  outfitId,
  items,
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
  const prompt = buildPromptFromTemplate(items, {
    buildOutfitSetDescriptionImpl,
  });
  saveOutfitSetDebugArtifacts({ prompt });
  const imageAssetsById = await downloadProductImageAssetsImpl(items);
  throwIfAborted(signal);
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
    signal,
  });
  throwIfAborted(signal);
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

async function persistGeneratedOutfitImage({
  deps,
  email,
  outfitId,
  effectiveSnapshot,
  generatedImage,
}) {
  const latestOutfit = await deps.getOutfitImpl(email, outfitId);
  if (!latestOutfit) {
    return null;
  }
  const latestEffectiveSnapshot = getEffectiveOutfitSnapshot(latestOutfit);
  return deps.updateOutfitSnapshotImpl(
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
}

async function runOutfitImageJob({
  deps,
  email,
  outfitId,
  outfit,
  effectiveSnapshot,
  items,
  jobId = null,
  rethrowErrors = false,
  signal,
}) {
  const { publishSnapshotImpl } = deps;
  let currentOutfit = outfit;

  try {
    throwIfAborted(signal);
    const generatedImage = await generateOutfitImageAsset({
      deps,
      email,
      outfitId,
      items,
      signal,
    });
    throwIfAborted(signal);
    currentOutfit = await persistGeneratedOutfitImage({
      deps,
      email,
      outfitId,
      effectiveSnapshot,
      generatedImage,
    });
  } catch (error) {
    logError("[outfit-image]", {
      message: error?.message || "unknown_error",
      stack: typeof error?.stack === "string" ? error.stack : null,
      outfitId,
    });
    if (rethrowErrors) {
      throw error;
    }
  } finally {
    await publishOutfitImageSnapshot({
      deps,
      email,
      outfitId,
      outfit: currentOutfit,
      jobId,
      publishSnapshotImpl,
    });
  }
}

async function runOutfitImageGenerationJob({
  deps,
  email,
  outfitId,
  jobId = null,
  signal = null,
}) {
  const { getOutfitImpl, getOutfitItemsImpl } = deps;
  if (!outfitId) {
    const error = new Error("invalid_payload") as Error & { code?: string };
    error.code = "invalid_payload";
    throw error;
  }
  const outfit = await getOutfitImpl(email, outfitId);
  if (!outfit) {
    const error = new Error("not_found") as Error & { code?: string };
    error.code = "not_found";
    throw error;
  }
  const effectiveSnapshot = getEffectiveOutfitSnapshot(outfit);
  const items = await getOutfitItemsImpl(outfit, {
    email,
    getProductsByUrlsForEmailImpl: deps.getProductsByUrlsForEmailImpl,
    listWardrobeItemsByUrlsImpl: deps.listWardrobeItemsByUrlsImpl,
  });
  if (!Array.isArray(items) || items.length < 3) {
    const error = new Error("invalid_payload") as Error & { code?: string };
    error.code = "invalid_payload";
    throw error;
  }
  await runOutfitImageJob({
    deps,
    email,
    outfitId,
    outfit,
    effectiveSnapshot,
    items,
    jobId,
    rethrowErrors: true,
    signal,
  });
  return { outfitId };
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
    await publishOutfitImageSnapshot({
      deps,
      email,
      outfitId,
      outfit: updatedOutfit,
      jobId: null,
      publishSnapshotImpl,
    });
    return res.json({ ok: true, status: "ready" });
  };
}

const DEFAULT_OUTFIT_IMAGE_SERVICE_DEPS = {
  buildOutfitSetDescriptionImpl: buildOutfitSetDescription,
  downloadProductImageAssetsImpl: downloadProductImageAssets,
  generateImageWithGeminiImpl: generateImageWithGemini,
  generateImageWithOpenAiImpl: generateImageWithOpenAi,
  getOutfitImpl: getOutfit,
  getOutfitItemsImpl: getOutfitItems,
  getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
  getProfileImpl: getProfile,
  listWardrobeItemsByUrlsImpl: listWardrobeItemsByUrlsForEmail,
  publishSnapshotImpl: (email, outfitId, snapshot) =>
    outfitEventHub.publish(email, outfitId, snapshot),
  updateOutfitSnapshotImpl: updateOutfitSnapshot,
  uploadImageToR2Impl: uploadImageToR2,
};

export { runOutfitImageGenerationJob };

export const deleteOutfitImage = createDeleteOutfitImage(
  DEFAULT_OUTFIT_IMAGE_SERVICE_DEPS,
);
