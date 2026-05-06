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
import { countItemsByKey, extractLlmUsage, logWardrobeInfo } from "./swimwearLogging.js";
import type { SwimwearCandidate, UserProfileLike } from "./types.js";
import {
  dedupeStrings,
  formatItemColor,
  getItemColors,
  sanitizeProductRow,
  shouldGenerateSwimwear,
  toWardrobeUiItem
} from "./swimwearUtils.js";

const SWIMWEAR_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_woman_swimwear.yaml", import.meta.url)
);
const PROMPT_TEMPLATE = getPromptTemplateContent(SWIMWEAR_PROMPT_TEMPLATE, "user");
const SYSTEM_PROMPT_TEMPLATE = getPromptTemplateContent(SWIMWEAR_PROMPT_TEMPLATE, "system");

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

function buildEmptySwimwearResult() {
  return {
    items: [],
    reasoning: null,
    rawSelectionText: null
  };
}

function getTrimmedText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function buildSwimwearResult(selectedItems: SwimwearCandidate[], reasoning = null, rawSelectionText = null) {
  return {
    items: selectedItems.map(toWardrobeUiItem),
    reasoning,
    rawSelectionText
  };
}

function selectFemaleSwimwearWithoutLlm(candidates, llmResolution, logContext) {
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

  return buildSwimwearResult(selectedItems);
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
    return buildEmptySwimwearResult();
  }

  if (isNoLlmProfileEnabled(userProfile)) {
    return selectFemaleSwimwearWithoutLlm(candidates, llmResolution, logContext);
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

  return buildSwimwearResult(
    selectedItems,
    getTrimmedText(json?._reasoning),
    getTrimmedText(response?.output_text)
  );
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
    return buildEmptySwimwearResult();
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
