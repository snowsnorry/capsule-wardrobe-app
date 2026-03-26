import crypto from "node:crypto";
import { getProfile, updateProfileItems } from "../profileStore.js";
import { getSqlClient } from "../db.js";
import { readFileSync, writeFileSync } from "node:fs";
import { generateJsonWithLlm } from "./openai.js";
import {  getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import { getCapsuleCategories } from "./categories.js";
import { generateSwimwearAddition, shouldGenerateSwimwear } from "./swimwear.js";
import { buildPromptDebugImagesInChild } from "./promptImages.js";
import {
  getProcessMemoryUsage,
  runWithImageWorkSlot,
  sumCategoryBytes
} from "./imagePipeline.js";
const PROMPT_TEMPLATE = readFileSync(new URL("../templates/prompt.txt", import.meta.url), "utf8");
const WARDROBE_POLL_AFTER_MS = 2000;
const COMPLETED_JOB_TTL_MS = 5 * 60 * 1000;
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

function getStoredWardrobePayload(profile) {
  const stored = profile?.items;
  if (Array.isArray(stored)) {
    return {
      items: stored,
      reasoning: null,
      rawSelectionText: null,
      swimwearReasoning: null,
      swimwearRawSelectionText: null
    };
  }

  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return null;
  }

  return {
    items: Array.isArray(stored.items) ? stored.items : [],
    reasoning: typeof stored.reasoning === "string" && stored.reasoning.trim().length > 0
      ? stored.reasoning.trim()
      : null,
    rawSelectionText: typeof stored.rawSelectionText === "string" && stored.rawSelectionText.trim().length > 0
      ? stored.rawSelectionText.trim()
      : null,
    swimwearReasoning: typeof stored.swimwearReasoning === "string" && stored.swimwearReasoning.trim().length > 0
      ? stored.swimwearReasoning.trim()
      : null,
    swimwearRawSelectionText: typeof stored.swimwearRawSelectionText === "string" && stored.swimwearRawSelectionText.trim().length > 0
      ? stored.swimwearRawSelectionText.trim()
      : null
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

function enforceCategoryCounts(selectedItems, normalizedItems, categories) {
  const categoryOrder = Object.keys(categories);
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
    const requiredCount = categories[category];
    const current = selectedByCategory.get(category).slice(0, requiredCount);
    for (const item of current) {
      const itemId = String(item.id);
      if (resultIds.has(itemId)) continue;
      result.push(item);
      resultIds.add(itemId);
    }
  }

  for (const category of categoryOrder) {
    const requiredCount = categories[category];
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
      materials: item?.composition || "",
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
    .replace("{{category_list}}", getCategoryListText(categories))
    .replace("{{categories_schema}}", getCategorySchema(categories))
    .replace("{{num_items}}", Object.entries(categories).reduce((sum, [, count]) => sum + count, 0));
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

function appendUniqueWardrobeItems(items, extraItems) {
  const result = [];
  const seenKeys = new Set();

  for (const item of [...items, ...extraItems]) {
    const key = String(item?.id || item?.url || `${item?.category}:${item?.name}`);
    if (!key || seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    result.push(item);
  }

  return result;
}

async function generateCapsuleWardrobe(userProfile = null, logContext = null) {
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
  const pattern = userProfile?.pattern ?? null;
  const embeddingVector = `[${promptEmbeddings.join(",")}]`;
  const noiseFactor = 0.05;

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
  const shouldSavePromptDebugArtifacts = process.env.NODE_ENV === "development";
  let promptDebugImages = { categories: [] };

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
      downloadedCount: promptDebugImages.downloadedCount || 0,
      skippedCount: promptDebugImages.skippedCount || 0,
      collageBytes: sumCategoryBytes(promptDebugImages.categories)
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
  writeFileSync(new URL("../../../last_prompt.txt", import.meta.url), selectionPrompt, "utf8");
  const llmStartedAt = Date.now();
  const { response: selectionResponse, json: parsedSelection } = await generateJsonWithLlm(selectionPrompt, {
    userProfile,
    images: promptDebugImages.categories,
    onPayloadBuilt: () => {
      promptDebugImages.categories = [];
    }
  });
  promptDebugImages.categories = [];
  logWardrobeInfo("capsule-llm-completed", {
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
  const balancedItems = enforceCategoryCounts(selectedItems, normalizedItems, capsuleCategories);

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
    reasoning: typeof parsedSelection?._reasoning === "string" && parsedSelection._reasoning.trim().length > 0
      ? parsedSelection._reasoning.trim()
      : null
  };
}

function hasStoredWardrobeItems(profile) {
  return Boolean(getStoredWardrobePayload(profile)?.items?.length);
}

function scheduleJobCleanup(email, job) {
  setTimeout(() => {
    if (wardrobeJobs.get(email) === job && job.status !== "pending") {
      wardrobeJobs.delete(email);
    }
  }, COMPLETED_JOB_TTL_MS);
}

function getWardrobeJob(email) {
  const job = wardrobeJobs.get(email);
  if (!job) {
    return null;
  }

  if (job.status !== "pending" && Date.now() - job.updatedAt > COMPLETED_JOB_TTL_MS) {
    wardrobeJobs.delete(email);
    return null;
  }

  return job;
}

function startWardrobeJob(email, profile, logContext = null) {
  const existing = getWardrobeJob(email);
  if (existing?.status === "pending") {
    return existing;
  }

  const capsuleRequestId = logContext?.capsuleRequestId || crypto.randomUUID();
  const startedAt = Date.now();
  const job = {
    capsuleRequestId,
    status: "pending",
    startedAt,
    updatedAt: Date.now(),
    promise: null,
    phase: "capsule",
    result: null
  };
  wardrobeJobs.set(email, job);

  job.promise = (async () => {
    const jobLogContext = {
      capsuleRequestId,
      startedAt
    };

    try {
      const wardrobe = await generateCapsuleWardrobe(profile, jobLogContext);
      const items = wardrobe.items;

      if (items.length === 0) {
        throw new Error("AI response has no valid wardrobe items");
      }

      const storedCapsule = buildWardrobePayload({
        items,
        reasoning: wardrobe.reasoning,
        rawSelectionText: wardrobe.rawSelectionText
      });
      await updateProfileItems(email, storedCapsule);
      logWardrobeInfo("capsule-base-completed", {
        baseDurationMs: Date.now() - startedAt,
        capsuleItemsTotal: items.length,
        capsuleItemsByCategory: countItemsByKey(items)
      }, jobLogContext);

      job.result = storedCapsule;

      if (shouldGenerateSwimwear(profile)) {
        job.phase = "extras";
        job.updatedAt = Date.now();

        try {
          const swimwear = await generateSwimwearAddition({
            userProfile: profile,
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

          await updateProfileItems(email, finalPayload);
          logWardrobeInfo("capsule-total-completed", {
            totalDurationMs: Date.now() - startedAt,
            itemsTotal: finalItems.length,
            itemsByCategory: countItemsByKey(finalItems)
          }, jobLogContext);
          job.result = finalPayload;
        } catch (error) {
          console.error("[wardrobe-ai][swimwear]", buildErrorLogContext(jobLogContext), error);
          logWardrobeInfo("capsule-total-completed", {
            totalDurationMs: Date.now() - startedAt,
            itemsTotal: items.length,
            itemsByCategory: countItemsByKey(items)
          }, jobLogContext);
        }
      } else {
        logWardrobeInfo("capsule-total-completed", {
          totalDurationMs: Date.now() - startedAt,
          itemsTotal: items.length,
          itemsByCategory: countItemsByKey(items)
        }, jobLogContext);
      }

      job.status = "completed";
      job.phase = "completed";
      job.updatedAt = Date.now();
    } catch (error) {
      job.status = "failed";
      job.phase = "failed";
      job.updatedAt = Date.now();
      job.error = error;
      console.error("[wardrobe-ai]", buildErrorLogContext(jobLogContext), error);
    } finally {
      scheduleJobCleanup(email, job);
    }
  })();

  return job;
}

async function getWardrobeItems(req, res) {
  try {
    const forceRefresh = Boolean(req.body?.force);
    const email = req.user.email;
    const profile = await getProfile(email);
    const storedWardrobe = getStoredWardrobePayload(profile);
    const activeJob = getWardrobeJob(email);

    if (activeJob?.status === "pending" && activeJob.phase === "extras" && storedWardrobe?.items?.length) {
      return res.status(202).json({
        ok: true,
        status: "pending",
        pendingStage: "extras",
        hasPendingAdditionalItems: true,
        items: storedWardrobe.items,
        reasoning: storedWardrobe.reasoning,
        rawSelectionText: storedWardrobe.rawSelectionText,
        swimwearReasoning: storedWardrobe.swimwearReasoning,
        pollAfterMs: WARDROBE_POLL_AFTER_MS
      });
    }

    if (!forceRefresh && storedWardrobe?.items?.length) {
      return res.json({
        ok: true,
        status: "ready",
        items: storedWardrobe.items,
        reasoning: storedWardrobe.reasoning,
        rawSelectionText: storedWardrobe.rawSelectionText,
        swimwearReasoning: storedWardrobe.swimwearReasoning,
        hasPendingAdditionalItems: false
      });
    }

    if (activeJob?.status === "pending") {
      return res.status(202).json({
        ok: true,
        status: "pending",
        pendingStage: activeJob.phase === "extras" ? "extras" : "capsule",
        hasPendingAdditionalItems: activeJob.phase === "extras",
        items: storedWardrobe?.items || [],
        reasoning: storedWardrobe?.reasoning || null,
        rawSelectionText: storedWardrobe?.rawSelectionText || null,
        swimwearReasoning: storedWardrobe?.swimwearReasoning || null,
        pollAfterMs: WARDROBE_POLL_AFTER_MS
      });
    }

    if (activeJob?.status === "failed" && !forceRefresh) {
      wardrobeJobs.delete(email);
      throw activeJob.error || new Error("wardrobe_generation_failed");
    }

    if (activeJob?.status === "failed" && forceRefresh) {
      wardrobeJobs.delete(email);
    }

    if (forceRefresh && profile) {
      await updateProfileItems(email, null);
    }

    const generationProfile = forceRefresh && profile
      ? { ...profile, items: null }
      : profile;
    const logContext = {
      capsuleRequestId: crypto.randomUUID()
    };
    logWardrobeInfo("capsule-request-received", getRequestedWardrobeParams(generationProfile, {
      forceRefresh
    }), logContext);
    startWardrobeJob(email, generationProfile, logContext);

    return res.status(202).json({
      ok: true,
      status: "pending",
      pendingStage: "capsule",
      hasPendingAdditionalItems: false,
      items: [],
      pollAfterMs: WARDROBE_POLL_AFTER_MS
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
