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

// eslint-disable-next-line complexity, @typescript-eslint/no-explicit-any
export function createRegenerationDeps(deps: Record<string, any> = {}) {
  return {
    buildPromptDebugImagesForCategoryImpl:
      deps.buildPromptDebugImagesForCategoryImpl ||
      buildPromptDebugImagesForCategory,
    buildPromptDebugImagesInChildImpl:
      deps.buildPromptDebugImagesInChildImpl || buildPromptDebugImagesInChild,
    getGenerateJsonWithLlmImpl:
      deps.getGenerateJsonWithLlmImpl || getGenerateJsonWithLlm,
    getProductsByUrlsInOrderImpl:
      deps.getProductsByUrlsInOrderImpl || getProductsByUrlsInOrder,
    getProductsWithEmbeddingsByUrlsInOrderImpl:
      deps.getProductsWithEmbeddingsByUrlsInOrderImpl ||
      getProductsWithEmbeddingsByUrlsInOrder,
    getPromptEmbeddingsImpl:
      deps.getPromptEmbeddingsImpl || getPromptEmbeddings,
    getSqlClientImpl: deps.getSqlClientImpl || getSqlClient,
    getWardrobePromptImpl: deps.getWardrobePromptImpl || getWardrobePrompt,
    isNoLlmProfileEnabledImpl:
      deps.isNoLlmProfileEnabledImpl || isNoLlmProfileEnabled,
    queryRegenerationCandidateItemsImpl:
      deps.queryRegenerationCandidateItemsImpl ||
      queryRegenerationCandidateItems,
    resolveLlmProviderImpl: deps.resolveLlmProviderImpl || resolveLlmProvider,
    runWithImageWorkSlotImpl:
      deps.runWithImageWorkSlotImpl || runWithImageWorkSlot,
  };
}
