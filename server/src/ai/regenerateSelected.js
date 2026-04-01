import crypto from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  getProductsByUrlsInOrder,
  getProductsWithEmbeddingsByUrlsInOrder,
  getSqlClient
} from "../db.js";
import { getProfile } from "../profileStore.js";
import {
  buildProfileCapsuleContext,
  getCapsule,
  getEffectiveCapsuleSnapshot,
  updateCapsuleSnapshot
} from "../capsuleStore.js";
import { getCapsuleCategories } from "./categories.js";
import {
  buildCapsuleSchema,
  buildCustomJsonObjectFormat,
  generateJsonWithLlm
} from "./openai.js";
import {
  buildPromptDebugImagesForCategory,
  buildPromptDebugImagesInChild
} from "./promptImages.js";
import { runWithImageWorkSlot } from "./imagePipeline.js";
import { buildShiftedTargetVector, normalizeEmbeddingVector } from "./vectorMath.js";
import { getPromptEmbeddings, getWardrobePrompt } from "./voyageai.js";
import {
  buildCapsuleEventSnapshot,
  capsuleEventHub,
  getStoredWardrobePayload
} from "./capsuleEvents.js";
import {
  countItemsByKey,
  enforceCategoryCounts,
  extractLlmUsage,
  getSelectedIdsFromCapsule,
  logWardrobeInfo,
  toWardrobeUiItem
} from "./ai.js";

const REGENERATE_SELECTED_PROMPT_TEMPLATE = readFileSync(
  new URL("../templates/prompt_regenerate_selected.txt", import.meta.url),
  "utf8"
);
const COMPLETED_JOB_TTL_MS = 5 * 60 * 1000;
const LAST_PROMPT_DIR_URL = new URL("../../../last-prompt/", import.meta.url);
const partialRegenerationJobs = new Map();

function createPartialRegenerationJobKey(email, capsuleId) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCapsuleId = String(capsuleId || "").trim();
  return normalizedCapsuleId ? `${normalizedEmail}::${normalizedCapsuleId}` : normalizedEmail;
}

function isValidSelectedItemUrls(itemUrls) {
  return Array.isArray(itemUrls) && itemUrls.length > 0 && itemUrls.every((itemUrl) => (
    typeof itemUrl === "string" && itemUrl.trim().length > 0
  ));
}

function buildStoredWardrobePayloadFromResult(result = {}, storedWardrobe = null) {
  return {
    items: Array.isArray(result?.items) ? result.items : [],
    reasoning: result?.reasoning || null,
    rawSelectionText: result?.rawSelectionText || null,
    swimwearReasoning: storedWardrobe?.swimwearReasoning || null,
    swimwearRawSelectionText: storedWardrobe?.swimwearRawSelectionText || null
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

function simplifyPromptItems(items = []) {
  return items.map((item) => {
    const colorParts = [
      Array.isArray(item?.color_base)
        ? item.color_base.join(", ")
        : Array.isArray(item?.colorBase)
          ? item.colorBase.join(", ")
          : "",
      typeof item?.pattern === "string" ? item.pattern.trim() : "",
      typeof item?.finish === "string" ? item.finish.trim() : "",
      item?.is_neutral || item?.isNeutral ? "neutral" : ""
    ].filter(Boolean);

    return {
      id: item?.id ?? null,
      name: item?.name ?? "",
      type: item?.category ?? "",
      color: colorParts.join(", "),
      formality_level: Array.isArray(item?.formality_level)
        ? item.formality_level
        : Array.isArray(item?.formalityLevel)
          ? item.formalityLevel
          : [],
      style: Array.isArray(item?.style) ? item.style : [],
      materials: item?.composition || "",
      fit: typeof item?.fit === "string" ? item.fit.trim() : "",
      silhouette: typeof item?.silhouette === "string" ? item.silhouette.trim() : ""
    };
  });
}

function buildRegeneratedItemsFormat(categories) {
  return buildCustomJsonObjectFormat(
    "capsule_regenerate_selected_response",
    "Structured partial capsule regeneration selection with brief reasoning and exact replacement counts.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        system_evaluation: {
          type: "object",
          additionalProperties: false,
          required: ["overall_explanation", "outfit_formulas"],
          properties: {
            overall_explanation: {
              type: "string"
            },
            outfit_formulas: {
              type: "array",
              items: {
                type: "string"
              },
              minItems: 3,
              maxItems: 4
            }
          }
        },
        item_details: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "role", "reason", "compatibility", "warning"],
            properties: {
              id: { type: "string" },
              role: {
                type: "string",
                enum: ["anchor", "connector", "accent"]
              },
              reason: { type: "string" },
              compatibility: { type: "string" },
              warning: { type: "string" }
            }
          }
        },
        regenerated_items: buildCapsuleSchema(categories)
      },
      required: ["system_evaluation", "item_details", "regenerated_items"]
    }
  );
}

