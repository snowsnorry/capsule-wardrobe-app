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
  type SearchRowLike,
} from "./searchPayloadState.js";
import {
  resolveSearchStoreDeps,
  type ResolvedSearchStoreDeps,
  type SearchResults,
  type SearchStoreDeps,
} from "./searchStoreDeps.js";

type SearchRunPayload = Partial<SearchPayload> & {
  limit?: unknown;
  persist?: unknown;
};

const SEARCH_AUDIENCE_OPTIONS = Object.freeze(["woman", "man", "all"] as const);
const MAX_SEARCH_RUN_LIMIT = 100;

type SearchTextRouting = ReturnType<typeof routeSearchText>;
type SearchExecutionInput = {
  email: string;
  limit?: number;
  normalized: SearchPayload;
  queryEmbedding: number[] | null;
  semanticDistanceThreshold: number | null;
  textRouting: SearchTextRouting;
};
type SearchRunContext = {
  currentSearch: SearchRowLike | null;
  deps: ResolvedSearchStoreDeps;
  email: string;
  limit?: number;
  normalized: SearchPayload;
  shouldPersist: boolean;
  textRouting: SearchTextRouting;
};

function normalizeSearchRunLimit(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.min(parsed, MAX_SEARCH_RUN_LIMIT);
}

async function getSearchOptionsForStore(
  email: string,
  deps: ResolvedSearchStoreDeps,
): Promise<SearchOptions> {
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
    deps.getDistinctProductBrandsImpl(),
    deps.getDistinctProductCategoriesImpl(),
    deps.getDistinctProductSeasonsImpl(),
    deps.getDistinctProductFormalityLevelsImpl(),
    deps.getStylesImpl(email),
    deps.getDistinctProductOccasionsImpl(),
    deps.getDistinctProductColorsImpl(),
    deps.getDistinctProductPatternsImpl(),
    deps.getDistinctProductSilhouettesImpl(),
    deps.getDistinctProductFitsImpl(),
    deps.getDistinctProductClosureTypesImpl(),
    deps.getProductPriceRangeImpl(),
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

function buildSearchProductsPayload({
  email,
  limit,
  normalized,
  queryEmbedding,
  semanticDistanceThreshold,
  textRouting,
}: SearchExecutionInput): Record<string, unknown> {
  return {
    ...normalized,
    limit,
    profileEmail: email,
    queryEmbedding,
    semanticDistanceThreshold,
    textQuery: textRouting.textQuery,
    textSearchMode:
      textRouting.mode === "urlPrefix" ? "none" : textRouting.mode,
    urlPrefix: textRouting.urlPrefix,
  };
}

async function persistSearchIfNeeded({
  deps,
  email,
  normalized,
  queryEmbedding,
  shouldPersist,
  currentSearch,
}: {
  currentSearch: SearchRowLike | null;
  deps: ResolvedSearchStoreDeps;
  email: string;
  normalized: SearchPayload;
  queryEmbedding: number[] | null;
  shouldPersist: boolean;
}): Promise<SearchRowLike | null> {
  return shouldPersist
    ? deps.upsertSearchByEmailImpl({
        email,
        ...normalized,
        embedding: queryEmbedding,
      })
    : currentSearch;
}

async function runLexicalSemanticFallback(
  context: SearchRunContext,
  results: SearchResults,
  savedSearch: SearchRowLike | null,
): Promise<{ results: SearchResults; savedSearch: SearchRowLike | null }> {
  if (context.textRouting.mode !== "lexical" || results.total !== 0) {
    return { results, savedSearch };
  }

  const fallbackEmbedding = await context.deps.resolveSearchEmbeddingImpl({
    currentSearch: context.currentSearch,
    query: context.normalized.query,
  });
  if (!fallbackEmbedding) {
    return { results, savedSearch };
  }

  return {
    savedSearch: await persistSearchIfNeeded({
      ...context,
      queryEmbedding: fallbackEmbedding,
    }),
    results: await context.deps.searchProductsImpl(
      buildSearchProductsPayload({
        ...context,
        queryEmbedding: fallbackEmbedding,
        semanticDistanceThreshold: getSemanticDistanceThreshold(
          context.normalized.query,
        ),
        textRouting: { ...context.textRouting, mode: "semantic" },
      }),
    ),
  };
}

async function runRelaxedSemanticFallback(
  context: SearchRunContext,
  results: SearchResults,
  queryEmbedding: number[] | null,
): Promise<SearchResults> {
  const shouldRetry =
    (context.textRouting.mode === "hybrid" ||
      context.textRouting.mode === "semantic") &&
    results.total === 0;
  if (!shouldRetry) {
    return results;
  }

  return context.deps.searchProductsImpl(
    buildSearchProductsPayload({
      ...context,
      queryEmbedding,
      semanticDistanceThreshold: getRelaxedSemanticDistanceThreshold(
        context.normalized.query,
      ),
    }),
  );
}

async function runSavedSearchForStore(
  email: string,
  payload: SearchRunPayload,
  deps: ResolvedSearchStoreDeps,
): Promise<SearchResults & { savedSearch: SearchPayload }> {
  const normalized = normalizeSearchPayload(payload);
  const limit = normalizeSearchRunLimit(payload.limit);
  const shouldPersist = payload.persist !== false;
  const [options, currentSearch] = await Promise.all([
    getSearchOptionsForStore(email, deps),
    deps.getSearchByEmailImpl(email),
  ]);
  assertValidSearchPayload(normalized, options);

  const textRouting = routeSearchText(normalized.query);
  const queryEmbedding = textRouting.usesEmbedding
    ? await deps.resolveSearchEmbeddingImpl({
        currentSearch,
        query: normalized.query,
      })
    : null;
  const semanticDistanceThreshold = textRouting.usesEmbedding
    ? getSemanticDistanceThreshold(normalized.query)
    : null;
  const context = {
    currentSearch,
    deps,
    email,
    limit,
    normalized,
    shouldPersist,
    textRouting,
  };
  let savedSearch = await persistSearchIfNeeded({
    ...context,
    queryEmbedding,
  });
  let results = await deps.searchProductsImpl(
    buildSearchProductsPayload({
      ...context,
      queryEmbedding,
      semanticDistanceThreshold,
    }),
  );
  ({ results, savedSearch } = await runLexicalSemanticFallback(
    context,
    results,
    savedSearch,
  ));
  results = await runRelaxedSemanticFallback(context, results, queryEmbedding);

  return {
    ...results,
    savedSearch: serializeSearchRow(savedSearch),
  };
}

async function getSearchStatsForStore(
  email: string,
  payload: Partial<SearchPayload>,
  deps: ResolvedSearchStoreDeps,
): Promise<unknown> {
  const normalized = normalizeSearchPayload(payload);
  const options = await getSearchOptionsForStore(email, deps);
  assertValidSearchPayload(normalized, options);

  return deps.searchProductStatsImpl({ ...normalized, profileEmail: email });
}

function createSearchStore(deps: SearchStoreDeps = {}) {
  const resolvedDeps = resolveSearchStoreDeps(deps);
  return {
    getSearchOptions: (email: string) =>
      getSearchOptionsForStore(email, resolvedDeps),
    getSavedSearch: async (email: string) =>
      serializeSearchRow(await resolvedDeps.getSearchByEmailImpl(email)),
    runSavedSearch: (email: string, payload: SearchRunPayload = {}) =>
      runSavedSearchForStore(email, payload, resolvedDeps),
    getSearchStats: (email: string, payload: Partial<SearchPayload> = {}) =>
      getSearchStatsForStore(email, payload, resolvedDeps),
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
