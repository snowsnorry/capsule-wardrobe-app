import {
  buildOutfitSetsFromFormulas,
  getOutfitFormulas,
} from "./outfitSets.js";
import { countItemsByKey, logWardrobeInfo } from "./aiCommon.js";
import {
  enforceCategoryCounts,
  getShortCapsuleName,
} from "./aiCategoryEnforcement.js";
import { toWardrobeUiItem } from "./aiSelectionPrompt.js";
import { getRawSelectionText } from "./aiGenerationSelection.js";
import type { CountByKey, LogContextLike, UserProfileLike } from "./types.js";
import type {
  CapsuleSelectionJson,
  CapsuleSelectionResponse,
  LlmProviderResolutionLike,
} from "./aiGenerationTypes.js";

function buildNoLlmCapsuleResult({
  normalizedItems,
  capsuleCategories,
  userProfile,
  promptEmbeddings,
  llmResolution,
  logContext,
}: {
  normalizedItems: Array<Record<string, unknown>>;
  capsuleCategories: CountByKey;
  userProfile: UserProfileLike | null;
  promptEmbeddings: number[];
  llmResolution: LlmProviderResolutionLike;
  logContext: LogContextLike | null;
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
  const seedItems = Array.isArray(userProfile?.anchorItems)
    ? userProfile.anchorItems
    : [];
  const balancedItems = enforceCategoryCounts(
    seedItems,
    normalizedItems,
    capsuleCategories,
    userProfile,
  );

  if (balancedItems.length === 0) {
    throw new Error("SQL returned no valid wardrobe items");
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
    items: balancedItems.map(toWardrobeUiItem),
    selectedItems: balancedItems,
    outfitSets: [],
    promptEmbeddings,
    shortCapsuleName: null,
    rawSelectionText: null,
  };
}

function buildCapsuleGenerationResult({
  parsedSelection,
  selectionResponse,
  selectedIds,
  normalizedItems,
  capsuleCategories,
  userProfile,
  promptEmbeddings,
}: {
  parsedSelection: CapsuleSelectionJson | null | undefined;
  selectionResponse: CapsuleSelectionResponse | null | undefined;
  selectedIds: string[];
  normalizedItems: Array<Record<string, unknown>>;
  capsuleCategories: CountByKey;
  userProfile: UserProfileLike | null;
  promptEmbeddings: number[];
}) {
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

  return {
    items: balancedItems.map(toWardrobeUiItem),
    selectedItems: balancedItems,
    outfitSets: buildOutfitSetsFromFormulas(
      getOutfitFormulas(parsedSelection),
      balancedItems,
    ),
    promptEmbeddings,
    shortCapsuleName: getShortCapsuleName(
      parsedSelection?.system_evaluation?.short_capsule_name,
    ),
    rawSelectionText: getRawSelectionText(selectionResponse),
  };
}

export { buildCapsuleGenerationResult, buildNoLlmCapsuleResult };
