/* eslint-disable complexity, max-lines, max-lines-per-function */
import {
  getProductsByUrlsForEmailInOrder,
  getSqlClient,
  listWardrobeItemsByIdsForEmail,
} from "../db.js";
import {
  getGenerateJsonWithLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider,
} from "./llm.js";
import { getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { getCapsuleCategories } from "./categories.js";
import { buildPromptDebugImagesInChild } from "./promptImages.js";
import {
  buildOutfitSetsFromFormulas,
  getOutfitFormulas,
} from "./outfitSets.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import {
  buildCapsuleWardrobeSqlParams,
  queryCapsuleWardrobeItemsForProfile,
} from "./aiSql.js";
import type {
  CountByKey,
  ImageAssetLike,
  LlmUsageLike,
  LogContextLike,
  PromptDebugImageResult,
  UserProfileLike,
} from "./types.js";
import {
  countItemsByKey,
  extractLlmUsage,
  getSqlRows,
  logWardrobeInfo,
  saveLastPromptArtifacts,
} from "./aiCommon.js";
import {
  enforceCategoryCounts,
  getSelectedIdsFromCapsule,
  getShortCapsuleName,
} from "./aiCategoryEnforcement.js";
import {
  getWardrobeSelectionPrompt,
  toWardrobeUiItem,
} from "./aiSelectionPrompt.js";
import {
  buildAnchorRepairPrompt,
  expandCategoriesForAnchors,
  splitAnchorSelectionRows,
  validateAnchorSelectedIds,
} from "./anchorGeneration.js";
import { validateCapsuleAnchorItems } from "../capsuleAnchors.js";
import { logInfo, logWarn } from "../logger.js";

type CapsuleSelectionResponse = {
  output_text?: string | null;
  output?: unknown;
  output_parsed?: unknown;
  status?: string | null;
  incomplete_details?: unknown;
  usage?: LlmUsageLike | null;
};

type CapsuleSelectionJson = {
  capsule?: unknown;
  outfit_formulas?: unknown;
  system_evaluation?: {
    short_capsule_name?: unknown;
  } | null;
};

type CapsuleGenerateJsonWithLlm = (
  prompt: string,
  options: {
    userProfile?: UserProfileLike | null;
    images?: ImageAssetLike[];
    onPayloadBuilt?: (() => void) | null;
  },
) => Promise<{
  response?: CapsuleSelectionResponse | null;
  json?: CapsuleSelectionJson | null;
}>;

type LlmProviderResolutionLike = {
  requestedLlm: string;
  provider?: string | null;
  model?: string | null;
  fallbackReason?: string | null;
};

type ValidatedCapsuleAnchorsLike = {
  anchorWardrobeNumericIds: number[];
  anchorCatalogUrls: string[];
  anchorItemRefs: NonNullable<UserProfileLike["anchorItemRefs"]>;
  anchorItems: Array<Record<string, unknown>>;
};

type CapsuleWardrobeSqlParamsLike = Record<string, unknown>;
type CapsuleWardrobeSqlResultLike =
  | Array<Record<string, unknown>>
  | { count: number };

type CapsuleGenerationDeps = {
  buildCapsuleWardrobeSqlParamsImpl?: (
    userProfile: UserProfileLike | null,
    promptEmbeddings: number[],
    capsuleCategories: CountByKey,
  ) => CapsuleWardrobeSqlParamsLike;
  buildPromptDebugImagesInChildImpl?: typeof buildPromptDebugImagesInChild;
  getGenerateJsonWithLlmImpl?: (
    userProfile: UserProfileLike | null,
  ) => CapsuleGenerateJsonWithLlm | null;
  getPromptEmbeddingsImpl?: (prompt: string) => Promise<number[]>;
  getWardrobePromptImpl?: (userProfile: UserProfileLike | null) => string;
  isNoLlmProfileEnabledImpl?: (userProfile: UserProfileLike | null) => boolean;
  queryCapsuleWardrobeItemsForProfileImpl?: (
    sql: unknown,
    params: CapsuleWardrobeSqlParamsLike,
  ) => Promise<CapsuleWardrobeSqlResultLike>;
  resolveLlmProviderImpl?: (
    userProfile: UserProfileLike | null,
  ) => LlmProviderResolutionLike;
  runWithImageWorkSlotImpl?: typeof runWithImageWorkSlot;
  getSqlClientImpl?: () => unknown;
  validateCapsuleAnchorItemsImpl?: (
    email: string,
    anchorItemRefs: UserProfileLike["anchorItemRefs"],
  ) => Promise<ValidatedCapsuleAnchorsLike>;
};

type ResolvedCapsuleGenerationDeps = Required<CapsuleGenerationDeps>;

