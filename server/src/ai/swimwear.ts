import { getSqlClient } from "../db.js";
import {
  buildCustomJsonObjectFormat,
  buildSwimwearSchema,
  getGenerateJsonWithLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider
} from "./llm.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent
} from "./promptTemplates.js";
import type { LlmUsageLike, SwimwearCandidate, UserProfileLike } from "./types.js";

const SWIMWEAR_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_woman_swimwear.yaml", import.meta.url)
);
const PROMPT_TEMPLATE = getPromptTemplateContent(SWIMWEAR_PROMPT_TEMPLATE, "user");
const SYSTEM_PROMPT_TEMPLATE = getPromptTemplateContent(SWIMWEAR_PROMPT_TEMPLATE, "system");

function formatLogValue(value: unknown) {
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

function formatLogPayload(payload: Record<string, unknown> = {}) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${formatLogValue(value)}`)
    .join(", ");
}

function getShortRequestId(logContext: { capsuleRequestId?: string | null } | null = null) {
  const capsuleRequestId = String(logContext?.capsuleRequestId || "").trim();
  if (!capsuleRequestId) {
    return "";
  }

  return capsuleRequestId.split("-")[0] || capsuleRequestId.slice(0, 8);
}

function logWardrobeInfo(event: string, payload: Record<string, unknown> = {}, logContext: { capsuleRequestId?: string | null } | null = null) {
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

function countItemsByKey(items: Array<Record<string, unknown>> = [], key = "category") {
  return items.reduce<Record<string, number>>((result, item) => {
    const value = String(item?.[key] || "").trim();
    if (!value) {
      return result;
    }

    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function extractLlmUsage(usage: LlmUsageLike | null = null) {
  if (!usage) {
    return {};
  }

  const result: Record<string, number> = {};

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

function normalizeSeasonList(season: UserProfileLike["season"]) {
  if (Array.isArray(season)) {
    return season
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof season === "string" && season.trim().length > 0) {
    return [season.trim().toLowerCase()];
  }

  return [];
}

function shouldGenerateSwimwear(userProfile: UserProfileLike | null = null) {
  return normalizeSeasonList(userProfile?.season).includes("summer");
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function getItemColors(items: SwimwearCandidate[], category: string) {
  return dedupeStrings(
    items
      .filter((item) => item?.category === category)
      .flatMap((item) => Array.isArray(item?.color_base) ? item.color_base : [])
      .map((value) => String(value || "").trim().toLowerCase())
  );
}

function formatItemColor(item: SwimwearCandidate) {
  const colorParts = [];

  if (Array.isArray(item?.color_base) && item.color_base.length > 0) {
    colorParts.push(item.color_base.join(", "));
  }

  if (typeof item?.pattern === "string" && item.pattern.trim().length > 0) {
    colorParts.push(item.pattern.trim());
  }

  if (item?.is_neutral) {
    colorParts.push("neutral");
  }

  return colorParts.join(", ") || "not specified";
}

function sanitizeProductRow(item: unknown): SwimwearCandidate | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const normalized = { ...(item as Record<string, unknown>) } as Record<string, unknown>;
  delete normalized.embedding;
  delete normalized.distance;
  return normalized;
}

function toWardrobeUiItem(item: SwimwearCandidate) {
  return {
    id: item?.id ?? null,
    url: item?.url ?? "",
    name: item?.name ?? "",
    category: item?.category ?? "",
    image_url: item?.image_url ?? "",
    audience: item?.audience ?? ""
  };
}

function buildBottomsContext(selectedCapsuleItems: SwimwearCandidate[]) {
  const bottoms = selectedCapsuleItems.filter((item) => item?.category === "bottom");

  return bottoms
    .map((item, index) => `${index + 1}. ${item?.name || "Unnamed item"} (Color: ${formatItemColor(item)}) - ID: ${item?.id ?? "unknown"}`)
    .join("\n");
}

function buildSwimwearCandidatesPayload(candidates: SwimwearCandidate[]) {
  return JSON.stringify(
    candidates.map((item) => ({
      id: item?.id ?? null,
      name: item?.name ?? "",
      swimwear_type: item?.swimwear_type ?? "swimsuit",
      color: formatItemColor(item),
      pattern: typeof item?.pattern === "string" && item.pattern.trim().length > 0 ? item.pattern.trim() : "solid",
      style: Array.isArray(item?.style) ? item.style : []
    })),
    null,
    2
  );
}

function getSwimwearPrompt(selectedCapsuleItems: SwimwearCandidate[], candidates: SwimwearCandidate[]) {
  return renderPromptTemplateContent(PROMPT_TEMPLATE, {
    bottoms_context: buildBottomsContext(selectedCapsuleItems),
    swimwear_candidates: buildSwimwearCandidatesPayload(candidates)
  }, "swimwear prompt");
}

function getSwimwearSystemPrompt() {
  return SYSTEM_PROMPT_TEMPLATE;
}

function normalizeSelectedSwimwearIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeStrings(value.map((item) => String(item || "").trim()));
}

function normalizeSwimwearSelection(selectedIds: unknown, candidates: SwimwearCandidate[]) {
  const candidateMap = new Map(candidates.map((item) => [String(item.id), item]));
  const selected = normalizeSelectedSwimwearIds(selectedIds)
    .map((id) => candidateMap.get(id))
    .filter(Boolean);

  const swimsuit = selected.find((item) => item?.swimwear_type === "swimsuit");
  if (swimsuit) {
    return [swimsuit];
  }

  const top = selected.find((item) => item?.swimwear_type === "swimwear_top");
  const bottom = selected.find((item) => item?.swimwear_type === "swimwear_bottom");

  if (top && bottom) {
    return [top, bottom];
  }

  if (top) {
    const fallbackBottom = candidates.find((item) => item?.swimwear_type === "swimwear_bottom" && String(item.id) !== String(top.id));
    return fallbackBottom ? [top, fallbackBottom] : [];
  }

  if (bottom) {
    const fallbackTop = candidates.find((item) => item?.swimwear_type === "swimwear_top" && String(item.id) !== String(bottom.id));
    return fallbackTop ? [fallbackTop, bottom] : [];
  }

  return [];
}

function selectSwimwearWithoutLlm(candidates: SwimwearCandidate[]) {
  return normalizeSwimwearSelection(
    candidates.map((item) => String(item?.id || "").trim()).filter(Boolean),
    candidates
  );
}

async function selectMaleSwimwear({
  sql,
  targetStyle,
  topColors,
  embeddingVector,
  logContext = null
}: {
  sql: ReturnType<typeof getSqlClient>;
  targetStyle: string | null;
  topColors: string[];
  embeddingVector: string;
  logContext?: { capsuleRequestId?: string | null } | null;
}) {
  const sqlStartedAt = Date.now();
  const rows = await sql`
    SELECT
      *,
      (embedding <=> ${embeddingVector}::vector) AS distance
    FROM products
    WHERE
      category = 'swimwear'
      AND lower(COALESCE(audience, '')) = 'man'
    ORDER BY
      (
        CASE WHEN color_base && ${topColors}::text[] THEN 2 ELSE 0 END
        +
        CASE
          WHEN ${targetStyle}::text IS NOT NULL
            AND ${targetStyle}::text = ANY(COALESCE(style, ARRAY[]::text[]))
          THEN 1 ELSE 0
        END
      ) DESC,
      (embedding <=> ${embeddingVector}::vector) ASC
    LIMIT 1
  `;
  const candidates = (Array.isArray(rows) ? rows : [])
    .map(sanitizeProductRow)
    .filter(Boolean);

  logWardrobeInfo("swimwear-sql-completed", {
    swimwearSqlDurationMs: Date.now() - sqlStartedAt,
    swimwearCandidatesTotal: candidates.length,
    swimwearCandidatesByType: countItemsByKey(candidates, "category")
  }, logContext);

  return candidates;
}

async function selectFemaleSwimwear({
  sql,
  audience,
  targetStyle,
  bottomColors,
  embeddingVector,
  logContext = null
}: {
  sql: ReturnType<typeof getSqlClient>;
  audience: string;
  targetStyle: string | null;
  bottomColors: string[];
  embeddingVector: string;
  logContext?: { capsuleRequestId?: string | null } | null;
}) {
  const sqlStartedAt = Date.now();
  const rows = await sql`
    SELECT
      products.*,
      CASE
        WHEN name ILIKE '%swimsuit%' THEN 'swimsuit'
        WHEN name ILIKE '%tankini%' OR name ILIKE '%bikini top%' THEN 'swimwear_top'
        WHEN name ~* '(bikini bottoms|bikini bottom|bikini briefs|hipsters|tanga|thong)' THEN 'swimwear_bottom'
        ELSE 'swimsuit'
      END AS swimwear_type,
      (embedding <=> ${embeddingVector}::vector) AS distance
    FROM products
    WHERE
      category = 'swimwear'
      AND lower(COALESCE(audience, '')) = lower(${audience}::text)
    ORDER BY
      (
        CASE WHEN color_base && ${bottomColors}::text[] THEN 2 ELSE 0 END
        +
        CASE
          WHEN ${targetStyle}::text IS NOT NULL
            AND ${targetStyle}::text = ANY(COALESCE(style, ARRAY[]::text[]))
          THEN 1 ELSE 0
        END
      ) DESC,
      (embedding <=> ${embeddingVector}::vector) ASC
    LIMIT 12
  `;
  const candidates = (Array.isArray(rows) ? rows : [])
    .map(sanitizeProductRow)
    .filter(Boolean);

  logWardrobeInfo("swimwear-sql-completed", {
    swimwearSqlDurationMs: Date.now() - sqlStartedAt,
    swimwearCandidatesTotal: candidates.length,
    swimwearCandidatesByType: countItemsByKey(candidates, "swimwear_type")
  }, logContext);

  return candidates;
}

async function generateFemaleSwimwear({
  userProfile,
  selectedCapsuleItems,
  promptEmbeddings,
  logContext = null
}: {
  userProfile: UserProfileLike | null;
  selectedCapsuleItems: SwimwearCandidate[];
  promptEmbeddings: number[];
  logContext?: { capsuleRequestId?: string | null } | null;
}) {
  const llmResolution = resolveLlmProvider(userProfile);
  const sql = getSqlClient();
  const embeddingVector = `[${promptEmbeddings.join(",")}]`;
  const targetStyle = userProfile?.style ?? null;
  const bottomColors = getItemColors(selectedCapsuleItems, "bottom");
  const candidates = await selectFemaleSwimwear({
    sql,
    audience: userProfile?.audience || "woman",
    targetStyle,
    bottomColors,
    embeddingVector,
    logContext
  });

  if (candidates.length === 0) {
    return {
      items: [],
      reasoning: null,
      rawSelectionText: null
    };
  }

  if (isNoLlmProfileEnabled(userProfile)) {
    logWardrobeInfo("swimwear-llm-skipped", {
      reason: "profile_llm_none",
      requestedLlm: llmResolution.requestedLlm,
      usedModel: null
    }, logContext);
    const selectedItems = selectSwimwearWithoutLlm(candidates);
    logWardrobeInfo("swimwear-nollm-completed", {
      swimwearItemsTotal: selectedItems.length,
      swimwearItemsByCategory: countItemsByKey(selectedItems)
    }, logContext);

    return {
      items: selectedItems.map(toWardrobeUiItem),
      reasoning: null,
      rawSelectionText: null
    };
  }

  const prompt = getSwimwearPrompt(selectedCapsuleItems, candidates);
  const llmStartedAt = Date.now();
  const generateJsonWithLlm = getGenerateJsonWithLlm(userProfile);
  const { response, json } = await generateJsonWithLlm(prompt, {
    userProfile,
    format: buildCustomJsonObjectFormat(
      "capsule_swimwear_response",
      "Structured swimwear selection with a brief reasoning and one valid swimsuit or a matching two-piece set.",
      buildSwimwearSchema()
    ),
    systemPrompt: getSwimwearSystemPrompt()
  });
  logWardrobeInfo("swimwear-llm-completed", {
    llmProvider: llmResolution.provider,
    llmModel: llmResolution.model,
    requestedLlm: llmResolution.requestedLlm,
    fallbackReason: llmResolution.fallbackReason,
    swimwearLlmDurationMs: Date.now() - llmStartedAt,
    ...extractLlmUsage(response?.usage)
  }, logContext);

  const selectedItems = normalizeSwimwearSelection(json?.swimwear, candidates);
  logWardrobeInfo("swimwear-completed", {
    swimwearItemsTotal: selectedItems.length,
    swimwearItemsByCategory: countItemsByKey(selectedItems)
  }, logContext);

  return {
    items: selectedItems.map(toWardrobeUiItem),
    reasoning: typeof json?._reasoning === "string" && json._reasoning.trim().length > 0
      ? json._reasoning.trim()
      : null,
    rawSelectionText: typeof response?.output_text === "string" && response.output_text.trim().length > 0
      ? response.output_text.trim()
      : null
  };
}

async function generateSwimwearAddition({
  userProfile,
  selectedCapsuleItems,
  promptEmbeddings,
  logContext = null
}: {
  userProfile: UserProfileLike | null;
  selectedCapsuleItems: SwimwearCandidate[];
  promptEmbeddings: number[];
  logContext?: { capsuleRequestId?: string | null } | null;
}) {
  if (!shouldGenerateSwimwear(userProfile)) {
    return {
      items: [],
      reasoning: null,
      rawSelectionText: null
    };
  }

  const sql = getSqlClient();
  const embeddingVector = `[${promptEmbeddings.join(",")}]`;
  const targetStyle = userProfile?.style ?? null;

  if (userProfile?.audience === "woman") {
    return generateFemaleSwimwear({ userProfile, selectedCapsuleItems, promptEmbeddings, logContext });
  }

  const topColors = getItemColors(selectedCapsuleItems, "top");
  const items = await selectMaleSwimwear({
    sql,
    targetStyle,
    topColors,
    embeddingVector,
    logContext
  });
  logWardrobeInfo("swimwear-completed", {
    swimwearItemsTotal: items.length,
    swimwearItemsByCategory: countItemsByKey(items)
  }, logContext);

  return {
    items: items.map(toWardrobeUiItem),
    reasoning: null,
    rawSelectionText: null
  };
}

export {
  generateSwimwearAddition,
  getSwimwearPrompt,
  getSwimwearSystemPrompt,
  shouldGenerateSwimwear,
  normalizeSwimwearSelection
};
