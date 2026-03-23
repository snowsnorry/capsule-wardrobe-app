import { readFileSync } from "node:fs";
import { getSqlClient } from "../db.js";
import {
  buildCustomJsonObjectFormat,
  buildSwimwearSchema,
  generateJsonWithLlm
} from "./openai.js";

const PROMPT_TEMPLATE = readFileSync(new URL("../templates/prompt_woman_swimwear.txt", import.meta.url), "utf8");

function normalizeSeasonList(season) {
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

function shouldGenerateSwimwear(userProfile = null) {
  return normalizeSeasonList(userProfile?.season).includes("summer");
}

function dedupeStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function getItemColors(items, category) {
  return dedupeStrings(
    items
      .filter((item) => item?.category === category)
      .flatMap((item) => Array.isArray(item?.color_base) ? item.color_base : [])
      .map((value) => String(value || "").trim().toLowerCase())
  );
}

function formatItemColor(item) {
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

function sanitizeProductRow(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const normalized = { ...item };
  delete normalized.embedding;
  delete normalized.distance;
  return normalized;
}

function toWardrobeUiItem(item) {
  return {
    id: item?.id ?? null,
    url: item?.url ?? "",
    name: item?.name ?? "",
    category: item?.category ?? "",
    image_url: item?.image_url ?? ""
  };
}

function buildBottomsContext(selectedCapsuleItems) {
  const bottoms = selectedCapsuleItems.filter((item) => item?.category === "bottom");

  return bottoms
    .map((item, index) => `${index + 1}. ${item?.name || "Unnamed item"} (Color: ${formatItemColor(item)}) - ID: ${item?.id ?? "unknown"}`)
    .join("\n");
}

function buildSwimwearCandidatesPayload(candidates) {
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

function getSwimwearPrompt(selectedCapsuleItems, candidates) {
  return PROMPT_TEMPLATE
    .replace("{{bottoms_context}}", buildBottomsContext(selectedCapsuleItems))
    .replace("{{swimwear_candidates}}", buildSwimwearCandidatesPayload(candidates));
}

function normalizeSelectedSwimwearIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeStrings(value.map((item) => String(item || "").trim()));
}

function normalizeSwimwearSelection(selectedIds, candidates) {
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

async function selectMaleSwimwear({ sql, targetStyle, topColors, embeddingVector }) {
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

  return rows
    .map(sanitizeProductRow)
    .filter(Boolean);
}

async function selectFemaleSwimwear({
  sql,
  audience,
  targetStyle,
  bottomColors,
  embeddingVector
}) {
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

  return rows
    .map(sanitizeProductRow)
    .filter(Boolean);
}

async function generateFemaleSwimwear({ userProfile, selectedCapsuleItems, promptEmbeddings }) {
  const sql = getSqlClient();
  const embeddingVector = `[${promptEmbeddings.join(",")}]`;
  const targetStyle = userProfile?.style ?? null;
  const bottomColors = getItemColors(selectedCapsuleItems, "bottom");
  const candidates = await selectFemaleSwimwear({
    sql,
    audience: userProfile?.audience || "woman",
    targetStyle,
    bottomColors,
    embeddingVector
  });

  if (candidates.length === 0) {
    return {
      items: [],
      reasoning: null,
      rawSelectionText: null
    };
  }

  const prompt = getSwimwearPrompt(selectedCapsuleItems, candidates);
  const { response, json } = await generateJsonWithLlm(prompt, {
    format: buildCustomJsonObjectFormat(
      "capsule_swimwear_response",
      "Structured swimwear selection with a brief reasoning and one valid swimsuit or a matching two-piece set.",
      buildSwimwearSchema()
    )
  });

  const selectedItems = normalizeSwimwearSelection(json?.swimwear, candidates);

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

async function generateSwimwearAddition({ userProfile, selectedCapsuleItems, promptEmbeddings }) {
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
    return generateFemaleSwimwear({ userProfile, selectedCapsuleItems, promptEmbeddings });
  }

  const topColors = getItemColors(selectedCapsuleItems, "top");
  const items = await selectMaleSwimwear({
    sql,
    targetStyle,
    topColors,
    embeddingVector
  });

  return {
    items: items.map(toWardrobeUiItem),
    reasoning: null,
    rawSelectionText: null
  };
}

export {
  generateSwimwearAddition,
  shouldGenerateSwimwear,
  normalizeSwimwearSelection
};
