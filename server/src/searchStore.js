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
  searchProductStats,
  searchProducts,
  upsertSearchByEmail,
  getDistinctProductFormalityLevels
} from "./db.js";
import { getStyles } from "./profileStore.js";
import { getPromptEmbeddings } from "./ai/voyageai.js";

const DEFAULT_SEARCH_STATE = Object.freeze({
  query: "",
  brand: [],
  priceMin: null,
  priceMax: null,
  audience: [],
  category: [],
  season: [],
  formalityLevel: [],
  style: [],
  occasions: [],
  color: [],
  pattern: [],
  silhouette: [],
  fit: [],
  closureType: [],
  page: 1
});

const SEARCH_AUDIENCE_OPTIONS = Object.freeze(["woman", "man", "all"]);

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
  if (typeof values === "string") {
    const normalized = normalizeNullableString(values);
    return normalized ? [normalized] : [];
  }
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
    brand: normalizeStringArray(payload.brand),
    priceMin: normalizePriceValue(payload.priceMin),
    priceMax: normalizePriceValue(payload.priceMax),
    audience: normalizeStringArray(payload.audience),
    category: normalizeStringArray(payload.category),
    season: normalizeStringArray(payload.season),
    formalityLevel: normalizeStringArray(payload.formalityLevel),
    style: normalizeStringArray(payload.style),
    occasions: normalizeStringArray(payload.occasions),
    color: normalizeStringArray(payload.color),
    pattern: normalizeStringArray(payload.pattern),
    silhouette: normalizeStringArray(payload.silhouette),
    fit: normalizeStringArray(payload.fit),
    closureType: normalizeStringArray(payload.closureType),
    page: normalizePage(payload.page)
  };
}

function serializeSearchRow(row = null) {
  if (!row) {
    return { ...DEFAULT_SEARCH_STATE };
  }

  return {
    query: typeof row.query === "string" ? row.query : "",
    brand: normalizeStringArray(row.brand),
    priceMin: row.priceMin === null || row.priceMin === undefined ? null : Number(row.priceMin),
    priceMax: row.priceMax === null || row.priceMax === undefined ? null : Number(row.priceMax),
    audience: normalizeStringArray(row.audience),
    category: normalizeStringArray(row.category),
    season: normalizeStringArray(row.season),
    formalityLevel: normalizeStringArray(row.formalityLevel),
    style: normalizeStringArray(row.style),
    occasions: normalizeStringArray(row.occasions),
    color: normalizeStringArray(row.color),
    pattern: normalizeStringArray(row.pattern),
    silhouette: normalizeStringArray(row.silhouette),
    fit: normalizeStringArray(row.fit),
    closureType: normalizeStringArray(row.closureType),
    page: normalizePage(row.page)
  };
}

function normalizeStoredEmbedding(value) {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

async function resolveSearchEmbedding({ currentSearch, query }) {
  if (!query) {
    return null;
  }

  const savedQuery = normalizeQuery(currentSearch?.query);
  const savedEmbedding = normalizeStoredEmbedding(currentSearch?.embedding);

  if (savedQuery === query && savedEmbedding) {
    return savedEmbedding;
  }

  return getPromptEmbeddings(query);
}

function isAllowedNullableValue(value, allowedItems) {
  return value === null || allowedItems.includes(value);
}

function isAllowedArrayValue(values, allowedItems) {
  return values.every((value) => allowedItems.includes(value));
}

function getAllowedBrandValues(brandOptions = []) {
  return brandOptions
    .map((item) => (typeof item === "string" ? item : item?.value))
    .filter(Boolean);
}

function assertValidSearchPayload(normalized, options) {
  const allowedBrandValues = getAllowedBrandValues(options.brands);

  if (
    !isAllowedArrayValue(normalized.brand, allowedBrandValues) ||
    !isAllowedArrayValue(normalized.audience, options.audience) ||
    !isAllowedArrayValue(normalized.category, options.categories) ||
    !isAllowedArrayValue(normalized.formalityLevel, options.formalityLevels) ||
    !isAllowedArrayValue(normalized.style, options.styles) ||
    !isAllowedArrayValue(normalized.color, options.colors) ||
    !isAllowedArrayValue(normalized.pattern, options.patterns) ||
    !isAllowedArrayValue(normalized.silhouette, options.silhouettes) ||
    !isAllowedArrayValue(normalized.fit, options.fits) ||
    !isAllowedArrayValue(normalized.closureType, options.closureTypes) ||
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
    audience: [...SEARCH_AUDIENCE_OPTIONS],
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
  const [options, currentSearch] = await Promise.all([
    getSearchOptions(email),
    getSearchByEmail(email)
  ]);
  assertValidSearchPayload(normalized, options);

  const embedding = await resolveSearchEmbedding({
    currentSearch,
    query: normalized.query
  });
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

async function getSearchStats(email, payload = {}) {
  const normalized = normalizeSearchPayload(payload);
  const options = await getSearchOptions(email);
  assertValidSearchPayload(normalized, options);

  return searchProductStats(normalized);
}

export {
  DEFAULT_SEARCH_STATE,
  SEARCH_AUDIENCE_OPTIONS,
  getSemanticDistanceThreshold,
  getRelaxedSemanticDistanceThreshold,
  normalizeSearchPayload,
  resolveSearchEmbedding,
  serializeSearchRow,
  getSearchOptions,
  getSavedSearch,
  runSavedSearch,
  getSearchStats
};
