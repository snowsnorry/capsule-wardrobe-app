import { getProductsByUrlsInOrder, getProductsWithEmbeddingsByUrlsInOrder, getSqlClient } from "../db.js";
import { getGenerateJsonWithLlm, isNoLlmProfileEnabled, resolveLlmProvider } from "./llm.js";
import { buildPromptDebugImagesForCategory, buildPromptDebugImagesInChild } from "./promptImages.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import { getCapsuleCategories } from "./categories.js";
import { buildOutfitSetsFromFormulas, getOutfitFormulas } from "./outfitSets.js";
import { buildShiftedTargetVector, normalizeEmbeddingVector } from "./vectorMath.js";
import { getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { countItemsByKey, enforceCategoryCounts, extractLlmUsage, getSelectedIdsFromCapsule, logWardrobeInfo, toWardrobeUiItem } from "./ai.js";
import { getStoredWardrobePayload } from "./capsuleEvents.js";
import type {
  CountByKey,
  LogContextLike,
  UserProfileLike,
  WardrobeGenerationResult,
  WardrobeUiItemLike
} from "./types.js";
import { LAST_PROMPT_DIR_URL, buildRegenerateSelectedPrompt, buildRegenerateSelectedSystemPrompt, buildRegeneratedItemsFormat, getSqlRows, saveLastPromptArtifacts } from "./regenerateSelectedPrompt.js";
import { queryRegenerationCandidateItems } from "./regenerateSelectedSql.js";
import { logInfo, logWarn } from "../logger.js";

const AUDIENCE_FILTERS_BY_PROFILE = {
  man: ["man", "all"],
  woman: ["woman", "all"],
  any: ["man", "woman", "all"]
};

function getProductUrls(items) {
  return Array.isArray(items)
    ? items.map((item) => String(item?.url || "").trim()).filter(Boolean)
    : [];
}

function countSelectedCategories(selectedProducts: WardrobeUiItemLike[]): CountByKey {
  return selectedProducts.reduce<CountByKey>((result, item) => {
    const category = String(item?.category || "").trim();
    if (category) {
      result[category] = (result[category] || 0) + 1;
    }
    return result;
  }, {});
}

function buildSelectedCapsuleCategories(userProfile, selectedProducts: WardrobeUiItemLike[]) {
  const selectedCategoryCounts = countSelectedCategories(selectedProducts);
  const capsuleCategories: CountByKey = {};
  for (const category of Object.keys(getCapsuleCategories(userProfile))) {
    if (selectedCategoryCounts[category] > 0) {
      capsuleCategories[category] = selectedCategoryCounts[category];
    }
  }
  for (const [category, count] of Object.entries(selectedCategoryCounts)) {
    if (!Object.prototype.hasOwnProperty.call(capsuleCategories, category)) {
      capsuleCategories[category] = count;
    }
  }
  return capsuleCategories;
}

function getProfileList(value) {
  return Array.isArray(value) ? value : [];
}

function getRegenerationPattern(userProfile) {
  return typeof userProfile?.pattern === "string" && userProfile.pattern.trim().length > 0
    ? userProfile.pattern.trim().toLowerCase()
    : "solid";
}

function getRejectedUrls(userProfile) {
  return Array.isArray(userProfile?.rejected)
    ? userProfile.rejected.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];
}

function getAudienceFilters(userProfile) {
  return AUDIENCE_FILTERS_BY_PROFILE[userProfile?.audience] || AUDIENCE_FILTERS_BY_PROFILE.any;
}

async function buildRegenerationInputs(userProfile, products) {
  const prompt = getWardrobePrompt(userProfile);
  const promptEmbeddings = await getPromptEmbeddings(prompt);
  const storedWardrobe = getStoredWardrobePayload(userProfile);
  const selectedProducts = Array.isArray(products) ? products : [];
  const selectedProductUrls = getProductUrls(selectedProducts);
  const selectedProductUrlSet = new Set(selectedProductUrls);
  const currentCapsuleItems = Array.isArray(storedWardrobe?.items)
    ? storedWardrobe.items.filter((item) => !selectedProductUrlSet.has(String(item?.url || "").trim()))
    : [];
  const currentCapsulePromptItems = await getProductsByUrlsInOrder(getProductUrls(currentCapsuleItems));
  const capsuleCategories = buildSelectedCapsuleCategories(userProfile, selectedProducts);
  const categories = Object.keys(capsuleCategories);

  if (categories.length === 0) {
    throw new Error("No selected product categories for regeneration");
  }

  return {
    capsuleCategories,
    currentCapsuleItems,
    currentCapsulePromptItems,
    promptEmbeddings,
    selectedProductUrls,
    storedWardrobeProductUrls: getProductUrls(storedWardrobe?.items)
  };
}

