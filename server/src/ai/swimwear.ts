import { getSqlClient } from "../db.js";
import {
  buildCustomJsonObjectFormat,
  buildSwimwearSchema,
  getGenerateJsonWithLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider,
} from "./llm.js";
import {
  countItemsByKey,
  extractLlmUsage,
  logWardrobeInfo,
} from "./swimwearLogging.js";
import type { SwimwearCandidate, UserProfileLike } from "./types.js";
import {
  dedupeStrings,
  getItemColors,
  shouldGenerateSwimwear,
  toWardrobeUiItem,
} from "./swimwearUtils.js";
import {
  getSwimwearPrompt,
  getSwimwearSystemPrompt,
} from "./swimwearPrompt.js";
import { selectFemaleSwimwear, selectMaleSwimwear } from "./swimwearSql.js";

function normalizeSelectedSwimwearIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeStrings(value.map((item) => String(item || "").trim()));
}

function normalizeSwimwearSelection(
  selectedIds: unknown,
  candidates: SwimwearCandidate[],
) {
  const candidateMap = new Map(
    candidates.map((item) => [String(item.id), item]),
  );
  const selected = normalizeSelectedSwimwearIds(selectedIds)
    .map((id) => candidateMap.get(id))
    .filter(Boolean);

  const swimsuit = selected.find((item) => item?.swimwear_type === "swimsuit");
  if (swimsuit) {
    return [swimsuit];
  }

  const top = selected.find((item) => item?.swimwear_type === "swimwear_top");
  const bottom = selected.find(
    (item) => item?.swimwear_type === "swimwear_bottom",
  );

  if (top && bottom) {
    return [top, bottom];
  }

  if (top) {
    const fallbackBottom = candidates.find(
      (item) =>
        item?.swimwear_type === "swimwear_bottom" &&
        String(item.id) !== String(top.id),
    );
    return fallbackBottom ? [top, fallbackBottom] : [];
  }

  if (bottom) {
    const fallbackTop = candidates.find(
      (item) =>
        item?.swimwear_type === "swimwear_top" &&
        String(item.id) !== String(bottom.id),
    );
    return fallbackTop ? [fallbackTop, bottom] : [];
  }

  return [];
}

function selectSwimwearWithoutLlm(candidates: SwimwearCandidate[]) {
  return normalizeSwimwearSelection(
    candidates.map((item) => String(item?.id || "").trim()).filter(Boolean),
    candidates,
  );
}

function hasSelectedSwimwear(items: SwimwearCandidate[]) {
  return items.some(
    (item) =>
      typeof item?.category === "string" &&
      item.category.trim().toLowerCase() === "swimwear",
  );
}

function getSingleViableFemaleSwimwearOption(
  candidates: SwimwearCandidate[],
): SwimwearCandidate[] | null {
  const swimsuits = candidates.filter(
    (item) => item?.swimwear_type === "swimsuit",
  );
  const tops = candidates.filter(
    (item) => item?.swimwear_type === "swimwear_top",
  );
  const bottoms = candidates.filter(
    (item) => item?.swimwear_type === "swimwear_bottom",
  );
  const viableOptions = swimsuits.length + tops.length * bottoms.length;

  if (viableOptions !== 1) {
    return null;
  }

  return swimsuits.length === 1 ? [swimsuits[0]] : [tops[0], bottoms[0]];
}

function buildEmptySwimwearResult() {
  return {
    items: [],
    reasoning: null,
    rawSelectionText: null,
  };
}

function getTrimmedText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function buildSwimwearResult(
  selectedItems: SwimwearCandidate[],
  reasoning = null,
  rawSelectionText = null,
) {
  return {
    items: selectedItems.map(toWardrobeUiItem),
    reasoning,
    rawSelectionText,
  };
}

function getProfileSourceMode(userProfile: UserProfileLike | null) {
  return userProfile?.sourceMode === "wardrobe_preferred" ||
    userProfile?.sourceMode === "wardrobe_only"
    ? userProfile.sourceMode
    : "catalog_only";
}

function getProfileEmail(userProfile: UserProfileLike | null) {
  return typeof userProfile?.email === "string" ? userProfile.email.trim() : "";
}

