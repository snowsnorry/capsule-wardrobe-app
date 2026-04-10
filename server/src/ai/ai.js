import crypto from "node:crypto";
import { getProfile } from "../profileStore.js";
import { getSqlClient } from "../db.js";
import {
  buildProfileCapsuleContext,
  getCapsule,
  getEffectiveCapsuleSnapshot,
  updateCapsuleSnapshot
} from "../capsuleStore.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getGenerateJsonWithLlm, isNoLlmProfileEnabled, resolveLlmProvider } from "./llm.js";
import {  getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { getCapsuleCategories } from "./categories.js";
import { generateSwimwearAddition, shouldGenerateSwimwear } from "./swimwear.js";
import { buildPromptDebugImagesInChild } from "./promptImages.js";
import {
  getProcessMemoryUsage,
  runWithImageWorkSlot,
  sumCategoryBytes
} from "./imagePipeline.js";
import { getPartialRegenerationJob } from "./regenerateSelected.js";
import {
  buildCapsuleEventSnapshot,
  capsuleEventHub,
  getStoredWardrobePayload
} from "./capsuleEvents.js";
const PROMPT_TEMPLATE = readFileSync(new URL("../templates/prompt.txt", import.meta.url), "utf8");
const COMPLETED_JOB_TTL_MS = 5 * 60 * 1000;
const LAST_PROMPT_DIR_URL = new URL("../../../last-prompt/", import.meta.url);
const wardrobeJobs = new Map();

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

function saveLastPromptArtifacts(prompt) {
  if (process.env.NODE_ENV !== "development" || typeof prompt !== "string") {
    return;
  }

  mkdirSync(LAST_PROMPT_DIR_URL, { recursive: true });
  writeFileSync(new URL("last_prompt.txt", LAST_PROMPT_DIR_URL), prompt, "utf8");
}

function countItemsByKey(items = [], key = "category") {
  return items.reduce((result, item) => {
    const value = String(item?.[key] || "").trim();
    if (!value) {
      return result;
    }

    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function getRequestedWardrobeParams(userProfile = null, { forceRefresh = false } = {}) {
  const params = {};

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

function getRequiredCapsule(capsuleId, capsule) {
  if (!capsuleId) {
    const error = new Error("invalid_payload");
    error.code = "invalid_payload";
    throw error;
  }

  if (!capsule) {
    const error = new Error("not_found");
    error.code = "not_found";
    throw error;
  }

  return capsule;
}

function extractLlmUsage(usage = null) {
  if (!usage || typeof usage !== "object") {
    return {};
  }

  const result = {};

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

function buildErrorLogContext(logContext = null) {
  if (!logContext?.capsuleRequestId) {
    return null;
  }

  return {
    capsuleRequestId: logContext.capsuleRequestId
  };
}

function buildWardrobePayload({
  items,
  reasoning = null,
  rawSelectionText = null,
  swimwearReasoning = null,
  swimwearRawSelectionText = null
}) {
  return {
    items,
    reasoning,
    rawSelectionText,
    swimwearReasoning,
    swimwearRawSelectionText
  };
}

function formatProfileValues(values) {
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

function getCategoryListText(categories) {
  return Object.entries(categories)
    .filter(([, count]) => Number.isInteger(count) && count > 0)
    .map(([category, count]) => `${count} ${category}`)
    .join(", ");
}

function getCategorySchema(categories) {
  const schema = Object.entries(categories).reduce((result, [category, count]) => {
    if (!Number.isInteger(count) || count <= 0) {
      return result;
    }

    result[category] = Array.from({ length: count }, (_, index) => `id${index + 1}`);
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
  let effectiveColor = normalizeCapsuleConstraintValue(capsuleParams?.color);
  let effectivePattern = normalizePatternValue(capsuleParams?.pattern) || "solid";
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

  let prompt = PROMPT_TEMPLATE
    .replace("{{formality_level}}", formalityText)
    .replace("{{style}}", styleText)
    .replace("{{occasions}}", occasionsText)
    .replace("{{season}}", seasonText)
    .replace("{{audience}}", audienceText)
    .replace("{{color}}", accentColorText)
    .replace("{{pattern}}", patternText)
    .replace("{{additional_info_block}}", additionalInfoBlock)
    .replace("{{items}}", itemsJson)
    .replace("{{category_list}}", getCategoryListText(categories))
    .replace("{{categories_schema}}", getCategorySchema(categories))
    .replace("{{num_items}}", Object.entries(categories).reduce((sum, [, count]) => sum + count, 0));

  return prompt;
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
  const categories = Object.keys(capsuleCategories);
  const formalityLevel = userProfile?.formalityLevel ?? null;
  const style = userProfile?.style ?? null;
  const occasions = Array.isArray(userProfile?.occasions) ? userProfile.occasions : [];
  const season = Array.isArray(userProfile?.season) ? userProfile.season : [];
  const audienceByProfile = {
    man: ["man", "all"],
    woman: ["woman", "all"],
    any: ["man", "woman", "all"]
  };
  const audienceFilters = audienceByProfile[userProfile?.audience] || audienceByProfile.any;
  const color = userProfile?.color ?? null;
  const pattern = normalizePatternValue(userProfile?.pattern) || "solid";
  const rejectedUrls = Array.isArray(userProfile?.rejected)
    ? userProfile.rejected.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];
  const embeddingVector = `[${promptEmbeddings.join(",")}]`;
  const additionalText = typeof userProfile?.text === "string" ? userProfile.text.trim() : "";
  // There should be no random noise when the user makes a specific request.
  const noiseFactor = additionalText ? 0 : 0.05;

  const sqlStartedAt = Date.now();
  const items = await sql`
    SELECT results.*
    FROM unnest(${categories}::text[]) AS cats(target_category)
    CROSS JOIN LATERAL (
      SELECT * FROM (
        SELECT 
          filtered_items.*,
          -- 4. Calculate Color Rank (FINAL VISUAL SORTING)
          -- We calculate this AFTER filtering out the excess accent items.
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(color_base, ARRAY[]::text[])
            ORDER BY 
              relevance_score DESC, 
              (distance + (RANDOM() * ${noiseFactor}::float)) ASC
          ) as color_rank
        FROM (
          SELECT 
            raw_scored.*,
            -- 3. INDEPENDENT QUOTA RANKING
            -- We rank accent items and patterned items in completely separate windows.
            ROW_NUMBER() OVER (
              PARTITION BY is_style_match
              ORDER BY relevance_score DESC, distance ASC
            ) as aesthetic_rank,
            ROW_NUMBER() OVER (
              PARTITION BY is_color_match
              ORDER BY relevance_score DESC, distance ASC
            ) as accent_rank,
            ROW_NUMBER() OVER (
              PARTITION BY is_pattern_limited_item
              ORDER BY relevance_score DESC, distance ASC
            ) as pattern_rank
          FROM (
            SELECT
              products.*,
              -- 1. Calculate Vector Distance
              embedding <=> ${embeddingVector}::vector as distance,
              
              -- 1.1 Identify Accent Match (Boolean helper)
              (
                ${style}::text IS NOT NULL
                AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[]))
              ) as is_style_match,
              (
                ${color}::text IS NOT NULL
                AND ${color}::text != ''
                AND ${color}::text = ANY(color_base)
              ) as is_color_match,
              (
                CASE
                  WHEN lower(${pattern}::text) = 'solid'
                  THEN FALSE
                  WHEN ${pattern}::text IS NOT NULL AND ${pattern}::text != ''
                  THEN lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                  ELSE pattern IS NOT NULL
                    AND trim(pattern) != ''
                    AND lower(pattern) != 'solid'
                END
              ) as is_pattern_limited_item,
              
              -- 2. Calculate Relevance Score
              (
                -- Style Match (+20)
                CASE WHEN ${formalityLevel}::text IS NOT NULL
                  AND ${formalityLevel}::text = ANY(COALESCE(formality_level, ARRAY[]::text[]))
                THEN 20 ELSE 0 END
                +
                CASE WHEN ${style}::text IS NOT NULL
                  AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[]))
                THEN 20 ELSE 0 END
                +
                -- Occasion Match (+20)
                CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && ${occasions}::text[]
                THEN 20 ELSE 0 END
                +
                -- Season Match (+50 or +40 fallback)
                CASE WHEN COALESCE(season, ARRAY[]::text[]) && ${season}::text[] THEN 50
                WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
                ELSE 0 END
                +
                -- COLOR BOOST (+20)
                -- We keep the boost to ensure the allowed color items are the "best" ones.
                CASE 
                  WHEN ${color}::text IS NOT NULL AND ${color}::text != ''
                      AND ${color}::text = ANY(color_base)
                  THEN 20 ELSE 0 
                END
                +
                -- PATTERN BOOST (+20)
                CASE
                  WHEN ${pattern}::text IS NOT NULL AND ${pattern}::text != ''
                      AND lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                  THEN 20 ELSE 0
                END
              ) as relevance_score

            FROM products
            WHERE 
              -- HARD FILTERS
              category = cats.target_category
              AND lower(COALESCE(audience, '')) = ANY(${audienceFilters}::text[])
              AND (
                CASE
                  WHEN ${color}::text IS NOT NULL AND ${color}::text != ''
                  THEN ${color}::text = ANY(COALESCE(color_base, ARRAY[]::text[]))
                    OR COALESCE(is_neutral, false)
                  ELSE COALESCE(is_neutral, false)
                END
              )
              AND (
                CASE
                  WHEN lower(${pattern}::text) = 'solid'
                  THEN pattern IS NULL
                    OR trim(pattern) = ''
                    OR lower(pattern) = 'solid'
                  ELSE lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                    OR pattern IS NULL
                    OR trim(pattern) = ''
                    OR lower(pattern) = 'solid'
                END
              )
              AND NOT (products.url = ANY(${rejectedUrls}::text[]))
          ) raw_scored
        ) filtered_items
        WHERE
          -- !!! INDEPENDENT QUOTA LIMITS !!!
          -- Rule 1: If it's an aesthetic item, it must be in the top 3 of aesthetics.
          (is_style_match IS NOT TRUE OR aesthetic_rank <= 3)
          AND 
          -- Rule 2: If it's an accent item, it must be in the top 3 of accents.
          (is_color_match IS NOT TRUE OR accent_rank <= 3)
          AND 
          -- Rule 3: If it's a patterned item, it must be in the top 3 of patterns. (WITH BYPASS FOR 'SOLID')
          (
            is_pattern_limited_item IS NOT TRUE 
            OR lower(${pattern}::text) = 'solid'
            OR pattern_rank <= 3
          )
      ) results
      
      -- 5. FINAL SORTING STRATEGY
      ORDER BY 
        relevance_score DESC, 
        color_rank ASC,        
        (distance + (RANDOM() * ${noiseFactor}::float)) ASC
      LIMIT 10
    ) results`;
  const sqlDurationMs = Date.now() - sqlStartedAt;

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
      promptEmbeddings,
      rawSelectionText: null,
      reasoning: null
    };
  }
  const shouldSavePromptDebugArtifacts = process.env.NODE_ENV === "development";
  let promptDebugImages = { categories: [], stitched: null };

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
  saveLastPromptArtifacts(selectionPrompt);
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
    promptEmbeddings,
    rawSelectionText: typeof selectionResponse?.output_text === "string" && selectionResponse.output_text.trim().length > 0
      ? selectionResponse.output_text.trim()
      : null,
    reasoning: typeof parsedSelection === "object" && Object.keys(parsedSelection).length > 0
      ? JSON.stringify(parsedSelection, null, 2)
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
  updateCapsuleSnapshotImpl = updateCapsuleSnapshot,
  generateCapsuleWardrobeImpl = generateCapsuleWardrobe,
  shouldGenerateSwimwearImpl = shouldGenerateSwimwear,
  generateSwimwearAdditionImpl = generateSwimwearAddition,
  getPartialRegenerationJobImpl = (...args) => getPartialRegenerationJob(...args),
  buildCapsuleEventSnapshotImpl = buildCapsuleEventSnapshot,
  publishSnapshotImpl = (email, capsuleId, snapshot) => capsuleEventHub.publish(email, capsuleId, snapshot),
  jobs = wardrobeJobs,
  nowMsImpl = () => Date.now(),
  setTimeoutImpl = setTimeout,
  randomUuidImpl = () => crypto.randomUUID()
} = {}) {
  function scheduleJobCleanup(jobKey, job) {
    setTimeoutImpl(() => {
      if (jobs.get(jobKey) === job && job.status !== "pending") {
        jobs.delete(jobKey);
      }
    }, COMPLETED_JOB_TTL_MS);
  }

  function getWardrobeJob(email, capsuleId) {
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

  function startWardrobeJob(email, capsuleId, profile, capsule, logContext = null) {
    const jobKey = createWardrobeJobKey(email, capsuleId);
    const existing = getWardrobeJob(email, capsuleId);
    if (existing?.status === "pending") {
      return existing;
    }

    const capsuleRequestId = logContext?.capsuleRequestId || randomUuidImpl();
    const startedAt = nowMsImpl();
    const job = {
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

      try {
        const generationProfile = {
          ...buildProfileCapsuleContext(profile, capsule)
        };
        const wardrobe = await generateCapsuleWardrobeImpl(generationProfile, jobLogContext);
        const items = wardrobe.items;

        if (items.length === 0) {
          throw new Error("AI response has no valid wardrobe items");
        }

        const storedCapsule = buildWardrobePayload({
          items,
          reasoning: wardrobe.reasoning,
          rawSelectionText: wardrobe.rawSelectionText
        });
        const baseSnapshot = getEffectiveCapsuleSnapshot(capsule);
        if (capsuleId) {
          currentCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, {
            filters: baseSnapshot?.filters,
            data: {
              wardrobe: storedCapsule,
              rejectedUrls: []
            }
          });
        } else {
          currentCapsule = {
            ...capsule,
            draft: {
              filters: baseSnapshot?.filters,
              data: {
                wardrobe: storedCapsule,
                rejectedUrls: []
              }
            }
          };
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
              reasoning: wardrobe.reasoning,
              rawSelectionText: wardrobe.rawSelectionText,
              swimwearReasoning: swimwear.reasoning,
              swimwearRawSelectionText: swimwear.rawSelectionText
            });

            if (capsuleId) {
              currentCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, {
                filters: baseSnapshot?.filters,
                data: {
                  wardrobe: finalPayload,
                  rejectedUrls: []
                }
              });
            } else {
              currentCapsule = {
                ...currentCapsule,
                draft: {
                  filters: baseSnapshot?.filters,
                  data: {
                    wardrobe: finalPayload,
                    rejectedUrls: []
                  }
                }
              };
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
      await updateCapsuleSnapshotImpl(email, capsuleId, {
        filters: effectiveSnapshot?.filters,
        data: {
          wardrobe: null,
          rejectedUrls: []
        }
      });
      const generationCapsule = {
        ...capsule,
        draft: {
          filters: effectiveSnapshot?.filters,
          data: {
            wardrobe: null,
            rejectedUrls: []
          }
        }
      };
      const generationProfile = buildProfileCapsuleContext(profile, generationCapsule);
      const noLlm = isNoLlmProfileEnabled(generationProfile);
      const logContext = {
        capsuleRequestId: randomUuidImpl()
      };
      logWardrobeInfo("capsule-request-received", {
        ...getRequestedWardrobeParams(generationProfile, {
          forceRefresh: true
        }),
        noLlm: noLlm || undefined
      }, logContext);
      const job = startWardrobeJob(email, capsuleId, profile, generationCapsule, logContext);
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
      if (error?.code === "invalid_payload" || error?.message === "invalid_payload") {
        return res.status(400).json({ error: "invalid_payload" });
      }
      if (error?.code === "not_found" || error?.message === "not_found") {
        return res.status(404).json({ error: "not_found" });
      }
      console.error("[wardrobe-ai]", error);
      return res.status(503).json({
        error: "service_unavailable",
        rawSelectionText: typeof error?.rawSelectionText === "string" && error.rawSelectionText.trim().length > 0
          ? error.rawSelectionText.trim()
          : null
      });
    }
  }

  return {
    getWardrobeJob,
    regenerateCapsuleWardrobe,
    startWardrobeJob
  };
}

const wardrobeService = createWardrobeService();
const {
  getWardrobeJob,
  regenerateCapsuleWardrobe,
  startWardrobeJob
} = wardrobeService;

export {
  countItemsByKey,
  createWardrobeService,
  enforceCategoryCounts,
  extractLlmUsage,
  getSelectedIdsFromCapsule,
  getWardrobeJob,
  getStoredWardrobePayload,
  getWardrobeSelectionPrompt,
  logWardrobeInfo,
  regenerateCapsuleWardrobe,
  startWardrobeJob,
  toWardrobeUiItem
};
