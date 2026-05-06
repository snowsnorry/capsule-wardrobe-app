import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { getCapsule, getEffectiveCapsuleSnapshot, updateCapsuleSnapshot } from "../capsuleStore.js";
import { getProfile } from "../profileStore.js";
import { buildCapsuleEventSnapshot, capsuleEventHub } from "./capsuleEvents.js";
import { generateImageWithGemini } from "./geminiImage.js";
import { resolveImageLlmProvider } from "./imageLlm.js";
import { logWardrobeInfo } from "./ai.js";
import { generateImageWithOpenAi } from "./openaiImage.js";
import { buildOutfitSetDescription } from "./outfitSetImageDescription.js";
import { downloadProductImageAssets } from "./promptImages.js";
import { uploadImageToR2 } from "../r2Storage.js";
import { logError } from "../logger.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent
} from "./promptTemplates.js";

const IMAGE_GENERATION_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_image_generation.yaml", import.meta.url)
);
const PROMPT_TEMPLATE = getPromptTemplateContent(IMAGE_GENERATION_PROMPT_TEMPLATE, "user");
const LAST_PROMPT_DIR_URL = new URL("../../../last-prompt/", import.meta.url);
const outfitSetImageJobs = new Map();

function createOutfitSetImageJobKey(email, capsuleId, setIndex) {
  return `${String(email || "").trim().toLowerCase()}::${String(capsuleId || "").trim()}::${Number.parseInt(setIndex, 10)}`;
}

function getOutfitSetImageJob(email, capsuleId) {
  const emailPrefix = `${String(email || "").trim().toLowerCase()}::${String(capsuleId || "").trim()}::`;
  const pendingSetIndexes = [];

  for (const [key, job] of outfitSetImageJobs.entries()) {
    if (!key.startsWith(emailPrefix) || job?.status !== "pending") {
      continue;
    }
    pendingSetIndexes.push(job.setIndex);
  }

  if (pendingSetIndexes.length === 0) {
    return null;
  }

  return {
    status: "pending",
    pendingSetIndexes: pendingSetIndexes.sort((left, right) => left - right)
  };
}

function buildPromptFromTemplate(items, {
  promptTemplate = PROMPT_TEMPLATE,
  buildOutfitSetDescriptionImpl = buildOutfitSetDescription
} = {}) {
  const description = buildOutfitSetDescriptionImpl(items);
  const template = String(promptTemplate || "");
  const rendered = renderPromptTemplateContent(template, {
    description
  }, "outfit set image prompt");
  return template.includes("{{description}}")
    ? rendered
    : [rendered, description].filter((part) => part.trim().length > 0).join("\n\n");
}

function saveOutfitSetDebugArtifacts({ prompt }) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  mkdirSync(LAST_PROMPT_DIR_URL, { recursive: true });
  writeFileSync(new URL("outfit_set_last_prompt.txt", LAST_PROMPT_DIR_URL), String(prompt || ""), "utf8");
}

function resolveTargetSetItems(wardrobe, setIndex) {
  const items = Array.isArray(wardrobe?.items) ? wardrobe.items : [];
  const targetSet = Array.isArray(wardrobe?.outfitSets) ? wardrobe.outfitSets[setIndex] : null;
  if (!targetSet) {
    return null;
  }

  const itemsById = new Map(
    items
      .map((item) => [String(item?.id || "").trim(), item])
      .filter(([id]) => id)
  );

  return (Array.isArray(targetSet?.itemIds) ? targetSet.itemIds : [])
    .map((itemId) => itemsById.get(String(itemId || "").trim()))
    .filter(Boolean);
}

function getOutfitSetImageRequestContext(req) {
  return {
    email: String(req?.user?.email || "").trim().toLowerCase(),
    capsuleId: String(req?.params?.id || "").trim(),
    setIndex: Number.parseInt(String(req?.params?.setIndex || ""), 10)
  };
}

function isValidOutfitSetImageRequest({ capsuleId, setIndex }) {
  return Boolean(capsuleId) && Number.isInteger(setIndex) && setIndex >= 0;
}

function getOutfitSetsFromSnapshot(effectiveSnapshot) {
  const wardrobe = effectiveSnapshot?.data?.wardrobe;
  return {
    outfitSets: Array.isArray(wardrobe?.outfitSets) ? wardrobe.outfitSets : [],
    wardrobe
  };
}

