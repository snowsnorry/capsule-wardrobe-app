import { logInfo } from "../logger.js";
import type {
  LogContextLike,
  UserProfileLike,
  WardrobeGenerationResult,
  WardrobeUiItemLike,
} from "./types.js";
import { createRegenerationDeps } from "./regenerateSelectedGenerationDeps.js";
import {
  buildRegenerationInputs,
  buildRegenerationSqlParams,
  getRegenerationCandidates,
} from "./regenerateSelectedGenerationInputs.js";
import { buildRegenerationPromptImages } from "./regenerateSelectedGenerationImages.js";
import {
  buildNoLlmRegenerationResult,
  buildRegenerationResult,
  generateRegenerationSelection,
  logEmptyRegenerationSelection,
} from "./regenerateSelectedGenerationResults.js";

export function createRegenerateCapsuleWardrobe(deps = {}) {
  const resolvedDeps = createRegenerationDeps(deps);

  return async function regenerateCapsuleWardrobe(
    userProfile: UserProfileLike | null = null,
    products: WardrobeUiItemLike[] | null = null,
    logContext: LogContextLike | null = null,
  ): Promise<WardrobeGenerationResult> {
    const llmResolution = resolvedDeps.resolveLlmProviderImpl(userProfile);
    const sql = resolvedDeps.getSqlClientImpl();
    const inputs = await buildRegenerationInputs(
      userProfile,
      products,
      resolvedDeps,
    );
    const sqlParams = await buildRegenerationSqlParams(
      userProfile,
      inputs,
      resolvedDeps,
    );
    const normalizedItems = await getRegenerationCandidates(
      sql,
      sqlParams,
      logContext,
      resolvedDeps,
    );
    if (resolvedDeps.isNoLlmProfileEnabledImpl(userProfile)) {
      return buildNoLlmRegenerationResult({
        normalizedItems,
        llmResolution,
        logContext,
        userProfile,
        ...inputs,
      });
    }
    const { currentCapsuleCollage, promptDebugImages } =
      await buildRegenerationPromptImages({
        currentCapsuleItems: inputs.currentCapsuleItems,
        normalizedItems,
        logContext,
        deps: resolvedDeps,
      });
    const { parsedSelection, selectionResponse } =
      await generateRegenerationSelection({
        userProfile,
        normalizedItems,
        currentCapsulePromptItems: inputs.currentCapsulePromptItems,
        capsuleCategories: inputs.capsuleCategories,
        promptDebugImages,
        currentCapsuleCollage,
        llmResolution,
        logContext,
        deps: resolvedDeps,
      });
    logInfo("[wardrobe-ai][selected-json]", JSON.stringify(parsedSelection));
    logEmptyRegenerationSelection(parsedSelection, selectionResponse);
    return buildRegenerationResult({
      parsedSelection,
      selectionResponse,
      normalizedItems,
      userProfile,
      ...inputs,
    });
  };
}

export const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe();
