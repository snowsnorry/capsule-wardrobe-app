import { getSqlClient } from "../db.js";
import { getGenerateJsonWithLlm, isNoLlmProfileEnabled, resolveLlmProvider } from "./llm.js";
import { getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { getCapsuleCategories } from "./categories.js";
import { buildPromptDebugImagesInChild } from "./promptImages.js";
import { buildOutfitSetsFromFormulas, getOutfitFormulas } from "./outfitSets.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import { buildCapsuleWardrobeSqlParams, queryCapsuleWardrobeItemsForProfile } from "./aiSql.js";
import type {
  PromptDebugImageResult
} from "./types.js";
import { countItemsByKey, extractLlmUsage, getSqlRows, logWardrobeInfo, saveLastPromptArtifacts } from "./aiCommon.js";
import { enforceCategoryCounts, getSelectedIdsFromCapsule, getShortCapsuleName } from "./aiCategoryEnforcement.js";
import { getWardrobeSelectionPrompt, toWardrobeUiItem } from "./aiSelectionPrompt.js";
import { logInfo, logWarn } from "../logger.js";

async function getNormalizedWardrobeItems(userProfile, promptEmbeddings, capsuleCategories, logContext) {
  const sqlParams = buildCapsuleWardrobeSqlParams(userProfile, promptEmbeddings, capsuleCategories);
  const sqlStartedAt = Date.now();
  const itemsResult = await queryCapsuleWardrobeItemsForProfile(getSqlClient(), sqlParams);
  const items = getSqlRows(itemsResult);
  const normalizedItems = items.map((item) => {
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

function buildNoLlmCapsuleResult({ normalizedItems, capsuleCategories, userProfile, promptEmbeddings, llmResolution, logContext }) {
  logWardrobeInfo("capsule-llm-skipped", {
    reason: "profile_llm_none",
    requestedLlm: llmResolution.requestedLlm,
    usedModel: null
  }, logContext);
  const balancedItems = enforceCategoryCounts([], normalizedItems, capsuleCategories, userProfile);

  if (balancedItems.length === 0) {
    throw new Error("SQL returned no valid wardrobe items");
  }

  logWardrobeInfo("capsule-nollm-completed", {
    selectedItemsTotal: balancedItems.length,
    selectedItemsByCategory: countItemsByKey(balancedItems)
  }, logContext);

  return {
    items: balancedItems.map(toWardrobeUiItem),
    selectedItems: balancedItems,
    outfitSets: [],
    promptEmbeddings,
    shortCapsuleName: null,
    rawSelectionText: null
  };
}

async function getPromptDebugImages(normalizedItems, logContext): Promise<PromptDebugImageResult> {
  const shouldSavePromptDebugArtifacts = process.env.NODE_ENV === "development";

  try {
    const imageFetchStartedAt = Date.now();
    const promptDebugImages = await runWithImageWorkSlot("capsule-images", async () => buildPromptDebugImagesInChild({
      normalizedItems,
      saveDebugArtifacts: shouldSavePromptDebugArtifacts,
      debugOutputDir: shouldSavePromptDebugArtifacts
        ? new URL("../../../last-prompt/", import.meta.url)
        : null
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
    if (String(error?.message || "").startsWith("prompt_images_child_exit:")) {
      logWardrobeInfo("capsule-images-child-exit", {
        message: error.message
      }, logContext);
    }
    logWarn(
      "[prompt-images][build-failed]",
      JSON.stringify({
        message: error?.message || "unknown_error"
      })
    );
    return { categories: [], stitched: null };
  }
}

async function generateSelection({ userProfile, normalizedItems, capsuleCategories, promptDebugImages, llmResolution, logContext }) {
  const selectionPrompt = getWardrobeSelectionPrompt(userProfile, normalizedItems, capsuleCategories);
  saveLastPromptArtifacts(selectionPrompt, userProfile);
  const llmStartedAt = Date.now();
  const generateJsonWithLlm = getGenerateJsonWithLlm(userProfile);
  const stylistImages = promptDebugImages.stitched
    ? [promptDebugImages.stitched]
    : promptDebugImages.categories;
  const { response: selectionResponse, json: parsedSelection } = await generateJsonWithLlm(selectionPrompt, {
    userProfile,
    images: stylistImages,
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

function logEmptySelectionResponse(parsedSelection, selectionResponse) {
  if (parsedSelection?.capsule && typeof parsedSelection.capsule === "object") {
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

function getRawSelectionText(selectionResponse) {
  return typeof selectionResponse?.output_text === "string" && selectionResponse.output_text.trim().length > 0
    ? selectionResponse.output_text.trim()
    : null;
}

export async function generateCapsuleWardrobe(userProfile = null, logContext = null) {
  const llmResolution = resolveLlmProvider(userProfile);
  const prompt = getWardrobePrompt(userProfile);
  const promptEmbeddings = await getPromptEmbeddings(prompt);
  const capsuleCategories = getCapsuleCategories(userProfile);
  const normalizedItems = await getNormalizedWardrobeItems(userProfile, promptEmbeddings, capsuleCategories, logContext);
  const noLlm = isNoLlmProfileEnabled(userProfile);

  if (noLlm) {
    return buildNoLlmCapsuleResult({ normalizedItems, capsuleCategories, userProfile, promptEmbeddings, llmResolution, logContext });
  }

  const promptDebugImages = await getPromptDebugImages(normalizedItems, logContext);
  const { selectionResponse, parsedSelection } = await generateSelection({
    userProfile,
    normalizedItems,
    capsuleCategories,
    promptDebugImages,
    llmResolution,
    logContext
  });
  logInfo("[wardrobe-ai][selected-json]", JSON.stringify(parsedSelection));
  logEmptySelectionResponse(parsedSelection, selectionResponse);

  const selectedIds = getSelectedIdsFromCapsule(parsedSelection?.capsule);
  const uniqueSelectedIds = [...new Set(selectedIds.map((id) => String(id)))];
  const itemsById = new Map(normalizedItems.map((item) => [String(item.id), item]));
  const selectedItems = uniqueSelectedIds
    .map((id) => itemsById.get(String(id)))
    .filter(Boolean);
  const balancedItems = enforceCategoryCounts(selectedItems, normalizedItems, capsuleCategories, userProfile);

  if (balancedItems.length === 0) {
    throw new Error("Model returned no valid selected_ids");
  }

  return {
    items: balancedItems.map(toWardrobeUiItem),
    selectedItems: balancedItems,
    outfitSets: buildOutfitSetsFromFormulas(getOutfitFormulas(parsedSelection), balancedItems),
    promptEmbeddings,
    shortCapsuleName: getShortCapsuleName(parsedSelection?.system_evaluation?.short_capsule_name),
    rawSelectionText: getRawSelectionText(selectionResponse)
  };
}
