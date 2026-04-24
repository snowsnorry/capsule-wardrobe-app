import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const PROMPT_TEMPLATE = readFileSync(new URL("../templates/prompt_image.txt", import.meta.url), "utf8");
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
  return String(promptTemplate || "")
    .replaceAll("{{description}}", description);
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
  async function deleteOutfitSetImage(req, res) {
    const email = String(req?.user?.email || "").trim().toLowerCase();
    const capsuleId = String(req?.params?.id || "").trim();
    const setIndex = Number.parseInt(String(req?.params?.setIndex || ""), 10);

    if (!capsuleId || !Number.isInteger(setIndex) || setIndex < 0) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const capsule = await getCapsuleImpl(email, capsuleId);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }

    const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
    const wardrobe = effectiveSnapshot?.data?.wardrobe;
    const outfitSets = Array.isArray(wardrobe?.outfitSets) ? wardrobe.outfitSets : [];
    const targetSet = outfitSets[setIndex];

    if (!targetSet) {
      return res.status(404).json({ error: "not_found" });
    }

    const nextOutfitSets = outfitSets.map((set, index) => (
      index === setIndex
        ? {
          ...set,
          image: null,
          imageObsolete: false
        }
        : set
    ));

    const updatedCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, {
      filters: effectiveSnapshot?.filters,
      data: {
        wardrobe: {
          ...wardrobe,
          outfitSets: nextOutfitSets
        },
        rejectedUrls: effectiveSnapshot?.data?.rejectedUrls || []
      }
    });

    publishSnapshotImpl(email, capsuleId, buildCapsuleEventSnapshotImpl({
      capsule: updatedCapsule,
      outfitSetImageJob: getOutfitSetImageJob(email, capsuleId)
    }));

    return res.json({ ok: true, status: "ready" });
  }

  async function generateOutfitSetImage(req, res) {
    const email = String(req?.user?.email || "").trim().toLowerCase();
    const capsuleId = String(req?.params?.id || "").trim();
    const setIndex = Number.parseInt(String(req?.params?.setIndex || ""), 10);

    if (!capsuleId || !Number.isInteger(setIndex) || setIndex < 0) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const capsule = await getCapsuleImpl(email, capsuleId);
    if (!capsule) {
      return res.status(404).json({ error: "not_found" });
    }

    const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
    const wardrobe = effectiveSnapshot?.data?.wardrobe;
    const outfitSets = Array.isArray(wardrobe?.outfitSets) ? wardrobe.outfitSets : [];
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
    const existingJob = outfitSetImageJobs.get(jobKey);
    if (existingJob?.status === "pending") {
      return res.status(202).json({ ok: true, status: "pending" });
    }

    const job = {
      id: randomUUID(),
      status: "pending",
      setIndex
    };
    outfitSetImageJobs.set(jobKey, job);

    publishSnapshotImpl(email, capsuleId, buildCapsuleEventSnapshotImpl({
      capsule,
      outfitSetImageJob: getOutfitSetImageJob(email, capsuleId)
    }));

    (async () => {
      let currentCapsule = capsule;

      try {
        const prompt = buildPromptFromTemplate(setItems, {
          buildOutfitSetDescriptionImpl
        });
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
        const generatedImage = result?.image?.base64
          ? await uploadImageToR2Impl({
            buffer: Buffer.from(result.image.base64, "base64"),
            mimeType: result.image.mimeType || "image/png",
            capsuleId,
            setIndex,
            namespace: "generated"
          })
          : null;
        logWardrobeInfo("outfit-set-image-llm-completed", {
          llmProvider: imageLlmResolution.provider,
          llmModel: imageLlmResolution.model,
          requestedImageLlm: imageLlmResolution.requestedImageLlm,
          fallbackReason: imageLlmResolution.fallbackReason,
          llmDurationMs: Date.now() - imageLlmStartedAt,
          imageCount: images.length
        });

        const nextOutfitSets = outfitSets.map((set, index) => (
          index === setIndex
            ? {
              ...set,
              image: generatedImage?.url || null,
              imageObsolete: false
            }
            : set
        ));

        currentCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, {
          filters: effectiveSnapshot?.filters,
          data: {
            wardrobe: {
              ...wardrobe,
              outfitSets: nextOutfitSets
            },
            rejectedUrls: effectiveSnapshot?.data?.rejectedUrls || []
          }
        });
      } catch (error) {
        console.error("[outfit-set-image]", {
          message: error?.message || "unknown_error",
          stack: typeof error?.stack === "string" ? error.stack : null,
          capsuleId,
          setIndex
        });
      } finally {
        outfitSetImageJobs.delete(jobKey);
        publishSnapshotImpl(email, capsuleId, buildCapsuleEventSnapshotImpl({
          capsule: currentCapsule,
          outfitSetImageJob: getOutfitSetImageJob(email, capsuleId)
        }));
      }
    })();

    return res.status(202).json({ ok: true, status: "pending" });
  }

  return {
    deleteOutfitSetImage,
    generateOutfitSetImage
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