async function buildRegenerationSqlParams(userProfile, inputs) {
  const rejectedUrls = getRejectedUrls(userProfile);
  const negativePromptingUrls = [...new Set([...rejectedUrls, ...inputs.selectedProductUrls])];
  const rejectedProducts = await getProductsWithEmbeddingsByUrlsInOrder(negativePromptingUrls);
  const rejectedVectors = rejectedProducts
    .map((product) => normalizeEmbeddingVector(product?.embedding))
    .filter(Boolean);
  const shiftedPromptEmbeddings = buildShiftedTargetVector(inputs.promptEmbeddings, rejectedVectors, 0.3);

  return {
    audienceFilters: getAudienceFilters(userProfile),
    categories: Object.keys(inputs.capsuleCategories),
    color: userProfile?.color ?? null,
    embeddingVector: `[${shiftedPromptEmbeddings.join(",")}]`,
    excludedUrls: [...new Set([...inputs.storedWardrobeProductUrls, ...rejectedUrls])],
    formalityLevel: userProfile?.formalityLevel ?? null,
    noiseFactor: 0.05,
    occasions: getProfileList(userProfile?.occasions),
    pattern: getRegenerationPattern(userProfile),
    season: getProfileList(userProfile?.season),
    style: userProfile?.style ?? null
  };
}

async function getRegenerationCandidates(sql, sqlParams, logContext) {
  const sqlStartedAt = Date.now();
  const itemsResult = await queryRegenerationCandidateItems(sql, sqlParams);
  const normalizedItems = getSqlRows(itemsResult).map((item) => {
    const normalized = { ...item };
    delete normalized.embedding;
    return normalized;
  });
  logWardrobeInfo("capsule-sql-completed", {
    sqlDurationMs: Date.now() - sqlStartedAt,
    sqlItemsTotal: normalizedItems.length,
    sqlItemsByCategory: countItemsByKey(normalizedItems)
  }, logContext);
  return normalizedItems;
}

function buildNoLlmRegenerationResult({ normalizedItems, capsuleCategories, userProfile, currentCapsuleItems, promptEmbeddings, llmResolution, logContext }) {
  logWardrobeInfo("capsule-llm-skipped", {
    reason: "profile_llm_none",
    requestedLlm: llmResolution.requestedLlm,
    usedModel: null
  }, logContext);
  const balancedItems = enforceCategoryCounts([], normalizedItems, capsuleCategories, userProfile);
  if (balancedItems.length === 0) {
    throw new Error("SQL returned no valid regenerated items");
  }
  logWardrobeInfo("capsule-nollm-completed", {
    selectedItemsTotal: balancedItems.length,
    selectedItemsByCategory: countItemsByKey(balancedItems)
  }, logContext);
  return {
    items: [...currentCapsuleItems, ...balancedItems.map(toWardrobeUiItem)],
    selectedItems: balancedItems,
    outfitSets: [],
    promptEmbeddings,
    shortCapsuleName: null,
    rawSelectionText: null
  };
}

async function buildRegenerationPromptImages({ normalizedItems, currentCapsuleItems, logContext }) {
  const shouldSavePromptDebugArtifacts = process.env.NODE_ENV === "development";
  const promptDebugImages = await buildRegenerationCandidateImages(normalizedItems, shouldSavePromptDebugArtifacts, logContext);
  const currentCapsuleCollage = await buildCurrentCapsuleCollage(currentCapsuleItems, logContext);
  return { currentCapsuleCollage, promptDebugImages };
}