function selectFemaleSwimwearWithoutLlm(candidates, llmResolution, logContext) {
  logWardrobeInfo(
    "swimwear-llm-skipped",
    {
      reason: "profile_llm_none",
      requestedLlm: llmResolution.requestedLlm,
      usedModel: null,
    },
    logContext,
  );
  const selectedItems = selectSwimwearWithoutLlm(candidates);
  logWardrobeInfo(
    "swimwear-nollm-completed",
    {
      swimwearItemsTotal: selectedItems.length,
      swimwearItemsByCategory: countItemsByKey(selectedItems),
    },
    logContext,
  );

  return buildSwimwearResult(selectedItems);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSwimwearDeps(deps: Record<string, any> = {}) {
  return {
    getSqlClientImpl: deps.getSqlClientImpl || getSqlClient,
    getGenerateJsonWithLlmImpl:
      deps.getGenerateJsonWithLlmImpl || getGenerateJsonWithLlm,
    isNoLlmProfileEnabledImpl:
      deps.isNoLlmProfileEnabledImpl || isNoLlmProfileEnabled,
    resolveLlmProviderImpl: deps.resolveLlmProviderImpl || resolveLlmProvider,
  };
}

// eslint-disable-next-line complexity
async function generateFemaleSwimwear({
  userProfile,
  selectedCapsuleItems,
  promptEmbeddings,
  logContext = null,
  deps = createSwimwearDeps(),
}: {
  userProfile: UserProfileLike | null;
  selectedCapsuleItems: SwimwearCandidate[];
  promptEmbeddings: number[];
  logContext?: { capsuleRequestId?: string | null } | null;
  deps?: ReturnType<typeof createSwimwearDeps>;
}) {
  const llmResolution = deps.resolveLlmProviderImpl(userProfile);
  const sql = deps.getSqlClientImpl();
  const embeddingVector = `[${promptEmbeddings.join(",")}]`;
  const targetStyle = userProfile?.style ?? null;
  const bottomColors = getItemColors(selectedCapsuleItems, "bottom");
  const candidates = await selectFemaleSwimwear({
    sql,
    audience: userProfile?.audience || "woman",
    targetStyle,
    bottomColors,
    embeddingVector,
    sourceMode: getProfileSourceMode(userProfile),
    profileEmail: getProfileEmail(userProfile),
    logContext,
  });

  if (candidates.length === 0) {
    return buildEmptySwimwearResult();
  }

  const deterministicSelection =
    getSingleViableFemaleSwimwearOption(candidates);
  if (deterministicSelection) {
    return buildSwimwearResult(deterministicSelection);
  }

  if (deps.isNoLlmProfileEnabledImpl(userProfile)) {
    return selectFemaleSwimwearWithoutLlm(
      candidates,
      llmResolution,
      logContext,
    );
  }

  const prompt = getSwimwearPrompt(selectedCapsuleItems, candidates);
  const llmStartedAt = Date.now();
  const generateJsonWithLlm = deps.getGenerateJsonWithLlmImpl(userProfile);
  const { response, json } = await generateJsonWithLlm(prompt, {
    userProfile,
    format: buildCustomJsonObjectFormat(
      "capsule_swimwear_response",
      "Structured swimwear selection with a brief reasoning and one valid swimsuit or a matching two-piece set.",
      buildSwimwearSchema(),
    ),
    systemPrompt: getSwimwearSystemPrompt(),
  });
  logWardrobeInfo(
    "swimwear-llm-completed",
    {
      llmProvider: llmResolution.provider,
      llmModel: llmResolution.model,
      requestedLlm: llmResolution.requestedLlm,
      fallbackReason: llmResolution.fallbackReason,
      swimwearLlmDurationMs: Date.now() - llmStartedAt,
      ...extractLlmUsage(response?.usage),
    },
    logContext,
  );

  const selectedItems = normalizeSwimwearSelection(json?.swimwear, candidates);
  logWardrobeInfo(
    "swimwear-completed",
    {
      swimwearItemsTotal: selectedItems.length,
      swimwearItemsByCategory: countItemsByKey(selectedItems),
    },
    logContext,
  );

  return buildSwimwearResult(
    selectedItems,
    getTrimmedText(json?._reasoning),
    getTrimmedText(response?.output_text),
  );
}

function createGenerateSwimwearAddition(deps = {}) {
  const resolvedDeps = createSwimwearDeps(deps);

  return async function generateSwimwearAddition({
    userProfile,
    selectedCapsuleItems,
    promptEmbeddings,
    logContext = null,
  }: {
    userProfile: UserProfileLike | null;
    selectedCapsuleItems: SwimwearCandidate[];
    promptEmbeddings: number[];
    logContext?: { capsuleRequestId?: string | null } | null;
  }) {
    if (!shouldGenerateSwimwear(userProfile)) {
      return buildEmptySwimwearResult();
    }

    if (hasSelectedSwimwear(selectedCapsuleItems)) {
      return buildEmptySwimwearResult();
    }

    const sql = resolvedDeps.getSqlClientImpl();
    const embeddingVector = `[${promptEmbeddings.join(",")}]`;
    const targetStyle = userProfile?.style ?? null;

    if (userProfile?.audience === "woman") {
      return generateFemaleSwimwear({
        userProfile,
        selectedCapsuleItems,
        promptEmbeddings,
        logContext,
        deps: resolvedDeps,
      });
    }

    const topColors = getItemColors(selectedCapsuleItems, "top");
    const items = await selectMaleSwimwear({
      sql,
      targetStyle,
      topColors,
      embeddingVector,
      sourceMode: getProfileSourceMode(userProfile),
      profileEmail: getProfileEmail(userProfile),
      logContext,
    });
    const selectedItems = items.length > 0 ? [items[0]] : [];
    logWardrobeInfo(
      "swimwear-completed",
      {
        swimwearItemsTotal: selectedItems.length,
        swimwearItemsByCategory: countItemsByKey(selectedItems),
      },
      logContext,
    );

    return {
      items: selectedItems.map(toWardrobeUiItem),
      reasoning: null,
      rawSelectionText: null,
    };
  };
}

const generateSwimwearAddition = createGenerateSwimwearAddition();

export {
  createGenerateSwimwearAddition,
  generateSwimwearAddition,
  getSwimwearPrompt,
  getSwimwearSystemPrompt,
  shouldGenerateSwimwear,
  normalizeSwimwearSelection,
};