function saveLastPromptArtifacts({ prompt, currentCapsuleCollage } = {}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  mkdirSync(LAST_PROMPT_DIR_URL, { recursive: true });

  if (typeof prompt === "string") {
    writeFileSync(new URL("last_prompt.txt", LAST_PROMPT_DIR_URL), prompt, "utf8");
  }

  if (currentCapsuleCollage?.buffer) {
    writeFileSync(
      new URL("current-capsule.jpg", LAST_PROMPT_DIR_URL),
      currentCapsuleCollage.buffer
    );
  }
}

function buildRegenerateSelectedPrompt(userProfile = null, candidateItems = [], currentCapsuleItems = [], categories = {}) {
  const replacements = {
    audience: userProfile?.audience || "any",
    occasions: formatProfileValues(userProfile?.occasions),
    formality_level:
      typeof userProfile?.formalityLevel === "string" && userProfile.formalityLevel.trim().length > 0
        ? userProfile.formalityLevel
        : "Not specified",
    style:
      typeof userProfile?.style === "string" && userProfile.style.trim().length > 0
        ? userProfile.style
        : "Not specified",
    color:
      typeof userProfile?.color === "string" && userProfile.color.trim().length > 0
        ? userProfile.color
        : "Not specified",
    pattern:
      typeof userProfile?.pattern === "string" && userProfile.pattern.trim().length > 0
        ? userProfile.pattern
        : "Not specified",
    current_capsule_items: JSON.stringify(simplifyPromptItems(currentCapsuleItems), null, 2),
    category_list: getCategoryListText(categories),
    items: JSON.stringify(simplifyPromptItems(candidateItems), null, 2),
    num_items: String(Object.values(categories).reduce((sum, count) => sum + count, 0)),
    categories_schema: JSON.stringify(buildCapsuleSchema(categories), null, 2)
  };

  let prompt = REGENERATE_SELECTED_PROMPT_TEMPLATE;
  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  const unresolvedTokens = prompt.match(/\{\{[a-zA-Z0-9_]+\}\}/g);
  if (unresolvedTokens?.length) {
    throw new Error(`Unresolved regenerate prompt placeholders: ${unresolvedTokens.join(", ")}`);
  }

  return prompt;
}