async function buildRegenerationCandidateImages(normalizedItems, shouldSavePromptDebugArtifacts, logContext) {
  try {
    const imageFetchStartedAt = Date.now();
    const promptDebugImages = await runWithImageWorkSlot("capsule-images", async () => buildPromptDebugImagesInChild({
      normalizedItems,
      saveDebugArtifacts: shouldSavePromptDebugArtifacts,
      debugOutputDir: shouldSavePromptDebugArtifacts ? LAST_PROMPT_DIR_URL : null
    }));
    logWardrobeInfo("capsule-images-ready", {
      imageFetchDurationMs: Date.now() - imageFetchStartedAt,
      requestedCount: normalizedItems.length,
      cachedCount: promptDebugImages.cachedCount || 0,
      downloadedCount: promptDebugImages.downloadedCount || 0,
      skippedCount: promptDebugImages.skippedCount || 0
    }, logContext);
    return promptDebugImages;
  } catch (error) {
    logPromptImageBuildFailure(error, logContext);
    return { categories: [], stitched: null };
  }
}

function logPromptImageBuildFailure(error, logContext) {
  if (String(error?.message || "").startsWith("prompt_images_child_exit:")) {
    logWardrobeInfo("capsule-images-child-exit", { message: error.message }, logContext);
  }
  logWarn("[prompt-images][build-failed]", JSON.stringify({ message: error?.message || "unknown_error" }));
}

async function buildCurrentCapsuleCollage(currentCapsuleItems, logContext) {
  if (currentCapsuleItems.length === 0) {
    return null;
  }

  try {
    const currentCapsuleImageStartedAt = Date.now();
    const currentCapsuleImage = await runWithImageWorkSlot("capsule-images", async () => (
      buildPromptDebugImagesForCategory({ category: "Current Capsule", items: currentCapsuleItems })
    ));
    const currentCapsuleCollage = currentCapsuleImage?.category || null;
    logWardrobeInfo(
      "current-capsule-collage-ready",
      buildCurrentCapsuleCollageLogPayload(currentCapsuleCollage, currentCapsuleItems, currentCapsuleImageStartedAt),
      logContext
    );
    return currentCapsuleCollage;
  } catch (error) {
    logWarn("[prompt-images][current-capsule-build-failed]", JSON.stringify({ message: error?.message || "unknown_error" }));
    return null;
  }
}

function buildCurrentCapsuleCollageLogPayload(currentCapsuleCollage, currentCapsuleItems, currentCapsuleImageStartedAt) {
  return {
    imageFetchDurationMs: Date.now() - currentCapsuleImageStartedAt,
    currentCapsuleItemsTotal: currentCapsuleItems.length,
    cachedCount: currentCapsuleCollage?.cachedCount || 0,
    downloadedCount: currentCapsuleCollage?.downloadedCount || 0,
    skippedCount: currentCapsuleCollage?.skippedCount || 0
  };
}

function getStylistImages(currentCapsuleCollage, promptDebugImages) {
  const generatedImages = promptDebugImages.stitched ? [promptDebugImages.stitched] : promptDebugImages.categories;
  return currentCapsuleCollage ? [currentCapsuleCollage, ...generatedImages] : generatedImages;
}

async function generateRegenerationSelection({ userProfile, normalizedItems, currentCapsulePromptItems, capsuleCategories, promptDebugImages, currentCapsuleCollage, llmResolution, logContext }) {
  const selectionPrompt = buildRegenerateSelectedPrompt(userProfile, normalizedItems, currentCapsulePromptItems, capsuleCategories);
  const selectionSystemPrompt = buildRegenerateSelectedSystemPrompt(userProfile, capsuleCategories);
  saveLastPromptArtifacts({ prompt: selectionPrompt, currentCapsuleCollage, userProfile, systemPrompt: selectionSystemPrompt });
  const llmStartedAt = Date.now();
  const generateJsonWithLlm = getGenerateJsonWithLlm(userProfile);
  const { response: selectionResponse, json: parsedSelection } = await generateJsonWithLlm(selectionPrompt, {
    userProfile,
    format: buildRegeneratedItemsFormat(capsuleCategories),
    images: getStylistImages(currentCapsuleCollage, promptDebugImages),
    systemPrompt: selectionSystemPrompt,
    onPayloadBuilt: () => {
      promptDebugImages.categories = [];
      promptDebugImages.stitched = null;
    }
  });
  promptDebugImages.categories = [];
  promptDebugImages.stitched = null;
  logWardrobeInfo("capsule-llm-completed", {
    llmProvider: llmResolution.provider,
    llmModel: llmResolution.model,
    requestedLlm: llmResolution.requestedLlm,
    fallbackReason: llmResolution.fallbackReason,
    llmDurationMs: Date.now() - llmStartedAt,
    ...extractLlmUsage(selectionResponse?.usage)
  }, logContext);
  return { parsedSelection, selectionResponse };
}

