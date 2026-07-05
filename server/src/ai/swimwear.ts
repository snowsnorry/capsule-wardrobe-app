import { buildCustomJsonObjectFormat, buildSwimwearSchema } from "./llm.js";
import {
  countItemsByKey,
  extractLlmUsage,
  logWardrobeInfo,
} from "./swimwearLogging.js";
import type { SwimwearCandidate, UserProfileLike } from "./types.js";
import {
  getItemColors,
  shouldGenerateSwimwear,
  toWardrobeUiItem,
} from "./swimwearUtils.js";
import {
  getSwimwearPrompt,
  getSwimwearSystemPrompt,
} from "./swimwearPrompt.js";
import { selectFemaleSwimwear, selectMaleSwimwear } from "./swimwearSql.js";
import {
  normalizeSwimwearSelection,
  selectSwimwearWithoutLlm,
} from "./swimwearSelection.js";
import {
  getSelectedSwimwearState,
  getSwimwearType,
  normalizeSwimwearType,
  shouldCompleteSelectedSwimwear,
} from "./swimwearState.js";
import { createSwimwearDeps } from "./swimwearDeps.js";
import type { SwimwearDepsOverrides } from "./swimwearDeps.js";
import { throwIfAborted } from "./abortSignal.js";

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

async function getFemaleSwimwearCandidates({
  deps,
  desiredType,
  logContext,
  promptEmbeddings,
  selectedCapsuleItems,
  userProfile,
}) {
  const embeddingVector = `[${promptEmbeddings.join(",")}]`;
  const bottomColors = desiredType
    ? getItemColors(selectedCapsuleItems, "swimwear")
    : getItemColors(selectedCapsuleItems, "bottom");
  const sqlCandidates = await selectFemaleSwimwear({
    sql: deps.getSqlClientImpl(),
    audience: userProfile?.audience || "woman",
    targetStyle: userProfile?.style ?? null,
    bottomColors,
    embeddingVector,
    sourceMode: getProfileSourceMode(userProfile),
    profileEmail: getProfileEmail(userProfile),
    logContext,
  });
  const normalizedDesiredType = normalizeSwimwearType(desiredType);
  const candidates = normalizedDesiredType
    ? sqlCandidates.filter(
        (item) => getSwimwearType(item) === normalizedDesiredType,
      )
    : sqlCandidates;

  return { candidates, normalizedDesiredType };
}

async function generateFemaleSwimwearWithLlm({
  candidates,
  deps,
  llmResolution,
  logContext,
  selectedCapsuleItems,
  signal,
  userProfile,
}) {
  throwIfAborted(signal);
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
    signal,
  });
  throwIfAborted(signal);
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

async function generateFemaleSwimwear({
  userProfile,
  selectedCapsuleItems,
  promptEmbeddings,
  desiredType = null,
  logContext = null,
  signal = null,
  deps = createSwimwearDeps(),
}: {
  userProfile: UserProfileLike | null;
  selectedCapsuleItems: SwimwearCandidate[];
  promptEmbeddings: number[];
  desiredType?: string | null;
  logContext?: { capsuleRequestId?: string | null } | null;
  signal?: AbortSignal | null;
  deps?: ReturnType<typeof createSwimwearDeps>;
}) {
  throwIfAborted(signal);
  const llmResolution = deps.resolveLlmProviderImpl(userProfile);
  const { candidates, normalizedDesiredType } =
    await getFemaleSwimwearCandidates({
      deps,
      desiredType,
      logContext,
      promptEmbeddings,
      selectedCapsuleItems,
      userProfile,
    });
  throwIfAborted(signal);

  if (candidates.length === 0) {
    return buildEmptySwimwearResult();
  }

  if (normalizedDesiredType) {
    return buildSwimwearResult([candidates[0]]);
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

  return generateFemaleSwimwearWithLlm({
    candidates,
    deps,
    llmResolution,
    logContext,
    selectedCapsuleItems,
    signal,
    userProfile,
  });
}

function shouldSkipSwimwearAddition({ force, swimwearState, userProfile }) {
  if (force) {
    return false;
  }

  if (swimwearState.isComplete) {
    return true;
  }

  return (
    !shouldGenerateSwimwear(userProfile) &&
    !swimwearState.missingType &&
    !swimwearState.hasAmbiguousType
  );
}

function shouldUseFemaleSwimwear(userProfile, swimwearState) {
  return userProfile?.audience === "woman" || swimwearState.missingType;
}

async function generateMaleSwimwear({
  logContext,
  promptEmbeddings,
  resolvedDeps,
  selectedCapsuleItems,
  signal,
  userProfile,
}) {
  throwIfAborted(signal);
  const items = await selectMaleSwimwear({
    sql: resolvedDeps.getSqlClientImpl(),
    targetStyle: userProfile?.style ?? null,
    topColors: getItemColors(selectedCapsuleItems, "top"),
    embeddingVector: `[${promptEmbeddings.join(",")}]`,
    sourceMode: getProfileSourceMode(userProfile),
    profileEmail: getProfileEmail(userProfile),
    logContext,
  });
  throwIfAborted(signal);
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
}

function createGenerateSwimwearAddition(deps: SwimwearDepsOverrides = {}) {
  const resolvedDeps = createSwimwearDeps(deps);

  return async function generateSwimwearAddition({
    userProfile,
    selectedCapsuleItems,
    promptEmbeddings,
    force = false,
    logContext = null,
    signal = null,
  }: {
    userProfile: UserProfileLike | null;
    selectedCapsuleItems: SwimwearCandidate[];
    promptEmbeddings: number[];
    force?: boolean;
    logContext?: { capsuleRequestId?: string | null } | null;
    signal?: AbortSignal | null;
  }) {
    throwIfAborted(signal);
    const swimwearState = getSelectedSwimwearState(selectedCapsuleItems);

    if (shouldSkipSwimwearAddition({ force, swimwearState, userProfile })) {
      return buildEmptySwimwearResult();
    }

    if (shouldUseFemaleSwimwear(userProfile, swimwearState)) {
      return generateFemaleSwimwear({
        userProfile,
        selectedCapsuleItems,
        promptEmbeddings,
        desiredType: swimwearState.missingType,
        logContext,
        signal,
        deps: resolvedDeps,
      });
    }

    return generateMaleSwimwear({
      logContext,
      promptEmbeddings,
      resolvedDeps,
      selectedCapsuleItems,
      signal,
      userProfile,
    });
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
  getSwimwearType,
  shouldCompleteSelectedSwimwear,
};