function publishOutfitSetSnapshot({ email, capsuleId, capsule, publishSnapshotImpl, buildCapsuleEventSnapshotImpl }) {
  publishSnapshotImpl(email, capsuleId, buildCapsuleEventSnapshotImpl({
    capsule,
    outfitSetImageJob: getOutfitSetImageJob(email, capsuleId)
  }));
}

function buildOutfitSetSnapshotUpdate(effectiveSnapshot, wardrobe, outfitSets) {
  return {
    filters: effectiveSnapshot?.filters,
    data: {
      wardrobe: {
        ...wardrobe,
        outfitSets
      },
      rejectedUrls: effectiveSnapshot?.data?.rejectedUrls || []
    }
  };
}

function createDeleteOutfitSetImage(deps) {
  const {
    buildCapsuleEventSnapshotImpl,
    getCapsuleImpl,
    publishSnapshotImpl,
    updateCapsuleSnapshotImpl
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
    const { wardrobe, outfitSets } = getOutfitSetsFromSnapshot(effectiveSnapshot);
    if (!outfitSets[setIndex]) {
      return res.status(404).json({ error: "not_found" });
    }

    const nextOutfitSets = outfitSets.map((set, index) => (
      index === setIndex ? { ...set, image: null, imageObsolete: false } : set
    ));
    const updatedCapsule = await updateCapsuleSnapshotImpl(
      email,
      capsuleId,
      buildOutfitSetSnapshotUpdate(effectiveSnapshot, wardrobe, nextOutfitSets)
    );

    publishOutfitSetSnapshot({
      email,
      capsuleId,
      capsule: updatedCapsule,
      publishSnapshotImpl,
      buildCapsuleEventSnapshotImpl
    });

    return res.json({ ok: true, status: "ready" });
  };
}

function buildOutfitSetGeneratedImage(result, { uploadImageToR2Impl, capsuleId, setIndex }) {
  return result?.image?.base64
    ? uploadImageToR2Impl({
      buffer: Buffer.from(result.image.base64, "base64"),
      mimeType: result.image.mimeType || "image/png",
      capsuleId,
      setIndex,
      namespace: "generated"
    })
    : null;
}

async function generateOutfitSetImageAsset({ deps, email, capsuleId, setIndex, setItems }) {
  const {
    buildOutfitSetDescriptionImpl,
    downloadProductImageAssetsImpl,
    generateImageWithGeminiImpl,
    generateImageWithOpenAiImpl,
    getProfileImpl,
    uploadImageToR2Impl
  } = deps;
  const prompt = buildPromptFromTemplate(setItems, { buildOutfitSetDescriptionImpl });
  saveOutfitSetDebugArtifacts({ prompt });
  const imageAssetsById = await downloadProductImageAssetsImpl(setItems);
  const images = setItems
    .map((item) => imageAssetsById[String(item?.id || "").trim()] || null)
    .filter(Boolean);
  const userProfile = await getProfileImpl(email);
  const imageLlmResolution = resolveImageLlmProvider(userProfile);
  const imageLlmStartedAt = Date.now();
  const generateImageImpl = imageLlmResolution.provider === "gemini"
    ? generateImageWithGeminiImpl
    : generateImageWithOpenAiImpl;
  const result = await generateImageImpl(prompt, {
    images,
    model: imageLlmResolution.model
  });
  const generatedImage = await buildOutfitSetGeneratedImage(result, { uploadImageToR2Impl, capsuleId, setIndex });
  logWardrobeInfo("outfit-set-image-llm-completed", {
    llmProvider: imageLlmResolution.provider,
    llmModel: imageLlmResolution.model,
    requestedImageLlm: imageLlmResolution.requestedImageLlm,
    fallbackReason: imageLlmResolution.fallbackReason,
    llmDurationMs: Date.now() - imageLlmStartedAt,
    imageCount: images.length
  });
  return generatedImage;
}

