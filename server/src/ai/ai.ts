import crypto from "node:crypto";
import { getProfile } from "../profileStore.js";
import { getSqlClient } from "../db.js";
import {
  buildCapsuleSnapshotWithRegeneration,
  buildProfileCapsuleContext,
  getCapsule,
  getEffectiveCapsuleSnapshot,
  getCapsuleSnapshotRegeneration,
  renameCapsule,
  updateCapsuleSnapshot
} from "../capsuleStore.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildSystemPrompt, getGenerateJsonWithLlm, isNoLlmProfileEnabled, resolveLlmProvider } from "./llm.js";
import {  getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { getCapsuleCategories } from "./categories.js";
import { generateSwimwearAddition, shouldGenerateSwimwear } from "./swimwear.js";
import { buildPromptDebugImagesInChild } from "./promptImages.js";
import { buildOutfitSetsFromFormulas, getOutfitFormulas } from "./outfitSets.js";
import {
  getProcessMemoryUsage,
  runWithImageWorkSlot
} from "./imagePipeline.js";
import { getPartialRegenerationJob } from "./regenerateSelected.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent
} from "./promptTemplates.js";
import {
  buildCapsuleEventSnapshot,
  capsuleEventHub,
  getStoredWardrobePayload
} from "./capsuleEvents.js";
import {
  buildCapsuleWardrobeSqlParams,
  queryCapsuleWardrobeItemsForProfile
} from "./aiSql.js";
import type {
  CountByKey,
  ErrorWithCode,
  GeneratedOutfitSetLike,
  LogContextLike,
  LlmUsageLike,
  LlmUsageSummary,
  PartialRegenerationJobState,
  PromptDebugImageResult,
  StoredWardrobePayloadLike,
  UserProfileLike,
  WardrobeGenerationResult,
  WardrobeJobState,
  WardrobeUiItemLike
} from "./types.js";

const CAPSULE_GENERATION_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_capsule_generation.yaml", import.meta.url)
);
const PROMPT_TEMPLATE = getPromptTemplateContent(CAPSULE_GENERATION_PROMPT_TEMPLATE, "user");
const COMPLETED_JOB_TTL_MS = 5 * 60 * 1000;
const LAST_PROMPT_DIR_URL = new URL("../../../last-prompt/", import.meta.url);
const wardrobeJobs = new Map<string, WardrobeJobState>();

type RequestedWardrobeParams = Partial<{
  forceRefresh: boolean;
  formalityLevel: string;
  style: string;
  occasions: string[];
  season: string[];
  audience: string;
  color: string;
  pattern: string;
  locale: string;
}>;

type WardrobeServiceDependencies = {
  getProfileImpl?: typeof getProfile;
  getCapsuleImpl?: typeof getCapsule;
  renameCapsuleImpl?: typeof renameCapsule;
  updateCapsuleSnapshotImpl?: typeof updateCapsuleSnapshot;
  generateCapsuleWardrobeImpl?: (userProfile?: UserProfileLike | null, logContext?: LogContextLike | null) => Promise<WardrobeGenerationResult>;
  shouldGenerateSwimwearImpl?: typeof shouldGenerateSwimwear;
  generateSwimwearAdditionImpl?: typeof generateSwimwearAddition;
  getPartialRegenerationJobImpl?: (email: string, capsuleId: string) => PartialRegenerationJobState | null;
  buildCapsuleEventSnapshotImpl?: typeof buildCapsuleEventSnapshot;
  publishSnapshotImpl?: (email: string, capsuleId: string, snapshot: unknown) => void;
  jobs?: Map<string, WardrobeJobState>;
  nowMsImpl?: () => number;
  setTimeoutImpl?: typeof setTimeout;
  randomUuidImpl?: () => string;
};

type StartWardrobeJobOptions = {
  allowAutoRename?: boolean;
  forceEmptyWardrobe?: boolean;
  rollbackSnapshot?: ReturnType<typeof getEffectiveCapsuleSnapshot> | null;
};

function getSqlRows<TRow>(result: TRow[] | { count: number }): TRow[] {
  return Array.isArray(result) ? result : [];
}

