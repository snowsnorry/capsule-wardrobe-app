import { getCapsuleCategories } from "./categories.js";
import type { LogContextLike, UserProfileLike } from "./types.js";
import { createCapsuleGenerationDeps } from "./aiGenerationDeps.js";
import type { CapsuleGenerationDeps } from "./aiGenerationDeps.js";
import {
  getNormalizedWardrobeItems,
  getValidatedAnchorContext,
} from "./aiGenerationInputs.js";
import { getPromptDebugImages } from "./aiGenerationImages.js";
import {
  generateSelection,
  logEmptySelectionResponse,
} from "./aiGenerationSelection.js";
import {
  buildCapsuleGenerationResult,
  buildNoLlmCapsuleResult,
} from "./aiGenerationResults.js";
import {
  expandCategoriesForAnchors,
  splitAnchorSelectionRows,
} from "./anchorGeneration.js";
import { logInfo } from "../logger.js";

export function createGenerateCapsuleWardrobe(
  deps: CapsuleGenerationDeps = {},
) {
  const resolvedDeps = createCapsuleGenerationDeps(deps);

  return async function generateCapsuleWardrobe(
    userProfile: UserProfileLike | null = null,
    logContext: LogContextLike | null = null,
  ) {
    const llmResolution = resolvedDeps.resolveLlmProviderImpl(userProfile);
    const prompt = resolvedDeps.getWardrobePromptImpl(userProfile);
    const promptEmbeddings = await resolvedDeps.getPromptEmbeddingsImpl(prompt);
    const baseCapsuleCategories = getCapsuleCategories(userProfile);
    const anchorContext = await getValidatedAnchorContext(
      userProfile,
      resolvedDeps,
    );
    const capsuleCategories = expandCategoriesForAnchors(
      baseCapsuleCategories,
      anchorContext.anchorItems,
    );
    const normalizedItems = await getNormalizedWardrobeItems(
      {
        ...userProfile,
        anchorWardrobeNumericIds: anchorContext.anchorWardrobeNumericIds,
        anchorCatalogUrls: anchorContext.anchorCatalogUrls,
        anchorItemRefs: anchorContext.anchorItemRefs,
      },
      promptEmbeddings,
      capsuleCategories,
      logContext,
      resolvedDeps,
    );
    const { anchorItems, candidateItems } =
      splitAnchorSelectionRows(normalizedItems);
    const promptUserProfile = { ...userProfile, anchorItems };
    const noLlm = resolvedDeps.isNoLlmProfileEnabledImpl(userProfile);

    if (noLlm) {
      return buildNoLlmCapsuleResult({
        normalizedItems,
        capsuleCategories,
        userProfile: promptUserProfile,
        promptEmbeddings,
        llmResolution,
        logContext,
      });
    }

    const promptDebugImages = await getPromptDebugImages(
      normalizedItems,
      logContext,
      resolvedDeps,
    );
    const { selectionResponse, parsedSelection, selectedIds } =
      await generateSelection({
        userProfile: promptUserProfile,
        normalizedItems,
        capsuleCategories,
        anchorItems,
        candidateItems,
        promptDebugImages,
        llmResolution,
        logContext,
        deps: resolvedDeps,
      });
    logInfo("[wardrobe-ai][selected-json]", parsedSelection);
    logEmptySelectionResponse(parsedSelection, selectionResponse);

    return buildCapsuleGenerationResult({
      parsedSelection,
      selectionResponse,
      selectedIds,
      normalizedItems,
      capsuleCategories,
      promptEmbeddings,
      userProfile: promptUserProfile,
    });
  };
}

export const generateCapsuleWardrobe = createGenerateCapsuleWardrobe();
