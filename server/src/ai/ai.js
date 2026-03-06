import { getProfile, updateProfileWardrobeItems } from "../profileStore.js";
import { getSqlClient } from "../db.js";
import { readFileSync, writeFileSync } from "node:fs";
import en from "../../../shared/i18n/en.js";
import { generateJsonWithLlm, getPromptEmbeddings } from "./openai.js";

const CATEGORIES = {
  bottom: 2,
  top: 2,
  outerwear: 1,
  shoes: 2,
  belt: 1,
  bag: 2
};
const PROMPT_TEMPLATE = readFileSync(new URL("../templates/prompt.txt", import.meta.url), "utf8");

const ARRAY_FIELDS = ["closure_type", "color_base", "formality_level", "occasions", "season", "style_tags"];

function parseArrayField(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

function getWardrobePrompt(userProfile = null) {
  const stylePreferencesText = localizeProfileValues(userProfile?.stylePreferences, en.options.styles);
  const wardrobeOccasionsText = localizeProfileValues(userProfile?.wardrobeOccasions, en.options.occasions);
  const seasonsText = localizeProfileValues(userProfile?.wardrobeSeasons, en.options.seasons);
  const audienceMap = {
    man: "man, all",
    woman: "woman, all",
    any: "man, woman, all"
  };
  const audienceText = audienceMap[userProfile?.wardrobeAudience] || audienceMap.any;
  
  return `Capsule wardrobe request.
  
Formality: ${stylePreferencesText}
Occasions: ${wardrobeOccasionsText}
Season: ${seasonsText}
Audience: ${audienceText}

Balanced and cohesive wardrobe.`;
}

function getCategoryListText() {
  return Object.entries(CATEGORIES)
    .filter(([, count]) => Number.isInteger(count) && count > 0)
    .map(([category, count]) => `${count} ${category}`)
    .join(", ");
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
  const formalityText = localizeProfileValues(userProfile?.stylePreferences, en.options.styles);
  const occasionsText = localizeProfileValues(userProfile?.wardrobeOccasions, en.options.occasions);
  const seasonText = localizeProfileValues(userProfile?.wardrobeSeasons, en.options.seasons);
  const audienceText = userProfile?.wardrobeAudience || "any";
  const simplifiedItems = items.map((item) => {
    const colorParts = [
      Array.isArray(item?.color_base) ? item.color_base.join(", ") : "",
      typeof item?.pattern === "string" ? item.pattern.trim() : "",
      typeof item?.finish === "string" ? item.finish.trim() : ""
    ].filter((value) => value);
    const styleParts = [
      Array.isArray(item?.style_tags) ? item.style_tags.join(", ") : "",
      typeof item?.fit === "string" ? item.fit.trim() : "",
      typeof item?.silhouette === "string" ? item.silhouette.trim() : ""
    ].filter((value) => value);

    return {
      id: item?.id ?? null,
      name: item?.name ?? "",
      type: item?.category ?? "",
      color: colorParts.join(", "),
      style: styleParts.join(", "),
      materials: item?.composition ?? "",
      vibe: Array.isArray(item?.occasions) ? item.occasions.join(", ") : ""
    };
  });
  const itemsJson = JSON.stringify(simplifiedItems, null, 2);

  return PROMPT_TEMPLATE
    .replace("{{formality}}", formalityText)
    .replace("{{occasions}}", occasionsText)
    .replace("{{season}}", seasonText)
    .replace("{{audience}}", audienceText)
    .replace("{{items}}", itemsJson)
    .replace("{{category_list}}", getCategoryListText())
    .replace("{{num_items}}", Object.entries(CATEGORIES).reduce((sum, [, count]) => sum + count, 0))
    .concat("\n\nReturn strictly valid JSON only. No markdown, no extra text.");
}

async function callWardrobeAi(userProfile = null) {
  const sql = getSqlClient();
  const prompt = getWardrobePrompt(userProfile);
  const promptEmbeddings = await getPromptEmbeddings(prompt);

  const categories = Object.keys(CATEGORIES);
  const stylePreferences = Array.isArray(userProfile?.stylePreferences) ? userProfile.stylePreferences : [];
  const wardrobeOccasions = Array.isArray(userProfile?.wardrobeOccasions) ? userProfile.wardrobeOccasions : [];
  const wardrobeSeasons = Array.isArray(userProfile?.wardrobeSeasons) ? userProfile.wardrobeSeasons : [];
  const audienceByProfile = {
    man: ["man", "all"],
    woman: ["woman", "all"],
    any: ["man", "woman", "all"]
  };
  const audienceFilters = audienceByProfile[userProfile?.wardrobeAudience] || audienceByProfile.any;
  const embeddingVector = `[${promptEmbeddings.join(",")}]`;
  const noiseFactor = 0.05;

  const items = await sql`
    SELECT results.*
    FROM unnest(${categories}::text[]) AS cats(target_category)
    CROSS JOIN LATERAL (
      SELECT * FROM (
        SELECT 
          scored_items.*,
          -- 3. Calculate Rank within a color family, based on the calculated Relevance Score.
          -- This ensures that the "Best" item (highest score) of a specific color gets Rank 1.
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(color_base, ARRAY[]::text[])
            ORDER BY 
              relevance_score DESC, 
              (distance + (RANDOM() * ${noiseFactor}::float)) ASC
          ) as color_rank
        FROM (
          SELECT
            products.*,
            -- 1. Calculate Vector Distance (lower is closer/better)
            embedding <=> ${embeddingVector}::vector as distance,
            
            -- 2. Calculate Relevance Score (Soft Filters)
            -- Instead of filtering out items, we give them points.
            (
              -- Style Match: +20 points
              CASE WHEN COALESCE(formality_level, ARRAY[]::text[]) && ${stylePreferences}::text[]
              THEN 20 ELSE 0 END
              +
              -- Occasion Match: +20 points
              CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && ${wardrobeOccasions}::text[]
              THEN 20 ELSE 0 END
              +
              -- Season Match: +50 points (High priority)
              -- OR Fallback: +40 points if the item has NO season specified (e.g., watches, bags)
              CASE WHEN COALESCE(season, ARRAY[]::text[]) && ${wardrobeSeasons}::text[] THEN 50 
              WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
              ELSE 0 END
            ) as relevance_score

          FROM products
          WHERE 
            -- HARD FILTERS: Apply only strictly necessary constraints here.
            category = cats.target_category
            AND lower(COALESCE(audience, '')) = ANY(${audienceFilters}::text[])
        ) scored_items
      ) ranked_items
      
      -- 4. FINAL SORTING STRATEGY
      -- Priority 1: High Relevance (Items that match season/style/occasion).
      -- Priority 2: Diversity (Show Rank 1 of every color before showing Rank 2).
      -- Priority 3: Vector Distance (Tie-breaker).
      ORDER BY 
        relevance_score DESC, 
        color_rank ASC,       
        (distance + (RANDOM() * ${noiseFactor}::float)) ASC
      LIMIT 10
    ) results`;

  const normalizedItems = items.map((item) => {
    const normalized = { ...item };
    for (const field of ARRAY_FIELDS) {
      normalized[field] = parseArrayField(normalized[field]);
    }
    delete normalized.embedding;
    return normalized;
  });

  const selectionPrompt = getWardrobeSelectionPrompt(userProfile, normalizedItems);
  writeFileSync(new URL("../../../last_prompt.txt", import.meta.url), selectionPrompt, "utf8");
  const { response: selectionResponse, json: parsedSelection } = await generateJsonWithLlm(selectionPrompt);

  console.log("[wardrobe-ai][selected-json]", JSON.stringify(parsedSelection));

  const selectedIds = Array.isArray(parsedSelection?.selected_ids) ? parsedSelection.selected_ids : [];
  const uniqueSelectedIds = [...new Set(selectedIds.map((id) => String(id)))];
  const itemsById = new Map(normalizedItems.map((item) => [String(item.id), item]));
  const selectedItems = uniqueSelectedIds
    .map((id) => itemsById.get(String(id)))
    .filter(Boolean);
  const balancedItems = enforceCategoryCounts(selectedItems, normalizedItems);

  if (balancedItems.length === 0) {
    throw new Error("Model returned no valid selected_ids");
  }

  return balancedItems.map(({url, name, category, image_url}) => {
    return { url, name, category, image_url };
  });
}

async function getWardrobeItems(req, res) {
  try {
    const forceRefresh = Boolean(req.body?.force);
    const profile = await getProfile(req.user.email);
    if (!forceRefresh && profile && Array.isArray(profile.wardrobeItems) && profile.wardrobeItems.length > 0) {
      return res.json({ ok: true, items: profile.wardrobeItems });
    }

    if (forceRefresh && profile) {
      await updateProfileWardrobeItems(req.user.email, null);
    }

    let items = await callWardrobeAi(profile);

    if (items.length === 0) {
      throw new Error("AI response has no valid wardrobe items");
    }

    if (profile) {
      await updateProfileWardrobeItems(req.user.email, items);
    }

    return res.json({ ok: true, items: items });
  } catch (error) {
    console.error("[wardrobe-ai]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
}

export { getWardrobeItems };