function formatLogValue(value) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatLogPayload(payload = {}) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${formatLogValue(value)}`)
    .join(", ");
}

function getShortRequestId(logContext = null) {
  const capsuleRequestId = String(logContext?.capsuleRequestId || "").trim();
  if (!capsuleRequestId) {
    return "";
  }

  return capsuleRequestId.split("-")[0] || capsuleRequestId.slice(0, 8);
}

function logWardrobeInfo(event, payload = {}, logContext = null) {
  const shortRequestId = getShortRequestId(logContext);
  const prefix = shortRequestId
    ? `[${shortRequestId}][wardrobe-ai][${event}]`
    : `[wardrobe-ai][${event}]`;
  const message = formatLogPayload(payload);

  if (message) {
    console.info(`${prefix} ${message}`);
    return;
  }

  console.info(prefix);
}

function logWardrobeMemory(event, payload = {}, logContext = null) {
  logWardrobeInfo(event, {
    ...payload,
    ...getProcessMemoryUsage()
  }, logContext);
}

function buildLastPromptArtifact(prompt, userProfile = null) {
  if (typeof prompt !== "string") {
    return "";
  }

  const systemPrompt = buildSystemPrompt(userProfile);
  return [
    systemPrompt ? `System:\n${systemPrompt}` : "",
    `User:\n${prompt}`
  ].filter(Boolean).join("\n\n");
}

function saveLastPromptArtifacts(prompt, userProfile = null) {
  if (process.env.NODE_ENV !== "development" || typeof prompt !== "string") {
    return;
  }

  mkdirSync(LAST_PROMPT_DIR_URL, { recursive: true });
  writeFileSync(
    new URL("last_prompt.txt", LAST_PROMPT_DIR_URL),
    buildLastPromptArtifact(prompt, userProfile),
    "utf8"
  );
}

function countItemsByKey(items: WardrobeUiItemLike[] = [], key = "category"): CountByKey {
  return items.reduce<CountByKey>((result, item) => {
    const value = String(item?.[key] || "").trim();
    if (!value) {
      return result;
    }

    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function getRequestedWardrobeParams(
  userProfile: UserProfileLike | null = null,
  { forceRefresh = false }: { forceRefresh?: boolean } = {}
): RequestedWardrobeParams {
  const params: RequestedWardrobeParams = {};

  if (forceRefresh) {
    params.forceRefresh = true;
  }

  if (typeof userProfile?.formalityLevel === "string" && userProfile.formalityLevel.trim().length > 0) {
    params.formalityLevel = userProfile.formalityLevel.trim();
  }

  if (typeof userProfile?.style === "string" && userProfile.style.trim().length > 0) {
    params.style = userProfile.style.trim();
  }

  if (Array.isArray(userProfile?.occasions) && userProfile.occasions.length > 0) {
    params.occasions = userProfile.occasions.filter((value) => typeof value === "string" && value.trim().length > 0);
  }

  if (Array.isArray(userProfile?.season) && userProfile.season.length > 0) {
    params.season = userProfile.season.filter((value) => typeof value === "string" && value.trim().length > 0);
  }

  if (typeof userProfile?.audience === "string" && userProfile.audience.trim().length > 0) {
    params.audience = userProfile.audience.trim();
  }

  if (typeof userProfile?.color === "string" && userProfile.color.trim().length > 0) {
    params.color = userProfile.color.trim();
  }

  if (typeof userProfile?.pattern === "string" && userProfile.pattern.trim().length > 0) {
    params.pattern = userProfile.pattern.trim();
  }

  if (typeof userProfile?.locale === "string" && userProfile.locale.trim().length > 0) {
    params.locale = userProfile.locale.trim();
  }

  return params;
}

function getRequiredCapsule<TCapsule>(capsuleId: string, capsule: TCapsule | null): TCapsule {
  if (!capsuleId) {
    const error = new Error("invalid_payload") as ErrorWithCode;
    error.code = "invalid_payload";
    throw error;
  }

  if (!capsule) {
    const error = new Error("not_found") as ErrorWithCode;
    error.code = "not_found";
    throw error;
  }

  return capsule;
}

function extractLlmUsage(usage: LlmUsageLike | null = null): LlmUsageSummary {
  if (!usage || typeof usage !== "object") {
    return {};
  }

  const result: LlmUsageSummary = {};

  if (Number.isFinite(usage.input_tokens)) {
    result.inputTokens = usage.input_tokens;
  }

  if (Number.isFinite(usage.output_tokens)) {
    result.outputTokens = usage.output_tokens;
  }

  if (Number.isFinite(usage.total_tokens)) {
    result.totalTokens = usage.total_tokens;
  }

  const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens;
  if (Number.isFinite(reasoningTokens)) {
    result.reasoningTokens = reasoningTokens;
  }

  return result;
}

function buildErrorLogContext(logContext: LogContextLike | null = null) {
  if (!logContext?.capsuleRequestId) {
    return null;
  }

  return {
    capsuleRequestId: logContext.capsuleRequestId
  };
}

function buildWardrobePayload({
  items,
  outfitSets = [],
  rawSelectionText = null,
  swimwearReasoning = null,
  swimwearRawSelectionText = null
}: {
  items: WardrobeUiItemLike[];
  outfitSets?: GeneratedOutfitSetLike[];
  rawSelectionText?: string | null;
  swimwearReasoning?: string | null;
  swimwearRawSelectionText?: string | null;
}): StoredWardrobePayloadLike {
  return {
    items,
    outfitSets: outfitSets as unknown as StoredWardrobePayloadLike["outfitSets"],
    rawSelectionText,
    swimwearReasoning,
    swimwearRawSelectionText
  };
}

function formatProfileValues(values: string[] | null | undefined) {
  if (!Array.isArray(values) || values.length === 0) {
    return "Not specified";
  }

  const formatted = values
    .filter((value) => typeof value === "string" && value.trim().length > 0);
  if (formatted.length === 0) {
    return "Not specified";
  }

  return formatted.join(", ");
}

function getCategoryListText(categories: CountByKey) {
  return Object.entries(categories)
    .filter(([, count]) => Number.isInteger(count) && count > 0)
    .map(([category, count]) => `${count} ${category}`)
    .join(", ");
}

function getCategorySchema(categories: CountByKey) {
  const schema = Object.entries(categories).reduce<Record<string, string[]>>((result, [category, count]) => {
    if (!Number.isInteger(count) || count <= 0) {
      return result;
    }

    result[category] = Array.from({ length: Number(count) }, (_, index) => `id${index + 1}`);
    return result;
  }, {});

  return JSON.stringify(schema, null, 4);
}

function getSelectedIdsFromCapsule(capsule) {
  if (!capsule || typeof capsule !== "object" || Array.isArray(capsule)) {
    return [];
  }

  return Object.values(capsule).flatMap((ids) => {
    if (!Array.isArray(ids)) {
      return [];
    }

    return ids
      .map((id) => String(id))
      .filter((id) => id.trim().length > 0);
  });
}

function getShortCapsuleName(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeCapsuleConstraintValue(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getNormalizedItemStyles(item) {
  if (!Array.isArray(item?.style)) {
    return [];
  }

  return item.style
    .filter((style) => typeof style === "string" && style.trim().length > 0)
    .map((style) => style.trim());
}

function getFirstNonMinimalisticStyle(item) {
  return getNormalizedItemStyles(item).find((style) => style !== "minimalistic") || null;
}

function isStyleMatched(item, targetStyle) {
  return Boolean(targetStyle) && getNormalizedItemStyles(item).includes(targetStyle);
}

function isStyleSafe(item, targetStyle) {
  if (!targetStyle) {
    return true;
  }

  const styles = getNormalizedItemStyles(item);
  const nonMinimalisticStyles = styles.filter((style) => style !== "minimalistic");
  if (nonMinimalisticStyles.length === 0) {
    return true;
  }

  return nonMinimalisticStyles.every((style) => style === targetStyle);
}

function isColorMatched(item, targetColor) {
  return Boolean(targetColor) && Array.isArray(item?.color_base) && item.color_base.includes(targetColor);
}

function isNeutralItem(item) {
  return item?.is_neutral === true;
}

function normalizePatternValue(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function isPatternMatched(item, targetPattern) {
  if (!targetPattern || targetPattern === "solid") {
    return false;
  }

  return normalizePatternValue(item?.pattern) === targetPattern;
}

function hasSolidOrNullPattern(item) {
  const normalizedPattern = normalizePatternValue(item?.pattern);
  return normalizedPattern === null || normalizedPattern === "solid";
}

function enforceCategoryCounts(selectedItems, normalizedItems, categories, capsuleParams = null) {
  const categoryOrder = Object.keys(categories);
  const allowedCategories = new Set(categoryOrder);
  const categoryIndexByName = new Map(categoryOrder.map((category, index) => [category, index]));
  let effectiveStyle = normalizeCapsuleConstraintValue(capsuleParams?.style);
  const effectiveColor = normalizeCapsuleConstraintValue(capsuleParams?.color);
  const effectivePattern = normalizePatternValue(capsuleParams?.pattern) || "solid";
  const hasExplicitStyle = Boolean(effectiveStyle);
  const seenPoolIds = new Set();
  const poolByCategory = new Map(categoryOrder.map((category) => [category, []]));

  for (const item of normalizedItems) {
    const itemId = String(item?.id);
    const category = item?.category;
    if (!itemId || seenPoolIds.has(itemId) || !allowedCategories.has(category)) {
      continue;
    }
    seenPoolIds.add(itemId);
    poolByCategory.get(category).push(item);
  }

  const selectedSeenIds = new Set();
  const selectedByCategory = new Map(categoryOrder.map((category) => [category, []]));

  for (const item of selectedItems) {
    const itemId = String(item?.id);
    const category = item?.category;
    if (!itemId || selectedSeenIds.has(itemId) || !allowedCategories.has(category)) {
      continue;
    }
    selectedSeenIds.add(itemId);
    selectedByCategory.get(category).push(item);
  }

  const result = [];
  const resultIds = new Set();
  let styleMatchCount = 0;
  let colorMatchCount = 0;
  let patternMatchCount = 0;
  const selectedCountByCategory = new Map(categoryOrder.map((category) => [category, 0]));
  const styleMatchCountByCategory = new Map(categoryOrder.map((category) => [category, 0]));
  const colorMatchCountByCategory = new Map(categoryOrder.map((category) => [category, 0]));

  function getStyleLimit() {
    return effectiveStyle ? 4 : Infinity;
  }

  function getColorLimit() {
    return effectiveColor ? 3 : Infinity;
  }

  function getPatternLimit() {
    return effectivePattern !== "solid" ? 1 : Infinity;
  }

  function addItem(item) {
    const itemId = String(item.id);
    if (resultIds.has(itemId)) {
      return false;
    }

    if (!hasExplicitStyle && !effectiveStyle) {
      effectiveStyle = getFirstNonMinimalisticStyle(item);
    }

    result.push(item);
    resultIds.add(itemId);
    selectedCountByCategory.set(item.category, (selectedCountByCategory.get(item.category) || 0) + 1);

    if (isStyleMatched(item, effectiveStyle)) {
      styleMatchCount += 1;
      styleMatchCountByCategory.set(item.category, (styleMatchCountByCategory.get(item.category) || 0) + 1);
    }

    if (isColorMatched(item, effectiveColor)) {
      colorMatchCount += 1;
      colorMatchCountByCategory.set(item.category, (colorMatchCountByCategory.get(item.category) || 0) + 1);
    }

    if (isPatternMatched(item, effectivePattern)) {
      patternMatchCount += 1;
    }

    return true;
  }

  for (const category of categoryOrder) {
    const requiredCount = categories[category];
    const current = selectedByCategory.get(category).slice(0, requiredCount);
    for (const item of current) {
      addItem(item);
    }
  }

  function canUseStyleSafeCandidate(candidate) {
    if (!isStyleSafe(candidate, effectiveStyle)) {
      return false;
    }

    return !isStyleMatched(candidate, effectiveStyle) || styleMatchCount < getStyleLimit();
  }

  function isNonStyleMatchCandidate(candidate) {
    return !isStyleMatched(candidate, effectiveStyle);
  }

  function canUseColorSafeCandidate(candidate) {
    if (!effectiveColor) {
      return isNeutralItem(candidate);
    }

    if (isColorMatched(candidate, effectiveColor)) {
      return colorMatchCount < getColorLimit();
    }

    return isNeutralItem(candidate);
  }

  function canUsePatternSafeCandidate(candidate) {
    if (effectivePattern === "solid") {
      return hasSolidOrNullPattern(candidate);
    }

    if (isPatternMatched(candidate, effectivePattern)) {
      return patternMatchCount < getPatternLimit();
    }

    return hasSolidOrNullPattern(candidate);
  }

  function hasRemainingSlots(category) {
    return (selectedCountByCategory.get(category) || 0) < (categories[category] || 0);
  }

  function hasFutureCategoryNeedingAccent(matchType, categoryIndex, currentCategory) {
    const matchCountByCategory = matchType === "style"
      ? styleMatchCountByCategory
      : colorMatchCountByCategory;
    const effectiveMatchTarget = matchType === "style" ? effectiveStyle : effectiveColor;
    if (!effectiveMatchTarget) {
      return false;
    }

    const matchesAccent = matchType === "style"
      ? (item) => isStyleMatched(item, effectiveStyle)
      : (item) => isColorMatched(item, effectiveColor);

    for (const [category, index] of categoryIndexByName.entries()) {
      if (index <= categoryIndex || category === currentCategory || !hasRemainingSlots(category)) {
        continue;
      }

      if ((matchCountByCategory.get(category) || 0) > 0) {
        continue;
      }

      const candidates = poolByCategory.get(category) || [];
      if (candidates.some((candidate) => (
        !resultIds.has(String(candidate?.id)) && matchesAccent(candidate)
      ))) {
        return true;
      }
    }

    return false;
  }

  function canUseStyleDistributedCandidate(candidate, category) {
    if (!isStyleMatched(candidate, effectiveStyle)) {
      return true;
    }

    if ((styleMatchCountByCategory.get(category) || 0) === 0) {
      return true;
    }

    const categoryIndex = categoryIndexByName.get(category) ?? -1;
    return !hasFutureCategoryNeedingAccent("style", categoryIndex, category);
  }

  function canUseColorDistributedCandidate(candidate, category) {
    if (!isColorMatched(candidate, effectiveColor)) {
      return true;
    }

    if ((colorMatchCountByCategory.get(category) || 0) === 0) {
      return true;
    }

    const categoryIndex = categoryIndexByName.get(category) ?? -1;
    return !hasFutureCategoryNeedingAccent("color", categoryIndex, category);
  }

  for (const category of categoryOrder) {
    const requiredCount = categories[category];
    const currentCount = selectedCountByCategory.get(category) || 0;
    const missing = requiredCount - currentCount;
    if (missing <= 0) {
      continue;
    }

    const candidates = poolByCategory.get(category);
    let added = 0;

    const candidateGroups = [
      (candidate) => (
        canUseStyleSafeCandidate(candidate)
        && canUseColorSafeCandidate(candidate)
        && canUsePatternSafeCandidate(candidate)
        && canUseStyleDistributedCandidate(candidate, category)
        && canUseColorDistributedCandidate(candidate, category)
      ),
      (candidate) => (
        canUseStyleSafeCandidate(candidate)
        && canUseColorSafeCandidate(candidate)
        && canUsePatternSafeCandidate(candidate)
      ),
      (candidate) => (
        isNonStyleMatchCandidate(candidate)
        && canUseColorSafeCandidate(candidate)
        && canUsePatternSafeCandidate(candidate)
      ),
      (candidate) => canUseColorSafeCandidate(candidate) && canUsePatternSafeCandidate(candidate),
      () => true
    ];

    for (const matchesGroup of candidateGroups) {
      if (added >= missing) {
        break;
      }

      for (const candidate of candidates) {
        const itemId = String(candidate?.id);
        if (!itemId || resultIds.has(itemId) || !matchesGroup(candidate)) {
          continue;
        }

        if (!addItem(candidate)) {
          continue;
        }

        added += 1;
        if (added >= missing) {
          break;
        }
      }
    }
  }

  return result;
}

function getWardrobeSelectionPrompt(userProfile = null, items = [], categories = getCapsuleCategories(userProfile)) {
  const formalityText = typeof userProfile?.formalityLevel === "string" && userProfile.formalityLevel.trim().length > 0
    ? userProfile.formalityLevel
    : "Not specified";
  const styleText = typeof userProfile?.style === "string" && userProfile.style.trim().length > 0
    ? userProfile.style
    : "Not specified";
  const occasionsText = formatProfileValues(userProfile?.occasions);
  const seasonText = formatProfileValues(userProfile?.season);
  const audienceText = userProfile?.audience || "any";
  const accentColorText = typeof userProfile?.color === "string" && userProfile.color.trim().length > 0
    ? userProfile.color
    : "No accent color (keep the capsule fully neutral)";
  const patternText = normalizePatternValue(userProfile?.pattern) === "solid"
    ? "solid (no print)"
    : (
      typeof userProfile?.pattern === "string" && userProfile.pattern.trim().length > 0
        ? userProfile.pattern
        : "solid (no print)"
    );
  const additionalText = typeof userProfile?.text === "string" ? userProfile.text.trim() : "";
  const additionalInfoBlock = additionalText ? `Important Additional Information: ${additionalText}` : "";
  const simplifiedItems = items.map((item) => {
    const colorParts = [
      Array.isArray(item?.color_base) ? item.color_base.join(", ") : "",
      typeof item?.pattern === "string" ? item.pattern.trim() : "",
      typeof item?.finish === "string" ? item.finish.trim() : "",
      item?.is_neutral ? "neutral" : ""
    ].filter((value) => value);

    return {
      id: item?.id ?? null,
      name: item?.name ?? "",
      type: item?.category ?? "",
      color: colorParts.join(", "),
      formality_level: Array.isArray(item?.formality_level) ? item.formality_level : [],
      style: Array.isArray(item?.style) ? item.style : [],
      materials: item?.composition || "",
      fit: typeof item?.fit === "string" ? item.fit.trim() : "",
      silhouette: typeof item?.silhouette === "string" ? item.silhouette.trim() : ""
    };
  });
  const itemsJson = JSON.stringify(simplifiedItems, null, 2);

  return renderPromptTemplateContent(PROMPT_TEMPLATE, {
    formality_level: formalityText,
    style: styleText,
    occasions: occasionsText,
    season: seasonText,
    audience: audienceText,
    color: accentColorText,
    pattern: patternText,
    additional_info_block: additionalInfoBlock,
    items: itemsJson,
    category_list: getCategoryListText(categories),
    categories_schema: getCategorySchema(categories),
    num_items: String(Object.entries(categories).reduce((sum, [, count]) => sum + Number(count), 0))
  }, "wardrobe selection prompt");
}

function toWardrobeUiItem(item) {
  return {
    id: item?.id ?? null,
    url: item?.url ?? "",
    name: item?.name ?? "",
    category: item?.category ?? "",
    image_url: item?.image_url ?? "",
    audience: item?.audience ?? ""
  };
}

function appendUniqueWardrobeItems(items, extraItems) {
  const result = [];
  const seenKeys = new Set();

  for (const item of [...items, ...extraItems]) {
    const key = String(item?.url || item?.id || `${item?.category}:${item?.name}`);
    if (!key || seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    result.push(item);
  }

  return result;
}

async function generateCapsuleWardrobe(userProfile = null, logContext = null) {
  const llmResolution = resolveLlmProvider(userProfile);
  const sql = getSqlClient();
  const prompt = getWardrobePrompt(userProfile);
  const promptEmbeddings = await getPromptEmbeddings(prompt);

  const capsuleCategories = getCapsuleCategories(userProfile);
  const sqlParams = buildCapsuleWardrobeSqlParams(userProfile, promptEmbeddings, capsuleCategories);

  const sqlStartedAt = Date.now();
  const itemsResult = await queryCapsuleWardrobeItemsForProfile(sql, sqlParams);
  const sqlDurationMs = Date.now() - sqlStartedAt;

  const items = getSqlRows(itemsResult);
  const normalizedItems = items.map((item) => {
    const normalized = { ...item };
    delete normalized.embedding;
    return normalized;
  });
  logWardrobeInfo("capsule-sql-completed", {
    sqlDurationMs,
    sqlItemsTotal: normalizedItems.length,
    sqlItemsByCategory: countItemsByKey(normalizedItems)
  }, logContext);
  const noLlm = isNoLlmProfileEnabled(userProfile);
  if (noLlm) {
    logWardrobeInfo("capsule-llm-skipped", {
      reason: "profile_llm_none",
      requestedLlm: llmResolution.requestedLlm,
      usedModel: null
    }, logContext);
    const balancedItems = enforceCategoryCounts([], normalizedItems, capsuleCategories, userProfile);

    if (balancedItems.length === 0) {
      throw new Error("SQL returned no valid wardrobe items");
    }

    logWardrobeInfo("capsule-nollm-completed", {
      selectedItemsTotal: balancedItems.length,
      selectedItemsByCategory: countItemsByKey(balancedItems)
    }, logContext);

    return {
      items: balancedItems.map(toWardrobeUiItem),
      selectedItems: balancedItems,
      outfitSets: [],
      promptEmbeddings,
      shortCapsuleName: null,
      rawSelectionText: null
    };
  }
  const shouldSavePromptDebugArtifacts = process.env.NODE_ENV === "development";
  let promptDebugImages: PromptDebugImageResult = { categories: [], stitched: null };

  try {
    const imageFetchStartedAt = Date.now();
    promptDebugImages = await runWithImageWorkSlot("capsule-images", async () => buildPromptDebugImagesInChild({
      normalizedItems,
      saveDebugArtifacts: shouldSavePromptDebugArtifacts,
      debugOutputDir: shouldSavePromptDebugArtifacts
        ? new URL("../../../last-prompt/", import.meta.url)
        : null
    }));
    logWardrobeInfo("capsule-images-ready", {
      imageFetchDurationMs: Date.now() - imageFetchStartedAt,
      requestedCount: normalizedItems.length,
      cachedCount: promptDebugImages.cachedCount || 0,
      downloadedCount: promptDebugImages.downloadedCount || 0,
      skippedCount: promptDebugImages.skippedCount || 0
    }, logContext);
  } catch (error) {
    if (String(error?.message || "").startsWith("prompt_images_child_exit:")) {
      logWardrobeInfo("capsule-images-child-exit", {
        message: error.message
      }, logContext);
    }
    console.warn(
      "[prompt-images][build-failed]",
      JSON.stringify({
        message: error?.message || "unknown_error"
      })
    );
  }

  const selectionPrompt = getWardrobeSelectionPrompt(userProfile, normalizedItems, capsuleCategories);
  saveLastPromptArtifacts(selectionPrompt, userProfile);
  const llmStartedAt = Date.now();
  const generateJsonWithLlm = getGenerateJsonWithLlm(userProfile);
  const stylistImages = promptDebugImages.stitched
    ? [promptDebugImages.stitched]
    : promptDebugImages.categories;
  const { response: selectionResponse, json: parsedSelection } = await generateJsonWithLlm(selectionPrompt, {
    userProfile,
    images: stylistImages,
    onPayloadBuilt: () => {
      promptDebugImages.categories = [];
      promptDebugImages.stitched = null;
    }
  });
  promptDebugImages.categories = [];
  promptDebugImages.stitched = null;
  logWardrobeInfo("capsule-llm-completed", {
    llmProvider: llmResolution.provider,
    llmModel: llmResolution.model,
    requestedLlm: llmResolution.requestedLlm,
    fallbackReason: llmResolution.fallbackReason,
    llmDurationMs: Date.now() - llmStartedAt,
    ...extractLlmUsage(selectionResponse?.usage)
  }, logContext);

  console.log("[wardrobe-ai][selected-json]", JSON.stringify(parsedSelection));
  if (!parsedSelection?.capsule || typeof parsedSelection.capsule !== "object") {
    console.warn(
      "[wardrobe-ai][selected-json-empty]",
      JSON.stringify({
        outputText: typeof selectionResponse?.output_text === "string"
          ? selectionResponse.output_text.trim()
          : null,
        output: selectionResponse?.output ?? null,
        outputParsed: selectionResponse?.output_parsed ?? null,
        finishReason: selectionResponse?.status ?? null,
        incompleteDetails: selectionResponse?.incomplete_details ?? null,
        usage: selectionResponse?.usage ?? null
      })
    );
  }

  const selectedIds = getSelectedIdsFromCapsule(parsedSelection?.capsule);
  const uniqueSelectedIds = [...new Set(selectedIds.map((id) => String(id)))];
  const itemsById = new Map(normalizedItems.map((item) => [String(item.id), item]));
  const selectedItems = uniqueSelectedIds
    .map((id) => itemsById.get(String(id)))
    .filter(Boolean);
  const balancedItems = enforceCategoryCounts(selectedItems, normalizedItems, capsuleCategories, userProfile);

  if (balancedItems.length === 0) {
    throw new Error("Model returned no valid selected_ids");
  }

  return {
    items: balancedItems.map(toWardrobeUiItem),
    selectedItems: balancedItems,
    outfitSets: buildOutfitSetsFromFormulas(getOutfitFormulas(parsedSelection), balancedItems),
    promptEmbeddings,
    shortCapsuleName: getShortCapsuleName(parsedSelection?.system_evaluation?.short_capsule_name),
    rawSelectionText: typeof selectionResponse?.output_text === "string" && selectionResponse.output_text.trim().length > 0
      ? selectionResponse.output_text.trim()
      : null
  };
}

function hasStoredWardrobeItems(profile) {
  return Boolean(getStoredWardrobePayload(profile)?.items?.length);
}

function createWardrobeJobKey(email, capsuleId) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCapsuleId = String(capsuleId || "").trim();
  return normalizedCapsuleId ? `${normalizedEmail}::${normalizedCapsuleId}` : normalizedEmail;
}

function createWardrobeService({
  getProfileImpl = getProfile,
  getCapsuleImpl = getCapsule,
  renameCapsuleImpl = renameCapsule,
  updateCapsuleSnapshotImpl = updateCapsuleSnapshot,
  generateCapsuleWardrobeImpl = generateCapsuleWardrobe,
  shouldGenerateSwimwearImpl = shouldGenerateSwimwear,
  generateSwimwearAdditionImpl = generateSwimwearAddition,
  getPartialRegenerationJobImpl = (email, capsuleId) => getPartialRegenerationJob(email, capsuleId),
  buildCapsuleEventSnapshotImpl = buildCapsuleEventSnapshot,
  publishSnapshotImpl = (email, capsuleId, snapshot) => capsuleEventHub.publish(email, capsuleId, snapshot),
  jobs = wardrobeJobs,
  nowMsImpl = () => Date.now(),
  setTimeoutImpl = setTimeout,
  randomUuidImpl = () => crypto.randomUUID()
}: WardrobeServiceDependencies = {}) {
  function scheduleJobCleanup(jobKey: string, job: WardrobeJobState) {
    const cleanupTimer = setTimeoutImpl(() => {
      if (jobs.get(jobKey) === job && job.status !== "pending") {
        jobs.delete(jobKey);
      }
    }, COMPLETED_JOB_TTL_MS);
    cleanupTimer?.unref?.();
  }

  function getWardrobeJob(email: string, capsuleId: string) {
    const jobKey = createWardrobeJobKey(email, capsuleId);
    const job = jobs.get(jobKey);
    if (!job) {
      return null;
    }

    if (job.status !== "pending" && nowMsImpl() - job.updatedAt > COMPLETED_JOB_TTL_MS) {
      jobs.delete(jobKey);
      return null;
    }

    return job;
  }

  function startWardrobeJob(
    email: string,
    capsuleId: string,
    profile: Awaited<ReturnType<typeof getProfile>>,
    capsule: Awaited<ReturnType<typeof getCapsule>>,
    logContext: LogContextLike | null = null,
    options: StartWardrobeJobOptions = {}
  ) {
    const jobKey = createWardrobeJobKey(email, capsuleId);
    const existing = getWardrobeJob(email, capsuleId);
    if (existing?.status === "pending") {
      return existing;
    }

    const capsuleRequestId = logContext?.capsuleRequestId || randomUuidImpl();
    const startedAt = nowMsImpl();
    const job: WardrobeJobState = {
      capsuleRequestId,
      status: "pending",
      startedAt,
      updatedAt: nowMsImpl(),
      promise: null,
      phase: "capsule",
      result: null
    };
    jobs.set(jobKey, job);

    job.promise = (async () => {
      const jobLogContext = {
        capsuleRequestId,
        startedAt
      };
      let currentCapsule = capsule;
      const allowAutoRename = options.allowAutoRename !== false;
      const forceEmptyWardrobe = Boolean(options.forceEmptyWardrobe);
      const rollbackSnapshot = options.rollbackSnapshot || null;

      try {
        const generationProfile = buildProfileCapsuleContext(profile, capsule, { forceEmptyWardrobe });
        const baseSnapshot = getEffectiveCapsuleSnapshot(capsule);
        const storedWardrobeBeforeGeneration = getStoredWardrobePayload({ items: baseSnapshot?.data?.wardrobe });
        const isFirstContentGenerationForNewCapsule =
          capsule?.status === "new" && !storedWardrobeBeforeGeneration?.items?.length;
        const wardrobe = await generateCapsuleWardrobeImpl(generationProfile, jobLogContext);
        const items = wardrobe.items;

        if (items.length === 0) {
          throw new Error("AI response has no valid wardrobe items");
        }

        const storedCapsule = buildWardrobePayload({
          items,
          outfitSets: wardrobe.outfitSets,
          rawSelectionText: wardrobe.rawSelectionText
        });
        if (capsuleId) {
          currentCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, {
            filters: baseSnapshot?.filters,
            data: {
              wardrobe: storedCapsule,
              rejectedUrls: [],
              regeneration: null
            }
          });
        } else {
          currentCapsule = {
            ...capsule,
            draft: {
              filters: baseSnapshot?.filters,
              data: {
                wardrobe: storedCapsule,
                rejectedUrls: [],
                regeneration: null
              }
            }
          } as typeof capsule;
        }
        if (allowAutoRename && capsuleId && isFirstContentGenerationForNewCapsule && wardrobe.shortCapsuleName) {
          currentCapsule = await renameCapsuleImpl(email, capsuleId, wardrobe.shortCapsuleName) || currentCapsule;
        }
        logWardrobeInfo("capsule-base-completed", {
          baseDurationMs: nowMsImpl() - startedAt,
          capsuleItemsTotal: items.length,
          capsuleItemsByCategory: countItemsByKey(items)
        }, jobLogContext);

        job.result = storedCapsule;

        if (shouldGenerateSwimwearImpl(generationProfile)) {
          job.phase = "extras";
          job.updatedAt = nowMsImpl();
          publishSnapshotImpl(
            email,
            capsuleId,
            buildCapsuleEventSnapshotImpl({ capsule: currentCapsule, activeJob: job })
          );

          try {
            const swimwear = await generateSwimwearAdditionImpl({
              userProfile: generationProfile,
              selectedCapsuleItems: wardrobe.selectedItems,
              promptEmbeddings: wardrobe.promptEmbeddings,
              logContext: jobLogContext
            });
            const finalItems = appendUniqueWardrobeItems(items, swimwear.items);
            const finalPayload = buildWardrobePayload({
              items: finalItems,
              outfitSets: wardrobe.outfitSets,
              rawSelectionText: wardrobe.rawSelectionText,
              swimwearReasoning: swimwear.reasoning,
              swimwearRawSelectionText: swimwear.rawSelectionText
            });

            if (capsuleId) {
              currentCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, {
                filters: baseSnapshot?.filters,
                data: {
                  wardrobe: finalPayload,
                  rejectedUrls: [],
                  regeneration: null
                }
              });
            } else {
              currentCapsule = {
                ...currentCapsule,
                draft: {
                  filters: baseSnapshot?.filters,
                  data: {
                    wardrobe: finalPayload,
                    rejectedUrls: [],
                    regeneration: null
                  }
                }
              } as typeof currentCapsule;
            }
            logWardrobeInfo("capsule-total-completed", {
              totalDurationMs: nowMsImpl() - startedAt,
              itemsTotal: finalItems.length,
              itemsByCategory: countItemsByKey(finalItems)
            }, jobLogContext);
            job.result = finalPayload;
          } catch (error) {
            console.error("[wardrobe-ai][swimwear]", buildErrorLogContext(jobLogContext), error);
            logWardrobeInfo("capsule-total-completed", {
              totalDurationMs: nowMsImpl() - startedAt,
              itemsTotal: items.length,
              itemsByCategory: countItemsByKey(items)
            }, jobLogContext);
          }
        } else {
          logWardrobeInfo("capsule-total-completed", {
            totalDurationMs: nowMsImpl() - startedAt,
            itemsTotal: items.length,
            itemsByCategory: countItemsByKey(items)
          }, jobLogContext);
        }

        job.status = "completed";
        job.phase = "completed";
        job.updatedAt = nowMsImpl();
        publishSnapshotImpl(
          email,
          capsuleId,
          buildCapsuleEventSnapshotImpl({ capsule: currentCapsule, activeJob: job })
        );
      } catch (error) {
        job.status = "failed";
        job.phase = "failed";
        job.updatedAt = nowMsImpl();
        job.error = error;
        console.error("[wardrobe-ai]", buildErrorLogContext(jobLogContext), error);
        if (capsuleId && rollbackSnapshot) {
          try {
            currentCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, rollbackSnapshot) || currentCapsule;
          } catch (rollbackError) {
            console.error("[wardrobe-ai][rollback]", buildErrorLogContext(jobLogContext), rollbackError);
          }
        }
        publishSnapshotImpl(
          email,
          capsuleId,
          buildCapsuleEventSnapshotImpl({ capsule: currentCapsule, activeJob: job })
        );
      } finally {
        scheduleJobCleanup(jobKey, job);
      }
    })();

    return job;
  }

  async function getCapsuleItems(req, res) {
    try {
      const email = req.user.email;
      const capsuleId = String(req.params?.id || "").trim();
      let capsule = getRequiredCapsule(capsuleId, await getCapsuleImpl(email, capsuleId));
      const activeJob = getWardrobeJob(email, capsuleId);
      const partialRegenerationJob = getPartialRegenerationJobImpl(email, capsuleId);
      if (getCapsuleSnapshotRegeneration(getEffectiveCapsuleSnapshot(capsule)) && activeJob?.status !== "pending") {
        const clearedSnapshot = buildCapsuleSnapshotWithRegeneration(getEffectiveCapsuleSnapshot(capsule), null);
        capsule = await updateCapsuleSnapshotImpl(email, capsuleId, clearedSnapshot) || capsule;
        const staleSnapshot = buildCapsuleEventSnapshotImpl({
          capsule,
          activeJob: {
            status: "failed",
            phase: "failed",
            error: new Error("stale_regeneration")
          },
          partialRegenerationJob
        });
        return res.status(503).json({
          error: "service_unavailable",
          rawSelectionText: staleSnapshot.rawSelectionText || null
        });
      }
      const snapshot = buildCapsuleEventSnapshotImpl({
        capsule,
        activeJob,
        partialRegenerationJob
      });

      if (snapshot.status === "failed") {
        if (activeJob?.status === "failed") {
          jobs.delete(createWardrobeJobKey(email, capsuleId));
        }

        return res.status(503).json({
          error: "service_unavailable",
          rawSelectionText: snapshot.rawSelectionText || null
        });
      }

      if (snapshot.status === "pending") {
        return res.status(202).json({
          ok: true,
          status: "pending",
          pendingStage: snapshot.pendingStage,
          pendingRegenerationUrls: snapshot.pendingRegenerationUrls,
          hasPendingAdditionalItems: snapshot.hasPendingAdditionalItems,
          items: snapshot.items,
          outfitSets: snapshot.outfitSets,
          rawSelectionText: snapshot.rawSelectionText,
          ...(snapshot.swimwearReasoning ? { swimwearReasoning: snapshot.swimwearReasoning } : {}),
          ...(snapshot.swimwearRawSelectionText ? { swimwearRawSelectionText: snapshot.swimwearRawSelectionText } : {})
        });
      }

      return res.status(200).json({
        ok: true,
        status: "ready",
        items: snapshot.items,
        outfitSets: snapshot.outfitSets,
        rawSelectionText: snapshot.rawSelectionText,
        ...(snapshot.swimwearReasoning ? { swimwearReasoning: snapshot.swimwearReasoning } : {}),
        ...(snapshot.swimwearRawSelectionText ? { swimwearRawSelectionText: snapshot.swimwearRawSelectionText } : {}),
        hasPendingAdditionalItems: false
      });
    } catch (error) {
      if ((error as ErrorWithCode | undefined)?.code === "invalid_payload" || (error as Error | undefined)?.message === "invalid_payload") {
        return res.status(400).json({ error: "invalid_payload" });
      }
      if ((error as ErrorWithCode | undefined)?.code === "not_found" || (error as Error | undefined)?.message === "not_found") {
        return res.status(404).json({ error: "not_found" });
      }
      console.error("[wardrobe-ai]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  }

  async function regenerateCapsuleWardrobe(req, res) {
    try {
      const email = req.user.email;
      const capsuleId = String(req.params?.id || "").trim();
      const profile = await getProfileImpl(email);
      const capsule = getRequiredCapsule(capsuleId, await getCapsuleImpl(email, capsuleId));
      const activeJob = getWardrobeJob(email, capsuleId);
      const partialRegenerationJob = getPartialRegenerationJobImpl(email, capsuleId);

      if (partialRegenerationJob?.status === "pending") {
        return res.status(202).json({
          ok: true,
          status: "pending",
          pendingStage: "regenerate"
        });
      }

      if (activeJob?.status === "pending") {
        return res.status(202).json({
          ok: true,
          status: "pending",
          pendingStage: activeJob.phase === "extras" ? "extras" : "capsule",
          hasPendingAdditionalItems: activeJob.phase === "extras"
        });
      }

      if (activeJob?.status === "failed") {
        jobs.delete(createWardrobeJobKey(email, capsuleId));
      }

      const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
      const storedWardrobeBeforeRegeneration = getStoredWardrobePayload({ items: effectiveSnapshot?.data?.wardrobe });
      const shouldAutoRenameNewCapsule =
        capsule?.status === "new" && !storedWardrobeBeforeRegeneration?.items?.length;
      const logContext = {
        capsuleRequestId: randomUuidImpl()
      };
      const rollbackSnapshot = buildCapsuleSnapshotWithRegeneration(effectiveSnapshot, null);
      const pendingSnapshot = buildCapsuleSnapshotWithRegeneration(effectiveSnapshot, {
        status: "pending",
        kind: "full",
        startedAt: new Date().toISOString(),
        requestId: logContext.capsuleRequestId
      });
      const updatedCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, pendingSnapshot);
      const generationCapsule = {
        ...capsule,
        ...(updatedCapsule || {}),
        draft: pendingSnapshot
      };
      const generationProfile = buildProfileCapsuleContext(profile, generationCapsule, { forceEmptyWardrobe: true });
      const noLlm = isNoLlmProfileEnabled(generationProfile);
      logWardrobeInfo("capsule-request-received", {
        ...getRequestedWardrobeParams(generationProfile, {
          forceRefresh: true
        }),
        noLlm: noLlm || undefined
      }, logContext);
      const job = startWardrobeJob(email, capsuleId, profile, generationCapsule, logContext, {
        allowAutoRename: shouldAutoRenameNewCapsule,
        forceEmptyWardrobe: true,
        rollbackSnapshot
      });
      publishSnapshotImpl(
        email,
        capsuleId,
        buildCapsuleEventSnapshotImpl({
          capsule: generationCapsule,
          activeJob: job,
          partialRegenerationJob
        })
      );

      return res.status(202).json({
        ok: true,
        status: "pending",
        pendingStage: "capsule",
        hasPendingAdditionalItems: false
      });
    } catch (error) {
      if ((error as ErrorWithCode | undefined)?.code === "invalid_payload" || (error as Error | undefined)?.message === "invalid_payload") {
        return res.status(400).json({ error: "invalid_payload" });
      }
      if ((error as ErrorWithCode | undefined)?.code === "not_found" || (error as Error | undefined)?.message === "not_found") {
        return res.status(404).json({ error: "not_found" });
      }
      console.error("[wardrobe-ai]", error);
      return res.status(503).json({
        error: "service_unavailable",
        rawSelectionText: typeof (error as { rawSelectionText?: string | null } | undefined)?.rawSelectionText === "string"
          && (error as { rawSelectionText?: string }).rawSelectionText.trim().length > 0
          ? (error as { rawSelectionText: string }).rawSelectionText.trim()
          : null
      });
    }
  }

  return {
    getCapsuleItems,
    getWardrobeJob,
    regenerateCapsuleWardrobe,
    startWardrobeJob
  };
}

const wardrobeService = createWardrobeService();
const {
  getCapsuleItems,
  getWardrobeJob,
  regenerateCapsuleWardrobe,
  startWardrobeJob
} = wardrobeService;

export {
  countItemsByKey,
  createWardrobeService,
  enforceCategoryCounts,
  extractLlmUsage,
  getCapsuleItems,
  getSelectedIdsFromCapsule,
  getWardrobeJob,
  getStoredWardrobePayload,
  getWardrobeSelectionPrompt,
  logWardrobeInfo,
  regenerateCapsuleWardrobe,
  startWardrobeJob,
  toWardrobeUiItem
};