async function regenerateCapsuleWardrobe(userProfile = null, products = null, logContext = null) {
  const sql = getSqlClient();
  const prompt = getWardrobePrompt(userProfile);
  const promptEmbeddings = await getPromptEmbeddings(prompt);
  const storedWardrobe = getStoredWardrobePayload(userProfile);
  const selectedProducts = Array.isArray(products) ? products : [];
  const selectedProductUrls = selectedProducts
    .map((item) => String(item?.url || "").trim())
    .filter(Boolean);
  const storedWardrobeProductUrls = Array.isArray(storedWardrobe?.items)
    ? storedWardrobe.items
      .map((item) => String(item?.url || "").trim())
      .filter(Boolean)
    : [];
  const selectedProductUrlSet = new Set(selectedProductUrls);
  const currentCapsuleItems = Array.isArray(storedWardrobe?.items)
    ? storedWardrobe.items.filter((item) => !selectedProductUrlSet.has(String(item?.url || "").trim()))
    : [];
  const currentCapsulePromptItems = await getProductsByUrlsInOrder(
    currentCapsuleItems.map((item) => String(item?.url || "").trim()).filter(Boolean)
  );
  const selectedCategoryCounts = selectedProducts.reduce((result, item) => {
    const category = String(item?.category || "").trim();
    if (!category) {
      return result;
    }

    result[category] = (result[category] || 0) + 1;
    return result;
  }, {});
  const baseCategoryOrder = Object.keys(getCapsuleCategories(userProfile));
  const capsuleCategories = {};
  for (const category of baseCategoryOrder) {
    if (selectedCategoryCounts[category] > 0) {
      capsuleCategories[category] = selectedCategoryCounts[category];
    }
  }
  for (const [category, count] of Object.entries(selectedCategoryCounts)) {
    if (!Object.prototype.hasOwnProperty.call(capsuleCategories, category)) {
      capsuleCategories[category] = count;
    }
  }
  const categories = Object.keys(capsuleCategories);
  if (categories.length === 0) {
    throw new Error("No selected product categories for regeneration");
  }
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
  const rejectedUrls = Array.isArray(userProfile?.rejected)
    ? userProfile.rejected.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];
  const excludedUrls = [...new Set([...storedWardrobeProductUrls, ...rejectedUrls])];
  const negativePromptingUrls = [...new Set([...rejectedUrls, ...selectedProductUrls])];
  const rejectedProducts = await getProductsWithEmbeddingsByUrlsInOrder(negativePromptingUrls);
  const rejectedVectors = rejectedProducts
    .map((product) => normalizeEmbeddingVector(product?.embedding))
    .filter(Boolean);
  const shiftedPromptEmbeddings = buildShiftedTargetVector(promptEmbeddings, rejectedVectors, 0.3);
  const embeddingVector = `[${shiftedPromptEmbeddings.join(",")}]`;
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
              AND NOT (products.url = ANY(${excludedUrls}::text[]))
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
  let currentCapsuleCollage = null;

  try {
    const imageFetchStartedAt = Date.now();
    promptDebugImages = await runWithImageWorkSlot("capsule-images", async () => buildPromptDebugImagesInChild({
      normalizedItems,
      saveDebugArtifacts: shouldSavePromptDebugArtifacts,
      debugOutputDir: shouldSavePromptDebugArtifacts
        ? LAST_PROMPT_DIR_URL
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

  if (currentCapsuleItems.length > 0) {
    try {
      const currentCapsuleImageStartedAt = Date.now();
      const currentCapsuleImage = await runWithImageWorkSlot("capsule-images", async () => (
        buildPromptDebugImagesForCategory({
          category: "Current Capsule",
          items: currentCapsuleItems
        })
      ));
      currentCapsuleCollage = currentCapsuleImage?.category || null;
      logWardrobeInfo("current-capsule-collage-ready", {
        imageFetchDurationMs: Date.now() - currentCapsuleImageStartedAt,
        currentCapsuleItemsTotal: currentCapsuleItems.length,
        cachedCount: currentCapsuleCollage?.cachedCount || 0,
        downloadedCount: currentCapsuleCollage?.downloadedCount || 0,
        skippedCount: currentCapsuleCollage?.skippedCount || 0
      }, logContext);
    } catch (error) {
      console.warn(
        "[prompt-images][current-capsule-build-failed]",
        JSON.stringify({
          message: error?.message || "unknown_error"
        })
      );
    }
  }

  const selectionPrompt = buildRegenerateSelectedPrompt(
    userProfile,
    normalizedItems,
    currentCapsulePromptItems,
    capsuleCategories
  );
  saveLastPromptArtifacts({
    prompt: selectionPrompt,
    currentCapsuleCollage
  });
  const llmStartedAt = Date.now();
  const stylistImages = currentCapsuleCollage
    ? [currentCapsuleCollage, ...promptDebugImages.categories]
    : promptDebugImages.categories;
  const { response: selectionResponse, json: parsedSelection } = await generateJsonWithLlm(selectionPrompt, {
    userProfile,
    format: buildRegeneratedItemsFormat(capsuleCategories),
    images: stylistImages,
    onPayloadBuilt: () => {
      promptDebugImages.categories = [];
      currentCapsuleCollage = null;
    }
  });
  promptDebugImages.categories = [];
  currentCapsuleCollage = null;
  logWardrobeInfo("capsule-llm-completed", {
    llmDurationMs: Date.now() - llmStartedAt,
    ...extractLlmUsage(selectionResponse?.usage)
  }, logContext);

  console.log("[wardrobe-ai][selected-json]", JSON.stringify(parsedSelection));
  if (!parsedSelection?.regenerated_items || typeof parsedSelection.regenerated_items !== "object") {
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

  const selectedIds = getSelectedIdsFromCapsule(parsedSelection?.regenerated_items);
  const uniqueSelectedIds = [...new Set(selectedIds.map((id) => String(id)))];
  const itemsById = new Map(normalizedItems.map((item) => [String(item.id), item]));
  const selectedItems = uniqueSelectedIds
    .map((id) => itemsById.get(String(id)))
    .filter(Boolean);
  const balancedItems = enforceCategoryCounts(selectedItems, normalizedItems, capsuleCategories);

  if (balancedItems.length === 0) {
    throw new Error("Model returned no valid selected_ids");
  }

  const nextWardrobeItems = [
    ...currentCapsuleItems,
    ...balancedItems.map(toWardrobeUiItem)
  ];

  return {
    items: nextWardrobeItems,
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

function createPartialRegenerationService({
  getProfileImpl = getProfile,
  getCapsuleImpl = getCapsule,
  updateCapsuleSnapshotImpl = updateCapsuleSnapshot,
  regenerateCapsuleWardrobeImpl = regenerateCapsuleWardrobe,
  buildCapsuleEventSnapshotImpl = buildCapsuleEventSnapshot,
  publishSnapshotImpl = (email, capsuleId, snapshot) => capsuleEventHub.publish(email, capsuleId, snapshot),
  jobs = partialRegenerationJobs,
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

  function getPartialRegenerationJob(email, capsuleId) {
    const jobKey = createPartialRegenerationJobKey(email, capsuleId);
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

  function startPartialRegenerationJob(email, capsuleId, profile, capsule, selectedProducts, storedWardrobe, logContext = null) {
    const jobKey = createPartialRegenerationJobKey(email, capsuleId);
    const existing = getPartialRegenerationJob(email, capsuleId);
    if (existing?.status === "pending") {
      return existing;
    }

    const pendingItemUrls = selectedProducts
      .map((item) => String(item?.url || "").trim())
      .filter(Boolean);
    const capsuleRequestId = logContext?.capsuleRequestId || randomUuidImpl();
    const startedAt = nowMsImpl();
    const job = {
      capsuleRequestId,
      status: "pending",
      phase: "regenerate",
      startedAt,
      updatedAt: startedAt,
      pendingItemUrls,
      result: null,
      promise: null
    };
    jobs.set(jobKey, job);

    job.promise = (async () => {
      const jobLogContext = {
        capsuleRequestId,
        startedAt
      };
      let currentCapsule = capsule;

      try {
        const result = await regenerateCapsuleWardrobeImpl(buildProfileCapsuleContext(profile, capsule), selectedProducts, jobLogContext);
        const payload = buildStoredWardrobePayloadFromResult(result, storedWardrobe);
        const baseSnapshot = getEffectiveCapsuleSnapshot(capsule);
        if (capsuleId) {
          currentCapsule = await updateCapsuleSnapshotImpl(email, capsuleId, {
            filters: baseSnapshot?.filters,
            data: {
              wardrobe: payload,
              rejectedUrls: baseSnapshot?.data?.rejectedUrls || []
            }
          });
        } else {
          currentCapsule = {
            ...capsule,
            draft: {
              filters: baseSnapshot?.filters,
              data: {
                wardrobe: payload,
                rejectedUrls: baseSnapshot?.data?.rejectedUrls || []
              }
            }
          };
        }
        job.result = payload;
        job.status = "completed";
        job.phase = "completed";
        job.updatedAt = nowMsImpl();
        logWardrobeInfo("regenerate-total-completed", {
          totalDurationMs: nowMsImpl() - startedAt,
          itemsTotal: payload.items.length,
          itemsByCategory: countItemsByKey(payload.items)
        }, jobLogContext);
        publishSnapshotImpl(
          email,
          capsuleId,
          buildCapsuleEventSnapshotImpl({ capsule: currentCapsule, partialRegenerationJob: job })
        );
      } catch (error) {
        job.status = "failed";
        job.phase = "failed";
        job.updatedAt = nowMsImpl();
        job.error = error;
        console.error("[wardrobe-ai][regenerate-selected]", error);
        publishSnapshotImpl(
          email,
          capsuleId,
          buildCapsuleEventSnapshotImpl({ capsule: currentCapsule, partialRegenerationJob: job })
        );
      } finally {
        scheduleJobCleanup(jobKey, job);
      }
    })();

    return job;
  }

  async function regenerateSelectedWardrobeItems(req, res) {
    try {
      const email = req.user.email;
      const capsuleId = String(req.params?.id || "").trim();
      const itemUrls = Array.isArray(req.body?.itemUrls)
        ? req.body.itemUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
        : [];
      const profile = await getProfileImpl(email);
      if (!capsuleId) {
        return res.status(400).json({ error: "invalid_payload" });
      }
      const capsule = await getCapsuleImpl(email, capsuleId);
      if (!capsule) {
        return res.status(404).json({ error: "not_found" });
      }
      const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
      const storedWardrobe = getStoredWardrobePayload({ items: effectiveSnapshot?.data?.wardrobe });
      const activeJob = getPartialRegenerationJob(email, capsuleId);

      if (activeJob?.status === "pending") {
        return res.status(202).json({
          ok: true,
          status: "pending",
          pendingStage: "regenerate"
        });
      }

      if (activeJob?.status === "completed" || activeJob?.status === "failed") {
        jobs.delete(createPartialRegenerationJobKey(email, capsuleId));
      }

      if (!isValidSelectedItemUrls(itemUrls)) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      if (!storedWardrobe?.items?.length) {
        return res.status(404).json({ error: "not_found" });
      }

      const storedItemsByUrl = new Map(
        storedWardrobe.items
          .filter((item) => item && typeof item === "object")
          .map((item) => [String(item.url || "").trim(), item])
          .filter(([itemUrl]) => itemUrl)
      );
      const selectedProducts = itemUrls.map((itemUrl) => storedItemsByUrl.get(itemUrl)).filter(Boolean);
      if (selectedProducts.length !== itemUrls.length) {
        return res.status(400).json({ error: "invalid_payload" });
      }
      const nextRejectedUrls = [...new Set([
        ...(Array.isArray(effectiveSnapshot?.data?.rejectedUrls) ? effectiveSnapshot.data.rejectedUrls : []),
        ...itemUrls
      ].map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean))];

      const selectedItemUrlSet = new Set(itemUrls);
      const partialItems = storedWardrobe.items.filter((item) => !selectedItemUrlSet.has(String(item?.url || "").trim()));
      const partialPayload = {
        items: partialItems,
        reasoning: storedWardrobe.reasoning || null,
        rawSelectionText: storedWardrobe.rawSelectionText || null,
        swimwearReasoning: storedWardrobe.swimwearReasoning || null,
        swimwearRawSelectionText: storedWardrobe.swimwearRawSelectionText || null
      };
      const logContext = {
        capsuleRequestId: randomUuidImpl(),
        source: "partial-regeneration"
      };
      logWardrobeInfo("regenerate-request-received", { itemUrls }, logContext);
      if (capsuleId) {
        await updateCapsuleSnapshotImpl(email, capsuleId, {
          filters: effectiveSnapshot?.filters,
          data: {
            wardrobe: partialPayload,
            rejectedUrls: nextRejectedUrls
          }
        });
      }
      const generationCapsule = {
        ...capsule,
        draft: {
          filters: effectiveSnapshot?.filters,
          data: {
            wardrobe: partialPayload,
            rejectedUrls: nextRejectedUrls
          }
        }
      };
      const job = startPartialRegenerationJob(
        email,
        capsuleId,
        profile,
        generationCapsule,
        selectedProducts,
        storedWardrobe,
        logContext
      );
      publishSnapshotImpl(
        email,
        capsuleId,
        buildCapsuleEventSnapshotImpl({
          capsule: generationCapsule,
          partialRegenerationJob: job
        })
      );

      return res.status(202).json({
        ok: true,
        status: "pending",
        pendingStage: "regenerate"
      });
    } catch (error) {
      console.error("[wardrobe-ai][regenerate-selected]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  }

  return {
    getPartialRegenerationJob,
    startPartialRegenerationJob,
    regenerateSelectedWardrobeItems
  };
}

const partialRegenerationService = createPartialRegenerationService();
const {
  getPartialRegenerationJob,
  startPartialRegenerationJob,
  regenerateSelectedWardrobeItems
} = partialRegenerationService;

export {
  createPartialRegenerationService,
  getPartialRegenerationJob,
  regenerateCapsuleWardrobe,
  regenerateSelectedWardrobeItems,
  startPartialRegenerationJob
};
