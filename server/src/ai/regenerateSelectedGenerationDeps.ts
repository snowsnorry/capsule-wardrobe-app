import {
  getProductsByUrlsInOrder,
  getProductsWithEmbeddingsByUrlsInOrder,
  getSqlClient,
} from "../db.js";
import {
  getGenerateJsonWithLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider,
} from "./llm.js";
import {
  buildPromptDebugImagesForCategory,
  buildPromptDebugImagesInChild,
} from "./promptImages.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import { getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { queryRegenerationCandidateItems } from "./regenerateSelectedSql.js";
import { generateSwimwearAddition } from "./swimwear.js";

const DEFAULT_REGENERATION_DEPS = {
  buildPromptDebugImagesForCategoryImpl: buildPromptDebugImagesForCategory,
  buildPromptDebugImagesInChildImpl: buildPromptDebugImagesInChild,
  generateSwimwearAdditionImpl: generateSwimwearAddition,
  getGenerateJsonWithLlmImpl: getGenerateJsonWithLlm,
  getProductsByUrlsInOrderImpl: getProductsByUrlsInOrder,
  getProductsWithEmbeddingsByUrlsInOrderImpl:
    getProductsWithEmbeddingsByUrlsInOrder,
  getPromptEmbeddingsImpl: getPromptEmbeddings,
  getSqlClientImpl: getSqlClient,
  getWardrobePromptImpl: getWardrobePrompt,
  isNoLlmProfileEnabledImpl: isNoLlmProfileEnabled,
  queryRegenerationCandidateItemsImpl: queryRegenerationCandidateItems,
  resolveLlmProviderImpl: resolveLlmProvider,
  runWithImageWorkSlotImpl: runWithImageWorkSlot,
};

type RegenerationDeps = typeof DEFAULT_REGENERATION_DEPS;
type RegenerationDepsOverrides = {
  [Key in keyof RegenerationDeps]?: unknown;
};

function getDefinedRegenerationOverrides(deps: RegenerationDepsOverrides) {
  return Object.fromEntries(
    Object.entries(deps).filter(([, value]) => value !== undefined),
  ) as RegenerationDepsOverrides;
}

export function createRegenerationDeps(
  deps: RegenerationDepsOverrides = {},
): RegenerationDeps {
  return {
    ...DEFAULT_REGENERATION_DEPS,
    ...getDefinedRegenerationOverrides(deps),
  } as RegenerationDeps;
}
