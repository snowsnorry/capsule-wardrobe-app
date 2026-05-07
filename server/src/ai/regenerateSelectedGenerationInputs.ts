import { getCapsuleCategories } from "./categories.js";
import {
  buildShiftedTargetVector,
  normalizeEmbeddingVector,
} from "./vectorMath.js";
import { countItemsByKey, logWardrobeInfo } from "./ai.js";
import { getStoredWardrobePayload } from "./capsuleEvents.js";
import { getSqlRows } from "./regenerateSelectedPrompt.js";
import type { CountByKey, WardrobeUiItemLike } from "./types.js";

const AUDIENCE_FILTERS_BY_PROFILE = {
  man: ["man", "all"],
  woman: ["woman", "all"],
  any: ["man", "woman", "all"],
};

export function getProductUrls(items) {
  return Array.isArray(items)
    ? items.map((item) => String(item?.url || "").trim()).filter(Boolean)
    : [];
}

function countSelectedCategories(
  selectedProducts: WardrobeUiItemLike[],
): CountByKey {
  return selectedProducts.reduce<CountByKey>((result, item) => {
    const category = String(item?.category || "").trim();
    if (category) {
      result[category] = (result[category] || 0) + 1;
    }
    return result;
  }, {});
}

function buildSelectedCapsuleCategories(
  userProfile,
  selectedProducts: WardrobeUiItemLike[],
) {
  const selectedCategoryCounts = countSelectedCategories(selectedProducts);
  const capsuleCategories: CountByKey = {};
  for (const category of Object.keys(getCapsuleCategories(userProfile))) {
    if (selectedCategoryCounts[category] > 0) {
      capsuleCategories[category] = selectedCategoryCounts[category];
    }
  }
  for (const [category, count] of Object.entries(selectedCategoryCounts)) {
    if (!Object.prototype.hasOwnProperty.call(capsuleCategories, category)) {
      capsuleCategories[category] = count;
    }
  }
  return capsuleCategories;
}

function getProfileList(value) {
  return Array.isArray(value) ? value : [];
}

function getRegenerationPattern(userProfile) {
  return typeof userProfile?.pattern === "string" &&
    userProfile.pattern.trim().length > 0
    ? userProfile.pattern.trim().toLowerCase()
    : "solid";
}

function getRejectedUrls(userProfile) {
  return Array.isArray(userProfile?.rejected)
    ? userProfile.rejected
        .map((itemUrl) => String(itemUrl || "").trim())
        .filter(Boolean)
    : [];
}

function getAudienceFilters(userProfile) {
  return (
    AUDIENCE_FILTERS_BY_PROFILE[userProfile?.audience] ||
    AUDIENCE_FILTERS_BY_PROFILE.any
  );
}

export async function buildRegenerationInputs(userProfile, products, deps) {
  const prompt = deps.getWardrobePromptImpl(userProfile);
  const promptEmbeddings = await deps.getPromptEmbeddingsImpl(prompt);
  const storedWardrobe = getStoredWardrobePayload(userProfile);
  const selectedProducts = Array.isArray(products) ? products : [];
  const selectedProductUrls = getProductUrls(selectedProducts);
  const selectedProductUrlSet = new Set(selectedProductUrls);
  const currentCapsuleItems = Array.isArray(storedWardrobe?.items)
    ? storedWardrobe.items.filter(
        (item) => !selectedProductUrlSet.has(String(item?.url || "").trim()),
      )
    : [];
  const currentCapsulePromptItems = await deps.getProductsByUrlsInOrderImpl(
    getProductUrls(currentCapsuleItems),
  );
  const capsuleCategories = buildSelectedCapsuleCategories(
    userProfile,
    selectedProducts,
  );
  const categories = Object.keys(capsuleCategories);

  if (categories.length === 0) {
    throw new Error("No selected product categories for regeneration");
  }

  return {
    capsuleCategories,
    currentCapsuleItems,
    currentCapsulePromptItems,
    promptEmbeddings,
    selectedProductUrls,
    storedWardrobeProductUrls: getProductUrls(storedWardrobe?.items),
  };
}

export async function buildRegenerationSqlParams(userProfile, inputs, deps) {
  const rejectedUrls = getRejectedUrls(userProfile);
  const negativePromptingUrls = [
    ...new Set([...rejectedUrls, ...inputs.selectedProductUrls]),
  ];
  const rejectedProducts =
    await deps.getProductsWithEmbeddingsByUrlsInOrderImpl(
      negativePromptingUrls,
    );
  const rejectedVectors = rejectedProducts
    .map((product) => normalizeEmbeddingVector(product?.embedding))
    .filter(Boolean);
  const shiftedPromptEmbeddings = buildShiftedTargetVector(
    inputs.promptEmbeddings,
    rejectedVectors,
    0.3,
  );

  return {
    audienceFilters: getAudienceFilters(userProfile),
    categories: Object.keys(inputs.capsuleCategories),
    color: userProfile?.color ?? null,
    embeddingVector: `[${shiftedPromptEmbeddings.join(",")}]`,
    excludedUrls: [
      ...new Set([...inputs.storedWardrobeProductUrls, ...rejectedUrls]),
    ],
    formalityLevel: userProfile?.formalityLevel ?? null,
    noiseFactor: 0.05,
    occasions: getProfileList(userProfile?.occasions),
    pattern: getRegenerationPattern(userProfile),
    season: getProfileList(userProfile?.season),
    style: userProfile?.style ?? null,
  };
}

export async function getRegenerationCandidates(
  sql,
  sqlParams,
  logContext,
  deps,
) {
  const sqlStartedAt = Date.now();
  const itemsResult = await deps.queryRegenerationCandidateItemsImpl(
    sql,
    sqlParams,
  );
  const normalizedItems = getSqlRows(itemsResult).map((item) => {
    const normalized = { ...(item as Record<string, unknown>) };
    delete normalized.embedding;
    return normalized;
  });
  logWardrobeInfo(
    "capsule-sql-completed",
    {
      sqlDurationMs: Date.now() - sqlStartedAt,
      sqlItemsTotal: normalizedItems.length,
      sqlItemsByCategory: countItemsByKey(normalizedItems),
    },
    logContext,
  );
  return normalizedItems;
}
