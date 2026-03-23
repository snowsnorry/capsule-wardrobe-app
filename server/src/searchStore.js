import {
  getDistinctProductBrands,
  getDistinctProductCategories,
  getDistinctProductClosureTypes,
  getDistinctProductColors,
  getDistinctProductFits,
  getDistinctProductOccasions,
  getDistinctProductPatterns,
  getDistinctProductSeasons,
  getDistinctProductSilhouettes,
  getProductPriceRange,
  getSearchByEmail,
  searchProducts,
  upsertSearchByEmail,
  getDistinctProductFormalityLevels
} from "./db.js";
import { getStyles, getAudienceOptions } from "./profileStore.js";
import { getPromptEmbeddings } from "./ai/voyageai.js";

const DEFAULT_SEARCH_STATE = Object.freeze({
  query: "",
  brand: null,
  priceMin: null,
  priceMax: null,
  audience: null,
  category: null,
  season: [],
  formalityLevel: null,
  style: null,
  occasions: [],
  color: null,
  pattern: null,
  silhouette: null,
  fit: null,
  closureType: null,
  page: 1
});

function getSemanticDistanceThreshold(query = "") {
  const normalizedLength = String(query || "").trim().length;

  if (normalizedLength === 0) {
    return null;
  }

  if (normalizedLength < 20) {
    return 0.40;
  }

  if (normalizedLength < 60) {
    return 0.35;
  }

  return 0.31;
}

function getRelaxedSemanticDistanceThreshold(query = "") {
  const baseThreshold = getSemanticDistanceThreshold(query);
  if (baseThreshold === null) {
    return null;
  }

  return Math.min(baseThreshold + 0.08, 0.50);
}

function normalizeNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

function normalizeQuery(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(
    values
      .map((value) => normalizeNullableString(value))
      .filter(Boolean)
  )];
}

function normalizePriceValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeSearchPayload(payload = {}) {
  return {
    query: normalizeQuery(payload.query),
    brand: normalizeNullableString(payload.brand),
    priceMin: normalizePriceValue(payload.priceMin),
    priceMax: normalizePriceValue(payload.priceMax),
    audience: normalizeNullableString(payload.audience),
    category: normalizeNullableString(payload.category),
    season: normalizeStringArray(payload.season),
    formalityLevel: normalizeNullableString(payload.formalityLevel),
    style: normalizeNullableString(payload.style),
    occasions: normalizeStringArray(payload.occasions),
    color: normalizeNullableString(payload.color),
    pattern: normalizeNullableString(payload.pattern),
    silhouette: normalizeNullableString(payload.silhouette),
    fit: normalizeNullableString(payload.fit),
    closureType: normalizeNullableString(payload.closureType),
    page: normalizePage(payload.page)
  };
}

function serializeSearchRow(row = null) {
  if (!row) {
    return { ...DEFAULT_SEARCH_STATE };
  }

  return {
    query: typeof row.query === "string" ? row.query : "",
    brand: normalizeNullableString(row.brand),
    priceMin: row.priceMin === null || row.priceMin === undefined ? null : Number(row.priceMin),
    priceMax: row.priceMax === null || row.priceMax === undefined ? null : Number(row.priceMax),
    audience: normalizeNullableString(row.audience),
    category: normalizeNullableString(row.category),
    season: normalizeStringArray(row.season),
    formalityLevel: normalizeNullableString(row.formalityLevel),
    style: normalizeNullableString(row.style),
    occasions: normalizeStringArray(row.occasions),
    color: normalizeNullableString(row.color),
    pattern: normalizeNullableString(row.pattern),
    silhouette: normalizeNullableString(row.silhouette),
    fit: normalizeNullableString(row.fit),
    closureType: normalizeNullableString(row.closureType),
    page: normalizePage(row.page)
  };
}

function isAllowedNullableValue(value, allowedItems) {
  return value === null || allowedItems.includes(value);
}

function isAllowedArrayValue(values, allowedItems) {
  return values.every((value) => allowedItems.includes(value));
}

async function getSearchOptions(email) {
  const [
    brands,
    categories,
    seasons,
    formalityLevels,
    styles,
    occasions,
    colors,
    patterns,
    silhouettes,
    fits,
    closureTypes,
    priceRange
  ] = await Promise.all([
    getDistinctProductBrands(),
    getDistinctProductCategories(),
    getDistinctProductSeasons(),
    getDistinctProductFormalityLevels(),
    getStyles(email),
    getDistinctProductOccasions(),
    getDistinctProductColors(),
    getDistinctProductPatterns(),
    getDistinctProductSilhouettes(),
    getDistinctProductFits(),
    getDistinctProductClosureTypes(),
    getProductPriceRange()
  ]);

  return {
    brands,
    categories,
    seasons,
    formalityLevels,
    styles,
    occasions,
    audience: getAudienceOptions(),
    colors,
    patterns,
    silhouettes,
    fits,
    closureTypes,
    priceRange
  };
}

async function getSavedSearch(email) {
  const row = await getSearchByEmail(email);
  return serializeSearchRow(row);
}

async function runSavedSearch(email, payload = {}) {
  const normalized = normalizeSearchPayload(payload);
  const options = await getSearchOptions(email);

  if (
    !isAllowedNullableValue(normalized.brand, options.brands) ||
    !isAllowedNullableValue(normalized.audience, options.audience) ||
    !isAllowedNullableValue(normalized.category, options.categories) ||
    !isAllowedNullableValue(normalized.formalityLevel, options.formalityLevels) ||
    !isAllowedNullableValue(normalized.style, options.styles) ||
    !isAllowedNullableValue(normalized.color, options.colors) ||
    !isAllowedNullableValue(normalized.pattern, options.patterns) ||
    !isAllowedNullableValue(normalized.silhouette, options.silhouettes) ||
    !isAllowedNullableValue(normalized.fit, options.fits) ||
    !isAllowedNullableValue(normalized.closureType, options.closureTypes) ||
    !isAllowedArrayValue(normalized.season, options.seasons) ||
    !isAllowedArrayValue(normalized.occasions, options.occasions) ||
    Number.isNaN(normalized.priceMin) ||
    Number.isNaN(normalized.priceMax) ||
    (
      normalized.priceMin !== null &&
      normalized.priceMax !== null &&
      normalized.priceMin > normalized.priceMax
    )
  ) {
    const error = new Error("invalid_payload");
    error.code = "invalid_payload";
    throw error;
  }

  const embedding = normalized.query
    ? await getPromptEmbeddings(normalized.query)
    : null;
  const semanticDistanceThreshold = getSemanticDistanceThreshold(normalized.query);

  const savedSearch = await upsertSearchByEmail({
    email,
    ...normalized,
    embedding
  });

  let results = await searchProducts({
    ...normalized,
    queryEmbedding: embedding,
    semanticDistanceThreshold
  });

  if (normalized.query && results.total === 0) {
    results = await searchProducts({
      ...normalized,
      queryEmbedding: embedding,
      semanticDistanceThreshold: getRelaxedSemanticDistanceThreshold(normalized.query)
    });
  }

  return {
    ...results,
    savedSearch: serializeSearchRow(savedSearch)
  };
}

export {
  DEFAULT_SEARCH_STATE,
  getSemanticDistanceThreshold,
  getRelaxedSemanticDistanceThreshold,
  normalizeSearchPayload,
  serializeSearchRow,
  getSearchOptions,
  getSavedSearch,
  runSavedSearch
};
