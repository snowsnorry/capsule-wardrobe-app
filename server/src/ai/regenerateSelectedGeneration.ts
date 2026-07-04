import { logInfo } from "../logger.js";
import { appendUniqueWardrobeItems } from "./aiSelectionPrompt.js";
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
import { getSwimwearType, shouldCompleteSelectedSwimwear } from "./swimwear.js";

const SWIMWEAR_CATEGORY = "swimwear";

function isSwimwearItem(item: WardrobeUiItemLike) {
  return (
    String(item?.category || "")
      .trim()
      .toLowerCase() === SWIMWEAR_CATEGORY
  );
}

function splitRegenerationProducts(products: WardrobeUiItemLike[] | null) {
  const selectedProducts = Array.isArray(products) ? products : [];
  return {
    swimwearProducts: selectedProducts.filter(isSwimwearItem),
    nonSwimwearProducts: selectedProducts.filter(
      (item) => !isSwimwearItem(item),
    ),
  };
}

function getProductUrls(items: WardrobeUiItemLike[]) {
  return items.map((item) => String(item?.url || "").trim()).filter(Boolean);
}

function withoutProductUrls(
  items: WardrobeUiItemLike[],
  productUrls: string[],
) {
  const productUrlSet = new Set(productUrls);
  return items.filter(
    (item) => !productUrlSet.has(String(item?.url || "").trim()),
  );
}

function getSwimwearReplacementForce(
  selectedSwimwearProducts: WardrobeUiItemLike[],
  currentCapsuleItems: WardrobeUiItemLike[],
) {
  const selectedTypes = new Set(
    selectedSwimwearProducts
      .map((item) => getSwimwearType(item))
      .filter(Boolean),
  );

  if (selectedTypes.has("swimsuit")) {
    return true;
  }

  if (
    selectedTypes.has("swimwear_top") &&
    selectedTypes.has("swimwear_bottom")
  ) {
    return true;
  }

  return !shouldCompleteSelectedSwimwear(currentCapsuleItems);
}

function buildSwimwearOverlayResult({
  baseItems,
  baseSelectedItems = [],
  promptEmbeddings,
  rawSelectionText = null,
  swimwear,
}: {
  baseItems: WardrobeGenerationResult["items"];
  baseSelectedItems?: WardrobeGenerationResult["selectedItems"];
  promptEmbeddings: number[];
  rawSelectionText?: string | null;
  swimwear: {
    items: WardrobeGenerationResult["items"];
    rawSelectionText?: string | null;
  };
}): WardrobeGenerationResult {
  return {
    items: appendUniqueWardrobeItems(baseItems, swimwear.items),
    selectedItems: [...baseSelectedItems, ...swimwear.items],
    outfitSets: [],
    promptEmbeddings,
    shortCapsuleName: null,
    rawSelectionText: swimwear.rawSelectionText || rawSelectionText,
  };
}

function createRegenerateNonSwimwearProducts(
  resolvedDeps: ReturnType<typeof createRegenerationDeps>,
) {
  return async function regenerateNonSwimwearProducts(
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
    logInfo("[wardrobe-ai][selected-json]", parsedSelection);
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

async function buildSwimwearRegenerationBase({
  baseResult,
  products,
  resolvedDeps,
  userProfile,
}: {
  baseResult?: WardrobeGenerationResult | null;
  products: WardrobeUiItemLike[];
  resolvedDeps: ReturnType<typeof createRegenerationDeps>;
  userProfile: UserProfileLike | null;
}) {
  const selectedSwimwearUrls = getProductUrls(products);

  if (baseResult) {
    return {
      baseItems: withoutProductUrls(baseResult.items, selectedSwimwearUrls),
      baseSelectedItems: baseResult.selectedItems,
      promptEmbeddings: baseResult.promptEmbeddings,
      rawSelectionText: baseResult.rawSelectionText,
    };
  }

  const inputs = await buildRegenerationInputs(
    userProfile,
    products,
    resolvedDeps,
  );
  return {
    baseItems: withoutProductUrls(
      inputs.currentCapsuleItems,
      selectedSwimwearUrls,
    ),
    baseSelectedItems: [],
    promptEmbeddings: inputs.promptEmbeddings,
    rawSelectionText: null,
  };
}

function createRegenerateSwimwearProducts(
  resolvedDeps: ReturnType<typeof createRegenerationDeps>,
) {
  return async function regenerateSwimwearProducts({
    baseResult = null,
    logContext,
    products,
    userProfile,
  }: {
    baseResult?: WardrobeGenerationResult | null;
    logContext: LogContextLike | null;
    products: WardrobeUiItemLike[];
    userProfile: UserProfileLike | null;
  }): Promise<WardrobeGenerationResult> {
    const base = await buildSwimwearRegenerationBase({
      baseResult,
      products,
      resolvedDeps,
      userProfile,
    });
    const swimwear = await resolvedDeps.generateSwimwearAdditionImpl({
      userProfile,
      selectedCapsuleItems: base.baseItems,
      promptEmbeddings: base.promptEmbeddings,
      force: getSwimwearReplacementForce(products, base.baseItems),
      logContext,
    });

    return buildSwimwearOverlayResult({
      baseItems: base.baseItems,
      baseSelectedItems: base.baseSelectedItems,
      promptEmbeddings: base.promptEmbeddings,
      rawSelectionText: base.rawSelectionText,
      swimwear,
    });
  };
}

export function createRegenerateCapsuleWardrobe(deps = {}) {
  const resolvedDeps = createRegenerationDeps(deps);
  const regenerateNonSwimwearProducts =
    createRegenerateNonSwimwearProducts(resolvedDeps);
  const regenerateSwimwearProducts =
    createRegenerateSwimwearProducts(resolvedDeps);

  return async function regenerateCapsuleWardrobe(
    userProfile: UserProfileLike | null = null,
    products: WardrobeUiItemLike[] | null = null,
    logContext: LogContextLike | null = null,
  ): Promise<WardrobeGenerationResult> {
    const { swimwearProducts, nonSwimwearProducts } =
      splitRegenerationProducts(products);

    if (swimwearProducts.length === 0) {
      return regenerateNonSwimwearProducts(userProfile, products, logContext);
    }

    if (nonSwimwearProducts.length === 0) {
      return regenerateSwimwearProducts({
        userProfile,
        products: swimwearProducts,
        logContext,
      });
    }

    const baseResult = await regenerateNonSwimwearProducts(
      userProfile,
      nonSwimwearProducts,
      logContext,
    );
    return regenerateSwimwearProducts({
      userProfile,
      products: swimwearProducts,
      baseResult,
      logContext,
    });
  };
}

export const regenerateCapsuleWardrobe = createRegenerateCapsuleWardrobe();
