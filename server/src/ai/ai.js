import { getProfile, updateProfileItems } from "../profileStore.js";
import { getSqlClient } from "../db.js";
import { readFileSync, writeFileSync } from "node:fs";
import en from "../../../shared/i18n/en.js";
import { generateJsonWithLlm } from "./openai.js";
import {  getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { buildStylePreferenceArray } from "../../../shared/stylePreferences.js";

const CATEGORIES = {
  bottom: 2,
  top: 2,
  outerwear: 1,
  shoes: 2,
  belt: 1,
  bag: 2
};
const PROMPT_TEMPLATE = readFileSync(new URL("../templates/prompt.txt", import.meta.url), "utf8");

function localizeProfileValues(values, dictionary) {
  if (!Array.isArray(values) || values.length === 0) {
    return "Not specified";
  }

  const localized = values
    .map((value) => dictionary[value] || value)
    .filter((value) => typeof value === "string" && value.trim().length > 0);
  if (localized.length === 0) {
    return "Not specified";
  }

  return localized.join(", ").toLowerCase();
}

function getLocalizedStyleText(userProfile = null) {
  return localizeProfileValues(
    buildStylePreferenceArray(userProfile?.formalityLevel, userProfile?.style),
    en.options.styles
  );
}

function getLocalizedFormalityText(userProfile = null) {
  const formalityLevel = userProfile?.formalityLevel;
  if (typeof formalityLevel !== "string" || formalityLevel.trim().length === 0) {
    return "Not specified";
  }

  return en.options.styles[formalityLevel] || formalityLevel;
}

function getCategoryListText() {
  return Object.entries(CATEGORIES)
    .filter(([, count]) => Number.isInteger(count) && count > 0)
    .map(([category, count]) => `${count} ${category}`)
    .join(", ");
}

function getCategorySchema() {
  const schema = Object.entries(CATEGORIES).reduce((result, [category, count]) => {
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

function enforceCategoryCounts(selectedItems, normalizedItems) {
  const categoryOrder = Object.keys(CATEGORIES);
  const allowedCategories = new Set(categoryOrder);
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

  for (const category of categoryOrder) {
    const requiredCount = CATEGORIES[category];
    const current = selectedByCategory.get(category).slice(0, requiredCount);
    for (const item of current) {
      const itemId = String(item.id);
      if (resultIds.has(itemId)) continue;
      result.push(item);
      resultIds.add(itemId);
    }
  }

  for (const category of categoryOrder) {
    const requiredCount = CATEGORIES[category];
    const currentCount = result.filter((item) => item.category === category).length;
    const missing = requiredCount - currentCount;
    if (missing <= 0) {
      continue;
    }

    const candidates = poolByCategory.get(category);
    let added = 0;
    for (const candidate of candidates) {
      const itemId = String(candidate.id);
      if (resultIds.has(itemId)) {
        continue;
      }
      result.push(candidate);
      resultIds.add(itemId);
      added += 1;
      if (added >= missing) {
        break;
      }
    }
  }

  return result;
}

function getWardrobeSelectionPrompt(userProfile = null, items = []) {
  const formalityText = getLocalizedFormalityText(userProfile);
  const styleText = getLocalizedStyleText(userProfile);
  const occasionsText = localizeProfileValues(userProfile?.occasions, en.options.occasions);
  const seasonText = localizeProfileValues(userProfile?.season, en.options.seasons);
  const audienceText = userProfile?.audience || "any";
  const accentColorText = typeof userProfile?.color === "string" ? userProfile.color : "";
  const patternText = typeof userProfile?.pattern === "string" ? userProfile.pattern : "";
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
      season: Array.isArray(item?.season) ? item.season.join(", ") : "",
      materials: item?.composition ?? "",
      occasions: Array.isArray(item?.occasions) ? item.occasions.join(", ") : "",
      fit: typeof item?.fit === "string" ? item.fit.trim() : "",
      silhouette: typeof item?.silhouette === "string" ? item.silhouette.trim() : ""
    };
  });
  const itemsJson = JSON.stringify(simplifiedItems, null, 2);

  return PROMPT_TEMPLATE
    .replace("{{formality_level}}", formalityText)
    .replace("{{style}}", styleText)
    .replace("{{occasions}}", occasionsText)
    .replace("{{season}}", seasonText)
    .replace("{{audience}}", audienceText)
    .replace("{{color}}", accentColorText)
    .replace("{{pattern}}", patternText)
    .replace("{{items}}", itemsJson)
    .replace("{{category_list}}", getCategoryListText())
    .replace("{{categories_schema}}", getCategorySchema())
    .replace("{{num_items}}", Object.entries(CATEGORIES).reduce((sum, [, count]) => sum + count, 0));
}

async function callWardrobeAi(userProfile = null) {
  const sql = getSqlClient();
  const prompt = getWardrobePrompt(userProfile);
  const promptEmbeddings = await getPromptEmbeddings(prompt);

  const categories = Object.keys(CATEGORIES);
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
  const pattern = userProfile?.pattern ?? null;
  const embeddingVector = `[${promptEmbeddings.join(",")}]`;
  const noiseFactor = 0.05;

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
              PARTITION BY is_pattern_match
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
                ${pattern}::text IS NOT NULL
                AND ${pattern}::text != ''
                -- Small tip: make sure to lower() both sides for safety if patterns are manually entered
                AND lower(COALESCE(pattern, '')) = lower(${pattern}::text)
              ) as is_pattern_match,
              
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
            is_pattern_match IS NOT TRUE 
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

  const normalizedItems = items.map((item) => {
    const normalized = { ...item };
    delete normalized.embedding;
    return normalized;
  });

  const selectionPrompt = getWardrobeSelectionPrompt(userProfile, normalizedItems);
  writeFileSync(new URL("../../../last_prompt.txt", import.meta.url), selectionPrompt, "utf8");
  const { response: selectionResponse, json: parsedSelection } = await generateJsonWithLlm(selectionPrompt);

  console.log("[wardrobe-ai][selected-json]", JSON.stringify(parsedSelection));

  const selectedIds = getSelectedIdsFromCapsule(parsedSelection?.capsule);
  const uniqueSelectedIds = [...new Set(selectedIds.map((id) => String(id)))];
  const itemsById = new Map(normalizedItems.map((item) => [String(item.id), item]));
  const selectedItems = uniqueSelectedIds
    .map((id) => itemsById.get(String(id)))
    .filter(Boolean);
  const balancedItems = enforceCategoryCounts(selectedItems, normalizedItems);

  if (balancedItems.length === 0) {
    throw new Error("Model returned no valid selected_ids");
  }

  return {
    items: balancedItems.map(({ url, name, category, image_url }) => {
      return { url, name, category, image_url };
    }),
    reasoning: typeof parsedSelection?._reasoning === "string" && parsedSelection._reasoning.trim().length > 0
      ? parsedSelection._reasoning.trim()
      : null
  };
}

async function getWardrobeItems(req, res) {
  try {
    const forceRefresh = Boolean(req.body?.force);
    const profile = await getProfile(req.user.email);
    if (!forceRefresh && profile && Array.isArray(profile.items) && profile.items.length > 0) {
      return res.json({ ok: true, items: profile.items, reasoning: null });
    }

    if (forceRefresh && profile) {
      await updateProfileItems(req.user.email, null);
    }

    const wardrobe = await callWardrobeAi(profile);
    const items = wardrobe.items;

    if (items.length === 0) {
      throw new Error("AI response has no valid wardrobe items");
    }

    if (profile) {
      await updateProfileItems(req.user.email, items);
    }

    return res.json({ ok: true, items, reasoning: wardrobe.reasoning });
  } catch (error) {
    console.error("[wardrobe-ai]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
}

export { getWardrobeItems };