function getRawSelectionText(selectionResponse) {
  return typeof selectionResponse?.output_text === "string" && selectionResponse.output_text.trim().length > 0
    ? selectionResponse.output_text.trim()
    : null;
}

function logEmptyRegenerationSelection(parsedSelection, selectionResponse) {
  if (parsedSelection?.regenerated_items && typeof parsedSelection.regenerated_items === "object") {
    return;
  }

  logWarn(
    "[wardrobe-ai][selected-json-empty]",
    JSON.stringify(buildEmptySelectionLogPayload(selectionResponse))
  );
}

function buildEmptySelectionLogPayload(selectionResponse) {
  return {
    outputText: getRawSelectionText(selectionResponse),
    output: selectionResponse?.output ?? null,
    outputParsed: selectionResponse?.output_parsed ?? null,
    finishReason: selectionResponse?.status ?? null,
    incompleteDetails: selectionResponse?.incomplete_details ?? null,
    usage: selectionResponse?.usage ?? null
  };
}

function buildRegenerationResult({ parsedSelection, selectionResponse, normalizedItems, capsuleCategories, userProfile, currentCapsuleItems, promptEmbeddings }) {
  const selectedIds = getSelectedIdsFromCapsule(parsedSelection?.regenerated_items);
  const uniqueSelectedIds = [...new Set(selectedIds.map((id) => String(id)))];
  const itemsById = new Map(normalizedItems.map((item) => [String(item.id), item]));
  const selectedItems = uniqueSelectedIds
    .map((id) => itemsById.get(String(id)))
    .filter(Boolean);
  const balancedItems = enforceCategoryCounts(selectedItems, normalizedItems, capsuleCategories, userProfile);
  if (balancedItems.length === 0) {
    throw new Error("Model returned no valid selected_ids");
  }
  const nextWardrobeItems = [...currentCapsuleItems, ...balancedItems.map(toWardrobeUiItem)];

  return {
    items: nextWardrobeItems,
    selectedItems: balancedItems,
    outfitSets: buildOutfitSetsFromFormulas(getOutfitFormulas(parsedSelection), nextWardrobeItems),
    promptEmbeddings,
    shortCapsuleName: null,
    rawSelectionText: getRawSelectionText(selectionResponse)
  };
}

export async function regenerateCapsuleWardrobe(
  userProfile: UserProfileLike | null = null,
  products: WardrobeUiItemLike[] | null = null,
  logContext: LogContextLike | null = null
): Promise<WardrobeGenerationResult> {
  const llmResolution = resolveLlmProvider(userProfile);
  const sql = getSqlClient();
  const inputs = await buildRegenerationInputs(userProfile, products);
  const sqlParams = await buildRegenerationSqlParams(userProfile, inputs);
  const normalizedItems = await getRegenerationCandidates(sql, sqlParams, logContext);
  if (isNoLlmProfileEnabled(userProfile)) {
    return buildNoLlmRegenerationResult({ normalizedItems, llmResolution, logContext, userProfile, ...inputs });
  }
  const { currentCapsuleCollage, promptDebugImages } = await buildRegenerationPromptImages({
    currentCapsuleItems: inputs.currentCapsuleItems,
    normalizedItems,
    logContext
  });
  const { parsedSelection, selectionResponse } = await generateRegenerationSelection({
    userProfile,
    normalizedItems,
    currentCapsulePromptItems: inputs.currentCapsulePromptItems,
    capsuleCategories: inputs.capsuleCategories,
    promptDebugImages,
    currentCapsuleCollage,
    llmResolution,
    logContext
  });
  logInfo("[wardrobe-ai][selected-json]", JSON.stringify(parsedSelection));
  logEmptyRegenerationSelection(parsedSelection, selectionResponse);
  return buildRegenerationResult({ parsedSelection, selectionResponse, normalizedItems, userProfile, ...inputs });
}
