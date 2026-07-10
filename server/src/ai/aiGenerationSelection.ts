import { logWarn } from "../logger.js";
import { extractLlmUsage, saveLastPromptArtifacts } from "./aiCommon.js";
import { logWardrobeInfo } from "./aiCommon.js";
import { getSelectedIdsFromCapsule } from "./aiCategoryEnforcement.js";
import { getWardrobeSelectionPrompt } from "./aiSelectionPrompt.js";
import {
  buildAnchorRepairPrompt,
  validateAnchorSelectedIds,
} from "./anchorGeneration.js";
import type {
  CountByKey,
  LogContextLike,
  PromptDebugImageResult,
  UserProfileLike,
} from "./types.js";
import type { ResolvedCapsuleGenerationDeps } from "./aiGenerationDeps.js";
import type {
  CapsuleSelectionJson,
  CapsuleSelectionResponse,
  LlmProviderResolutionLike,
} from "./aiGenerationTypes.js";

async function generateSelection({
  userProfile,
  normalizedItems,
  capsuleCategories,
  anchorItems,
  candidateItems,
  promptDebugImages,
  llmResolution,
  logContext,
  deps,
}: {
  userProfile: UserProfileLike | null;
  normalizedItems: Array<Record<string, unknown>>;
  capsuleCategories: CountByKey;
  anchorItems: Array<Record<string, unknown>>;
  candidateItems: Array<Record<string, unknown>>;
  promptDebugImages: PromptDebugImageResult;
  llmResolution: LlmProviderResolutionLike;
  logContext: LogContextLike | null;
  deps: ResolvedCapsuleGenerationDeps;
}) {
  const selectionPrompt = getWardrobeSelectionPrompt(
    userProfile,
    normalizedItems,
    capsuleCategories,
  );
  saveLastPromptArtifacts(selectionPrompt, userProfile);
  const llmStartedAt = Date.now();
  const generateJsonWithLlm = deps.getGenerateJsonWithLlmImpl(userProfile);
  if (!generateJsonWithLlm) {
    throw new Error("llm_generator_unavailable");
  }
  const stylistImages = promptDebugImages.stitched
    ? [promptDebugImages.stitched]
    : promptDebugImages.categories;
  const { response: selectionResponse, json: parsedSelection } =
    await generateJsonWithLlm(selectionPrompt, {
      userProfile,
      images: stylistImages,
      onPayloadBuilt: () => clearPromptDebugImages(promptDebugImages),
    });
  clearPromptDebugImages(promptDebugImages);
  logSelectionCompletion(selectionResponse, llmResolution, llmStartedAt, {
    logContext,
  });

  const selectedIds = getSelectedIdsFromCapsule(parsedSelection?.capsule).map(
    (id) => String(id),
  );
  const validation = validateAnchorSelectedIds({
    selectedIds,
    anchorItems,
    candidateItems,
  });
  if (validation.ok) {
    return { parsedSelection, selectionResponse, selectedIds };
  }

  return repairSelection({
    anchorItems,
    candidateItems,
    generateJsonWithLlm,
    selectionPrompt,
    userProfile,
    missingAnchorIds: validation.missingAnchorIds,
  });
}

async function repairSelection({
  anchorItems,
  candidateItems,
  generateJsonWithLlm,
  selectionPrompt,
  userProfile,
  missingAnchorIds,
}: {
  anchorItems: Array<Record<string, unknown>>;
  candidateItems: Array<Record<string, unknown>>;
  generateJsonWithLlm: NonNullable<
    ReturnType<ResolvedCapsuleGenerationDeps["getGenerateJsonWithLlmImpl"]>
  >;
  selectionPrompt: string;
  userProfile: UserProfileLike | null;
  missingAnchorIds: string[];
}) {
  const retryPrompt = `${selectionPrompt}\n\n${buildAnchorRepairPrompt(
    missingAnchorIds,
  )}`;
  const { response: repairResponse, json: repairedSelection } =
    await generateJsonWithLlm(retryPrompt, {
      userProfile,
      images: [],
    });
  const repairedIds = getSelectedIdsFromCapsule(repairedSelection?.capsule).map(
    (id) => String(id),
  );
  const repairedValidation = validateAnchorSelectedIds({
    selectedIds: repairedIds,
    anchorItems,
    candidateItems,
  });
  if (!repairedValidation.ok) {
    const error = new Error("anchor_validation_failed");
    (error as { code?: string }).code = "anchor_validation_failed";
    throw error;
  }

  return {
    parsedSelection: repairedSelection,
    selectionResponse: repairResponse,
    selectedIds: repairedIds,
  };
}

function logSelectionCompletion(
  selectionResponse: CapsuleSelectionResponse | null | undefined,
  llmResolution: LlmProviderResolutionLike,
  llmStartedAt: number,
  { logContext }: { logContext: LogContextLike | null },
) {
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
}

function clearPromptDebugImages(promptDebugImages: PromptDebugImageResult) {
  promptDebugImages.categories = [];
  promptDebugImages.stitched = null;
}

function logEmptySelectionResponse(
  parsedSelection: CapsuleSelectionJson | null | undefined,
  selectionResponse: CapsuleSelectionResponse | null | undefined,
) {
  if (parsedSelection?.capsule && typeof parsedSelection.capsule === "object") {
    return;
  }

  logWarn(
    "ai.capsule.selection.empty",
    buildEmptySelectionLogPayload(selectionResponse),
  );
}

function buildEmptySelectionLogPayload(
  selectionResponse: CapsuleSelectionResponse | null | undefined,
) {
  const outputText = getRawSelectionText(selectionResponse);
  return {
    finishReason: selectionResponse?.status ?? null,
    incomplete: Boolean(selectionResponse?.incomplete_details),
    outputTextLength: outputText?.length ?? 0,
    ...extractLlmUsage(selectionResponse?.usage),
  };
}

function getRawSelectionText(
  selectionResponse: CapsuleSelectionResponse | null | undefined,
) {
  return typeof selectionResponse?.output_text === "string" &&
    selectionResponse.output_text.trim().length > 0
    ? selectionResponse.output_text.trim()
    : null;
}

export { generateSelection, getRawSelectionText, logEmptySelectionResponse };
