import { getSearchByEmail, searchProducts } from "../db.js";
import { assertValidSearchPayload } from "../searchValidation.js";
import type { SearchOptions, SearchPayload } from "../searchTypes.js";
import {
  getRelaxedSemanticDistanceThreshold,
  getSemanticDistanceThreshold,
  getSearchOptions,
  normalizeSearchPayload,
  resolveSearchEmbedding,
  routeSearchText,
} from "../searchStore.js";

const MCP_SEARCH_DEFAULT_LIMIT = 20;
const MCP_SEARCH_MAX_LIMIT = 50;

type SearchResults = {
  items?: unknown[];
  total: number;
  [key: string]: unknown;
};

type SearchRow = Partial<SearchPayload> & {
  embedding?: number[] | null;
};

type McpProductSearchDeps = {
  getSearchOptionsImpl?: (email: string) => Promise<SearchOptions>;
  getSearchByEmailImpl?: (email: string) => Promise<SearchRow | null>;
  searchProductsImpl?: (
    payload: Record<string, unknown>,
  ) => Promise<SearchResults>;
  resolveSearchEmbeddingImpl?: typeof resolveSearchEmbedding;
};

function normalizeSearchOffset(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeSearchLimit(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, MCP_SEARCH_MAX_LIMIT)
    : MCP_SEARCH_DEFAULT_LIMIT;
}

function createMcpProductSearchRunner({
  getSearchOptionsImpl = getSearchOptions,
  getSearchByEmailImpl = getSearchByEmail,
  searchProductsImpl = searchProducts,
  resolveSearchEmbeddingImpl = resolveSearchEmbedding,
}: McpProductSearchDeps = {}) {
  return async function runMcpProductSearch(
    email: string,
    payload: Partial<SearchPayload> & Record<string, unknown> = {},
  ): Promise<SearchResults & { offset: number; limit: number }> {
    const normalized = normalizeSearchPayload(payload);
    const offset = normalizeSearchOffset(payload.offset);
    const limit = normalizeSearchLimit(payload.limit);
    const options = await getSearchOptionsImpl(email);
    assertValidSearchPayload(normalized, options);

    const textRouting = routeSearchText(normalized.query);
    const embedding = await resolveMcpSearchEmbedding({
      currentSearch: textRouting.usesEmbedding
        ? await getSearchByEmailImpl(email)
        : null,
      normalized,
      resolveSearchEmbeddingImpl,
      usesEmbedding: textRouting.usesEmbedding,
    });

    let results = await searchProductsImpl({
      ...normalized,
      profileEmail: email,
      queryEmbedding: embedding,
      semanticDistanceThreshold: textRouting.usesEmbedding
        ? getSemanticDistanceThreshold(normalized.query)
        : null,
      textQuery: textRouting.textQuery,
      textSearchMode:
        textRouting.mode === "urlPrefix" ? "none" : textRouting.mode,
      urlPrefix: textRouting.urlPrefix,
      offset,
      limit,
    });

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
        offset,
        limit,
      });
    }

    return {
      items: Array.isArray(results.items) ? results.items : [],
      total: Number(results.total || 0),
      offset,
      limit,
    };
  };
}

async function resolveMcpSearchEmbedding({
  currentSearch,
  normalized,
  resolveSearchEmbeddingImpl,
  usesEmbedding,
}: {
  currentSearch: SearchRow | null;
  normalized: SearchPayload;
  resolveSearchEmbeddingImpl: typeof resolveSearchEmbedding;
  usesEmbedding: boolean;
}) {
  return !usesEmbedding
    ? null
    : resolveSearchEmbeddingImpl({
        currentSearch,
        query: normalized.query,
      });
}

const runMcpProductSearch = createMcpProductSearchRunner();

export { createMcpProductSearchRunner, runMcpProductSearch };
