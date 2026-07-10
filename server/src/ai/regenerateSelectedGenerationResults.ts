import {
  buildOutfitSetsFromFormulas,
  getOutfitFormulas,
} from "./outfitSets.js";
import {
  countItemsByKey,
  enforceCategoryCounts,
  extractLlmUsage,
  getSelectedIdsFromCapsule,
  logWardrobeInfo,
  toWardrobeUiItem,
} from "./ai.js";
import {
  buildRegenerateSelectedPrompt,
  buildRegenerateSelectedSystemPrompt,
  buildRegeneratedItemsFormat,
} from "./regenerateSelectedPrompt.js";
import { saveLastPromptArtifacts } from "./regenerateSelectedArtifacts.js";
import { logWarn } from "../logger.js";

export function buildNoLlmRegenerationResult({
  normalizedItems,
  capsuleCategories,
  userProfile,
  currentCapsuleItems,
  promptEmbeddings,
  llmResolution,
  logContext,
}) {
  logWardrobeInfo(
    "capsule-llm-skipped",
    {
      reason: "profile_llm_none",
      requestedLlm: llmResolution.requestedLlm,
      usedModel: null,
    },
    logContext,
  );
  const balancedItems = enforceCategoryCounts(
    [],
    normalizedItems,
    capsuleCategories,
    userProfile,
  );
  if (balancedItems.length === 0) {
    throw new Error("SQL returned no valid regenerated items");
  }
  logWardrobeInfo(
    "capsule-nollm-completed",
    {
      selectedItemsTotal: balancedItems.length,
      selectedItemsByCategory: countItemsByKey(balancedItems),
    },
    logContext,
  );
  return {
    items: [...currentCapsuleItems, ...balancedItems.map(toWardrobeUiItem)],
    selectedItems: balancedItems,
    outfitSets: [],
    promptEmbeddings,
    shortCapsuleName: null,
    rawSelectionText: null,
  };
}

function getStylistImages(currentCapsuleCollage, promptDebugImages) {
  const generatedImages = promptDebugImages.stitched
    ? [promptDebugImages.stitched]
    : promptDebugImages.categories;
  return currentCapsuleCollage
    ? [currentCapsuleCollage, ...generatedImages]
    : generatedImages;
}

export async function generateRegenerationSelection({
  userProfile,
  normalizedItems,
  currentCapsulePromptItems,
  capsuleCategories,
  promptDebugImages,
  currentCapsuleCollage,
  llmResolution,
  logContext,
  deps,
}) {
  const selectionPrompt = buildRegenerateSelectedPrompt(
    userProfile,
    normalizedItems,
    currentCapsulePromptItems,
    capsuleCategories,
  );
  const selectionSystemPrompt = buildRegenerateSelectedSystemPrompt(
    userProfile,
    capsuleCategories,
  );
  saveLastPromptArtifacts({
    prompt: selectionPrompt,
    currentCapsuleCollage,
    userProfile,
    systemPrompt: selectionSystemPrompt,
  });
  const llmStartedAt = Date.now();
  const generateJsonWithLlm = deps.getGenerateJsonWithLlmImpl(userProfile);
  const { response: selectionResponse, json: parsedSelection } =
    await generateJsonWithLlm(selectionPrompt, {
      userProfile,
      format: buildRegeneratedItemsFormat(capsuleCategories),
      images: getStylistImages(currentCapsuleCollage, promptDebugImages),
      systemPrompt: selectionSystemPrompt,
      onPayloadBuilt: () => {
        promptDebugImages.categories = [];
        promptDebugImages.stitched = null;
      },
    });
  promptDebugImages.categories = [];
  promptDebugImages.stitched = null;
  logWardrobeInfo(
    "capsule-llm-completed",
    {
      llmProvider: llmResolution.provider,
      llmModel: llmResolution.model,
      requestedLlm: llmResolution.requestedLlm,
      fallbackReason: llmResolution.fallbackReason,
      llmDurationMs: Date.now() - llmStartedAt,
      ...extractLlmUsage(selectionResponse?.usage),
    },
    logContext,
  );
  return { parsedSelection, selectionResponse };
}

function getRawSelectionText(selectionResponse) {
  return typeof selectionResponse?.output_text === "string" &&
    selectionResponse.output_text.trim().length > 0
    ? selectionResponse.output_text.trim()
    : null;
}

export function logEmptyRegenerationSelection(
  parsedSelection,
  selectionResponse,
) {
  if (
    parsedSelection?.regenerated_items &&
    typeof parsedSelection.regenerated_items === "object"
  ) {
    return;
  }

  logWarn(
    "ai.capsule.selection.empty",
    buildEmptySelectionLogPayload(selectionResponse),
  );
}

function buildEmptySelectionLogPayload(selectionResponse) {
  const outputText = getRawSelectionText(selectionResponse);
  return {
    finishReason: selectionResponse?.status ?? null,
    incomplete: Boolean(selectionResponse?.incomplete_details),
    outputTextLength: outputText?.length ?? 0,
    ...extractLlmUsage(selectionResponse?.usage),
  };
}

export function buildRegenerationResult({
  parsedSelection,
  selectionResponse,
  normalizedItems,
  capsuleCategories,
  userProfile,
  currentCapsuleItems,
  promptEmbeddings,
}) {
  const selectedIds = getSelectedIdsFromCapsule(
    parsedSelection?.regenerated_items,
  );
  const uniqueSelectedIds = [...new Set(selectedIds.map((id) => String(id)))];
  const itemsById = new Map(
    normalizedItems.map((item) => [String(item.id), item]),
  );
  const selectedItems = uniqueSelectedIds
    .map((id) => itemsById.get(String(id)))
    .filter(Boolean);
  const balancedItems = enforceCategoryCounts(
    selectedItems,
    normalizedItems,
    capsuleCategories,
    userProfile,
  );
  if (balancedItems.length === 0) {
    throw new Error("Model returned no valid selected_ids");
  }
  const nextWardrobeItems = [
    ...currentCapsuleItems,
    ...balancedItems.map(toWardrobeUiItem),
  ];

  return {
    items: nextWardrobeItems,
    selectedItems: balancedItems,
    outfitSets: buildOutfitSetsFromFormulas(
      getOutfitFormulas(parsedSelection),
      nextWardrobeItems,
    ),
    promptEmbeddings,
    shortCapsuleName: null,
    rawSelectionText: getRawSelectionText(selectionResponse),
  };
}