async function runOutfitSetImageJob({ deps, email, capsuleId, setIndex, capsule, effectiveSnapshot, wardrobe, outfitSets, setItems, jobKey }) {
  const {
    buildCapsuleEventSnapshotImpl,
    publishSnapshotImpl,
    updateCapsuleSnapshotImpl
  } = deps;
  let currentCapsule = capsule;

  try {
    const generatedImage = await generateOutfitSetImageAsset({ deps, email, capsuleId, setIndex, setItems });
    const nextOutfitSets = outfitSets.map((set, index) => (
      index === setIndex
        ? { ...set, image: generatedImage?.url || null, imageObsolete: false }
        : set
    ));
    currentCapsule = await updateCapsuleSnapshotImpl(
      email,
      capsuleId,
      buildOutfitSetSnapshotUpdate(effectiveSnapshot, wardrobe, nextOutfitSets)
    );
  } catch (error) {
    logError("[outfit-set-image]", {
      message: error?.message || "unknown_error",
      stack: typeof error?.stack === "string" ? error.stack : null,
      capsuleId,
      setIndex
    });
  } finally {
    outfitSetImageJobs.delete(jobKey);
    publishOutfitSetSnapshot({
      email,
      capsuleId,
      capsule: currentCapsule,
      publishSnapshotImpl,
      buildCapsuleEventSnapshotImpl
    });
  }
}

function createGenerateOutfitSetImage(deps) {
  const {
    buildCapsuleEventSnapshotImpl,
    getCapsuleImpl,
    publishSnapshotImpl
  } = deps;

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
    const { wardrobe, outfitSets } = getOutfitSetsFromSnapshot(effectiveSnapshot);
    const targetSet = outfitSets[setIndex];
    if (!targetSet) {
      return res.status(404).json({ error: "not_found" });
    }

    if (typeof targetSet?.image === "string" && targetSet.image.trim().length > 0) {
      return res.json({ ok: true, status: "ready" });
    }

    const setItems = resolveTargetSetItems(wardrobe, setIndex);
    if (!Array.isArray(setItems) || setItems.length < 3) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const jobKey = createOutfitSetImageJobKey(email, capsuleId, setIndex);
    if (outfitSetImageJobs.get(jobKey)?.status === "pending") {
      return res.status(202).json({ ok: true, status: "pending" });
    }

    outfitSetImageJobs.set(jobKey, { id: randomUUID(), status: "pending", setIndex });
    publishOutfitSetSnapshot({ email, capsuleId, capsule, publishSnapshotImpl, buildCapsuleEventSnapshotImpl });
    runOutfitSetImageJob({ deps, email, capsuleId, setIndex, capsule, effectiveSnapshot, wardrobe, outfitSets, setItems, jobKey });

    return res.status(202).json({ ok: true, status: "pending" });
  };
}

function createOutfitSetImageService({
  getCapsuleImpl = getCapsule,
  getProfileImpl = getProfile,
  updateCapsuleSnapshotImpl = updateCapsuleSnapshot,
  publishSnapshotImpl = ((email, capsuleId, snapshot) => capsuleEventHub.publish(email, capsuleId, snapshot)) as (
    email: string,
    capsuleId: string,
    snapshot: unknown
  ) => void | boolean,
  buildCapsuleEventSnapshotImpl = buildCapsuleEventSnapshot as (payload?: Record<string, unknown>) => unknown,
  downloadProductImageAssetsImpl = downloadProductImageAssets,
  generateImageWithOpenAiImpl = generateImageWithOpenAi,
  generateImageWithGeminiImpl = generateImageWithGemini,
  uploadImageToR2Impl = uploadImageToR2,
	  buildOutfitSetDescriptionImpl = buildOutfitSetDescription
	} = {}) {
  const deps = {
    buildCapsuleEventSnapshotImpl,
    buildOutfitSetDescriptionImpl,
    downloadProductImageAssetsImpl,
    generateImageWithGeminiImpl,
    generateImageWithOpenAiImpl,
    getCapsuleImpl,
    getProfileImpl,
    publishSnapshotImpl,
    updateCapsuleSnapshotImpl,
    uploadImageToR2Impl
  };

	  return {
    deleteOutfitSetImage: createDeleteOutfitSetImage(deps),
    generateOutfitSetImage: createGenerateOutfitSetImage(deps)
	  };
	}

const outfitSetImageService = createOutfitSetImageService();

export {
  buildPromptFromTemplate,
  createOutfitSetImageJobKey,
  createOutfitSetImageService,
  getOutfitSetImageJob,
  saveOutfitSetDebugArtifacts
};

export const deleteOutfitSetImage = outfitSetImageService.deleteOutfitSetImage;
export const generateOutfitSetImage = outfitSetImageService.generateOutfitSetImage;
