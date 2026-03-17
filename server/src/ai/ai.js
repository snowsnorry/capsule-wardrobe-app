import { getProfile, updateProfileItems } from "../profileStore.js";
import { getSqlClient } from "../db.js";
import { readFileSync, writeFileSync } from "node:fs";
import { generateJsonWithLlm } from "./openai.js";
import {  getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { CATEGORIES } from "./categories.js";
const PROMPT_TEMPLATE = readFileSync(new URL("../templates/prompt.txt", import.meta.url), "utf8");

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

/**
 * Normalizes raw material strings into stylist-friendly texture tags.
 * @param {string} rawMaterials - The raw materials string from the database.
 * @returns {string} A comma-separated string of clean material tags.
 */
function normalizeMaterials(rawMaterials) {
  if (!rawMaterials || typeof rawMaterials !== 'string') return "";
  
  const text = rawMaterials.toLowerCase();
  const tags = new Set(); // Using Set to avoid duplicates (e.g., if cotton and linen are both found)

  // 1. Leather & Suede
  if (text.match(/suede/)) {
    tags.add("suede");
  } else if (text.match(/leather|nappa|lambskin|furskin/)) {
    tags.add("leather");
  }

  // 2. Wool & Knits
  if (text.match(/wool|cashmere|alpaca|mohair|yak/)) {
    tags.add("wool");
  }

  // 3. Cotton
  if (text.includes("cotton")) {
    tags.add("cotton");
  }

  // 4. Linen & Hemp
  if (text.match(/linen|hemp|jute|ramie/)) {
    tags.add("linen");
  }

  // 5. Silk & Flowing
  if (text.match(/silk|viscose|cupro|modal|lyocell|acetate|cellulose/)) {
    tags.add("silk/viscose");
  }

  // 6. Insulation (Down/Feathers)
  if (text.match(/down|feather/)) {
    tags.add("down insulation");
  }

  // 7. Tech & Synthetic (Only apply if no "natural" fabric was found, or if it's explicitly highly synthetic)
  // We check if the set is empty, or if we want to explicitly highlight a tech fabric blend.
  if (text.match(/polyamide|polyurethane|nylon/) && !text.includes("cotton") && !text.includes("wool")) {
     tags.add("technical fabric");
  }

  return Array.from(tags).join(", ");
}

function getWardrobeSelectionPrompt(userProfile = null, items = []) {
  const formalityText = typeof userProfile?.formalityLevel === "string" && userProfile.formalityLevel.trim().length > 0
    ? userProfile.formalityLevel
    : "Not specified";
  const styleText = typeof userProfile?.style === "string" && userProfile.style.trim().length > 0
    ? userProfile.style
    : "Not specified";
  const occasionsText = formatProfileValues(userProfile?.occasions);
  const seasonText = formatProfileValues(userProfile?.season);
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
      materials: normalizeMaterials(item?.composition),
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
    rawSelectionText: typeof selectionResponse?.output_text === "string" && selectionResponse.output_text.trim().length > 0
      ? selectionResponse.output_text.trim()
      : null,
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
      return res.json({ ok: true, items: profile.items, reasoning: null, rawSelectionText: null });
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

    return res.json({
      ok: true,
      items,
      reasoning: wardrobe.reasoning,
      rawSelectionText: wardrobe.rawSelectionText
    });
  } catch (error) {
    console.error("[wardrobe-ai]", error);
    return res.status(503).json({
      error: "service_unavailable",
      rawSelectionText: typeof error?.rawSelectionText === "string" && error.rawSelectionText.trim().length > 0
        ? error.rawSelectionText.trim()
        : null
    });
  }
}

export { getWardrobeItems };
