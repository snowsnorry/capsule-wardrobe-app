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
  getDistinctProductFormalityLevels,
} from "./db.js";
import { getStyles } from "./profileStore.js";
import { assertValidSearchPayload } from "./searchValidation.js";
import type { SearchOptions, SearchPayload } from "./searchTypes.js";
import {
  getRelaxedSemanticDistanceThreshold,
  getSemanticDistanceThreshold,
  isHttpUrlQuery,
  resolveSearchEmbedding,
  routeSearchText,
} from "./searchSemantic.js";

type SearchRow = Partial<SearchPayload> & {
  embedding?: number[] | null;
};

type SearchResults = {
  total: number;
  [key: string]: unknown;
};

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
  page: 1,
} as SearchPayload);

const SEARCH_AUDIENCE_OPTIONS = Object.freeze(["woman", "man", "all"] as const);

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

function normalizeQuery(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeStringArray(values: unknown): string[] {
  if (typeof values === "string") {
    const normalized = normalizeNullableString(values);
    return normalized ? [normalized] : [];
  }
  if (!Array.isArray(values)) {
    return [];
  }
  return [
    ...new Set(
      values.map((value) => normalizeNullableString(value)).filter(Boolean),
    ),
  ];
}

function normalizePriceValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizePage(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeSearchPayload(
  payload: Partial<Record<keyof SearchPayload, unknown>> = {},
): SearchPayload {
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
    page: normalizePage(payload.page),
  };
}

function serializeSearchRow(row: SearchRow | null = null): SearchPayload {
  if (!row) {
    return { ...DEFAULT_SEARCH_STATE };
  }

  return {
    query: typeof row.query === "string" ? row.query : "",
    brand: normalizeStringArray(row.brand),
    priceMin:
      row.priceMin === null || row.priceMin === undefined
        ? null
        : Number(row.priceMin),
    priceMax:
      row.priceMax === null || row.priceMax === undefined
        ? null
        : Number(row.priceMax),
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
    page: normalizePage(row.page),
  };
}

type SearchStoreDeps = {
  getDistinctProductBrandsImpl?: () => Promise<SearchOptions["brands"]>;
  getDistinctProductCategoriesImpl?: () => Promise<string[]>;
  getDistinctProductSeasonsImpl?: () => Promise<string[]>;
  getDistinctProductFormalityLevelsImpl?: () => Promise<string[]>;
  getStylesImpl?: (email: string) => Promise<string[]>;
  getDistinctProductOccasionsImpl?: () => Promise<string[]>;
  getDistinctProductColorsImpl?: () => Promise<string[]>;
  getDistinctProductPatternsImpl?: () => Promise<string[]>;
  getDistinctProductSilhouettesImpl?: () => Promise<string[]>;
  getDistinctProductFitsImpl?: () => Promise<string[]>;
  getDistinctProductClosureTypesImpl?: () => Promise<string[]>;
  getProductPriceRangeImpl?: () => Promise<unknown>;
  getSearchByEmailImpl?: (email: string) => Promise<SearchRow | null>;
  upsertSearchByEmailImpl?: (
    payload: SearchPayload & { email: string; embedding: number[] | null },
  ) => Promise<SearchRow | null>;
  searchProductsImpl?: (
    payload: Record<string, unknown>,
  ) => Promise<SearchResults>;
  searchProductStatsImpl?: (payload: SearchPayload) => Promise<unknown>;
  resolveSearchEmbeddingImpl?: typeof resolveSearchEmbedding;
};

// eslint-disable-next-line max-lines-per-function, complexity
function createSearchStore({
  getDistinctProductBrandsImpl = getDistinctProductBrands,
  getDistinctProductCategoriesImpl = getDistinctProductCategories,
  getDistinctProductSeasonsImpl = getDistinctProductSeasons,
  getDistinctProductFormalityLevelsImpl = getDistinctProductFormalityLevels,
  getStylesImpl = getStyles,
  getDistinctProductOccasionsImpl = getDistinctProductOccasions,
  getDistinctProductColorsImpl = getDistinctProductColors,
  getDistinctProductPatternsImpl = getDistinctProductPatterns,
  getDistinctProductSilhouettesImpl = getDistinctProductSilhouettes,
  getDistinctProductFitsImpl = getDistinctProductFits,
  getDistinctProductClosureTypesImpl = getDistinctProductClosureTypes,
  getProductPriceRangeImpl = getProductPriceRange,
  getSearchByEmailImpl = getSearchByEmail,
  upsertSearchByEmailImpl = upsertSearchByEmail,
  searchProductsImpl = searchProducts,
  searchProductStatsImpl = searchProductStats,
  resolveSearchEmbeddingImpl = resolveSearchEmbedding,
}: SearchStoreDeps = {}) {
  async function getSearchOptions(email: string): Promise<SearchOptions> {
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
      priceRange,
    ] = await Promise.all([
      getDistinctProductBrandsImpl(),
      getDistinctProductCategoriesImpl(),
      getDistinctProductSeasonsImpl(),
      getDistinctProductFormalityLevelsImpl(),
      getStylesImpl(email),
      getDistinctProductOccasionsImpl(),
      getDistinctProductColorsImpl(),
      getDistinctProductPatternsImpl(),
      getDistinctProductSilhouettesImpl(),
      getDistinctProductFitsImpl(),
      getDistinctProductClosureTypesImpl(),
      getProductPriceRangeImpl(),
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
      priceRange,
    };
  }

  async function getSavedSearch(email: string): Promise<SearchPayload> {
    const row = await getSearchByEmailImpl(email);
    return serializeSearchRow(row);
  }

  async function runSavedSearch(
    email: string,
    payload: Partial<SearchPayload> = {},
  ): Promise<SearchResults & { savedSearch: SearchPayload }> {
    const normalized = normalizeSearchPayload(payload);
    const [options, currentSearch] = await Promise.all([
      getSearchOptions(email),
      getSearchByEmailImpl(email),
    ]);
    assertValidSearchPayload(normalized, options);

    const textRouting = routeSearchText(normalized.query);
    const embedding = !textRouting.usesEmbedding
      ? null
      : await resolveSearchEmbeddingImpl({
          currentSearch,
          query: normalized.query,
        });
    const semanticDistanceThreshold = textRouting.usesEmbedding
      ? getSemanticDistanceThreshold(normalized.query)
      : null;

    let savedSearch = await upsertSearchByEmailImpl({
      email,
      ...normalized,
      embedding,
    });

    let results = await searchProductsImpl({
      ...normalized,
      profileEmail: email,
      queryEmbedding: embedding,
      semanticDistanceThreshold,
      textQuery: textRouting.textQuery,
      textSearchMode:
        textRouting.mode === "urlPrefix" ? "none" : textRouting.mode,
      urlPrefix: textRouting.urlPrefix,
    });

    if (textRouting.mode === "lexical" && results.total === 0) {
      const fallbackEmbedding = await resolveSearchEmbeddingImpl({
        currentSearch,
        query: normalized.query,
      });

      if (fallbackEmbedding) {
        savedSearch = await upsertSearchByEmailImpl({
          email,
          ...normalized,
          embedding: fallbackEmbedding,
        });

        results = await searchProductsImpl({
          ...normalized,
          profileEmail: email,
          queryEmbedding: fallbackEmbedding,
          semanticDistanceThreshold: getSemanticDistanceThreshold(
            normalized.query,
          ),
          textQuery: textRouting.textQuery,
          textSearchMode: "semantic",
        });
      }
    }

    if (
      (textRouting.mode === "hybrid" || textRouting.mode === "semantic") &&
      results.total === 0
    ) {
      results = await searchProductsImpl({
        ...normalized,
        profileEmail: email,
        queryEmbedding: embedding,
        semanticDistanceThreshold: getRelaxedSemanticDistanceThreshold(
          normalized.query,
        ),
        textQuery: textRouting.textQuery,
        textSearchMode: textRouting.mode,
      });
    }

    return {
      ...results,
      savedSearch: serializeSearchRow(savedSearch),
    };
  }

  async function getSearchStats(
    email: string,
    payload: Partial<SearchPayload> = {},
  ): Promise<unknown> {
    const normalized = normalizeSearchPayload(payload);
    const options = await getSearchOptions(email);
    assertValidSearchPayload(normalized, options);

    return searchProductStatsImpl(normalized);
  }

  return {
    getSearchOptions,
    getSavedSearch,
    runSavedSearch,
    getSearchStats,
  };
}

const defaultSearchStore = createSearchStore();
const { getSearchOptions, getSavedSearch, runSavedSearch, getSearchStats } =
  defaultSearchStore;

export {
  DEFAULT_SEARCH_STATE,
  getSemanticDistanceThreshold,
  getRelaxedSemanticDistanceThreshold,
  isHttpUrlQuery,
  normalizeSearchPayload,
  resolveSearchEmbedding,
  routeSearchText,
  serializeSearchRow,
  createSearchStore,
  getSearchOptions,
  getSavedSearch,
  runSavedSearch,
  getSearchStats,
};
