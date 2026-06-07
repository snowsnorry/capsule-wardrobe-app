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
import {
  DEFAULT_SEARCH_STATE,
  normalizeSearchPayload,
  serializeSearchRow,
  type SearchRow,
} from "./searchPayloadState.js";

type SearchResults = {
  total: number;
  [key: string]: unknown;
};
type SearchRunPayload = Partial<SearchPayload> & {
  limit?: unknown;
  persist?: unknown;
};

const SEARCH_AUDIENCE_OPTIONS = Object.freeze(["woman", "man", "all"] as const);
const MAX_SEARCH_RUN_LIMIT = 100;

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
  searchProductStatsImpl?: (
    payload: SearchPayload & { profileEmail: string },
  ) => Promise<unknown>;
  resolveSearchEmbeddingImpl?: typeof resolveSearchEmbedding;
};

function normalizeSearchRunLimit(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.min(parsed, MAX_SEARCH_RUN_LIMIT);
}

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

  // eslint-disable-next-line complexity
  async function runSavedSearch(
    email: string,
    payload: SearchRunPayload = {},
  ): Promise<SearchResults & { savedSearch: SearchPayload }> {
    const normalized = normalizeSearchPayload(payload);
    const limit = normalizeSearchRunLimit(payload.limit);
    const shouldPersist = payload.persist !== false;
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

    let savedSearch = shouldPersist
      ? await upsertSearchByEmailImpl({
          email,
          ...normalized,
          embedding,
        })
      : currentSearch;

    let results = await searchProductsImpl({
      ...normalized,
      limit,
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
        if (shouldPersist) {
          savedSearch = await upsertSearchByEmailImpl({
            email,
            ...normalized,
            embedding: fallbackEmbedding,
          });
        }

        results = await searchProductsImpl({
          ...normalized,
          limit,
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
        limit,
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

    return searchProductStatsImpl({ ...normalized, profileEmail: email });
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