function createCapsuleGenerationDeps(
  deps: CapsuleGenerationDeps = {},
): ResolvedCapsuleGenerationDeps {
  return {
    buildCapsuleWardrobeSqlParamsImpl:
      deps.buildCapsuleWardrobeSqlParamsImpl || buildCapsuleWardrobeSqlParams,
    buildPromptDebugImagesInChildImpl:
      deps.buildPromptDebugImagesInChildImpl || buildPromptDebugImagesInChild,
    getGenerateJsonWithLlmImpl:
      deps.getGenerateJsonWithLlmImpl || getGenerateJsonWithLlm,
    getPromptEmbeddingsImpl:
      deps.getPromptEmbeddingsImpl || getPromptEmbeddings,
    getWardrobePromptImpl: deps.getWardrobePromptImpl || getWardrobePrompt,
    isNoLlmProfileEnabledImpl:
      deps.isNoLlmProfileEnabledImpl || isNoLlmProfileEnabled,
    queryCapsuleWardrobeItemsForProfileImpl:
      deps.queryCapsuleWardrobeItemsForProfileImpl ||
      queryCapsuleWardrobeItemsForProfile,
    resolveLlmProviderImpl: deps.resolveLlmProviderImpl || resolveLlmProvider,
    runWithImageWorkSlotImpl:
      deps.runWithImageWorkSlotImpl || runWithImageWorkSlot,
    getSqlClientImpl: deps.getSqlClientImpl || getSqlClient,
    validateCapsuleAnchorItemsImpl:
      deps.validateCapsuleAnchorItemsImpl ||
      ((email, anchorItemRefs) =>
        validateCapsuleAnchorItems({
          email,
          anchorItemRefs,
          deps: {
            listWardrobeItemsByIdsImpl: listWardrobeItemsByIdsForEmail,
            getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
          },
        })),
  };
}

async function getNormalizedWardrobeItems(
  userProfile: UserProfileLike | null,
  promptEmbeddings: number[],
  capsuleCategories: CountByKey,
  logContext: LogContextLike | null,
  deps: ResolvedCapsuleGenerationDeps,
) {
  const sqlParams = deps.buildCapsuleWardrobeSqlParamsImpl(
    userProfile,
    promptEmbeddings,
    capsuleCategories,
  );
  const sqlStartedAt = Date.now();
  const itemsResult = await deps.queryCapsuleWardrobeItemsForProfileImpl(
    deps.getSqlClientImpl(),
    sqlParams,
  );
  const items = getSqlRows(itemsResult);
  const normalizedItems = items.map((item) => {
    const normalized = { ...(item as Record<string, unknown>) };
    delete normalized.embedding;
    return normalized;
  });

  logWardrobeInfo(
    "capsule-sql-completed",
    {
      sqlDurationMs: Date.now() - sqlStartedAt,
      sqlItemsTotal: normalizedItems.length,
      sqlItemsByCategory: countItemsByKey(normalizedItems),
    },
    logContext,
  );

  return normalizedItems;
}

async function getValidatedAnchorContext(
  userProfile: UserProfileLike | null,
  deps: ResolvedCapsuleGenerationDeps,
) {
  const anchorItemRefs = Array.isArray(userProfile?.anchorItemRefs)
    ? userProfile.anchorItemRefs
    : [];
  const email = typeof userProfile?.email === "string" ? userProfile.email : "";
  const anchors = await deps.validateCapsuleAnchorItemsImpl(
    email,
    anchorItemRefs,
  );
  return anchors;
}

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

async function getPromptDebugImages(
  normalizedItems: Array<Record<string, unknown>>,
  logContext: LogContextLike | null,
  deps: ResolvedCapsuleGenerationDeps,
): Promise<PromptDebugImageResult> {
  const shouldSavePromptDebugArtifacts = process.env.NODE_ENV === "development";

  try {
    const imageFetchStartedAt = Date.now();
    const promptDebugImages = await deps.runWithImageWorkSlotImpl(
      "capsule-images",
      async () =>
        deps.buildPromptDebugImagesInChildImpl({
          normalizedItems,
          saveDebugArtifacts: shouldSavePromptDebugArtifacts,
          debugOutputDir: shouldSavePromptDebugArtifacts
            ? new URL("../../../last-prompt/", import.meta.url)
            : null,
        }),
    );

    logWardrobeInfo(
      "capsule-images-ready",
      {
        imageFetchDurationMs: Date.now() - imageFetchStartedAt,
        requestedCount: normalizedItems.length,
        cachedCount: promptDebugImages.cachedCount || 0,
        downloadedCount: promptDebugImages.downloadedCount || 0,
        skippedCount: promptDebugImages.skippedCount || 0,
      },
      logContext,
    );

    return promptDebugImages;
  } catch (error) {
    if (String(error?.message || "").startsWith("prompt_images_child_exit:")) {
      logWardrobeInfo(
        "capsule-images-child-exit",
        {
          message: error.message,
        },
        logContext,
      );
    }
    logWarn(
      "[prompt-images][build-failed]",
      JSON.stringify({
        message: error?.message || "unknown_error",
      }),
    );
    return { categories: [], stitched: null };
  }
}

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

  const retryPrompt = `${selectionPrompt}\n\n${buildAnchorRepairPrompt(
    validation.missingAnchorIds,
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

function logEmptySelectionResponse(
  parsedSelection: CapsuleSelectionJson | null | undefined,
  selectionResponse: CapsuleSelectionResponse | null | undefined,
) {
  if (parsedSelection?.capsule && typeof parsedSelection.capsule === "object") {
    return;
  }

  logWarn(
    "[wardrobe-ai][selected-json-empty]",
    JSON.stringify(buildEmptySelectionLogPayload(selectionResponse)),
  );
}

function buildEmptySelectionLogPayload(
  selectionResponse: CapsuleSelectionResponse | null | undefined,
) {
  return {
    outputText: getRawSelectionText(selectionResponse),
    output: selectionResponse?.output ?? null,
    outputParsed: selectionResponse?.output_parsed ?? null,
    finishReason: selectionResponse?.status ?? null,
    incompleteDetails: selectionResponse?.incomplete_details ?? null,
    usage: selectionResponse?.usage ?? null,
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
    logInfo("[wardrobe-ai][selected-json]", JSON.stringify(parsedSelection));
    logEmptySelectionResponse(parsedSelection, selectionResponse);

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
      promptUserProfile,
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
  };
}

export const generateCapsuleWardrobe = createGenerateCapsuleWardrobe();
