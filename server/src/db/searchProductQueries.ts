import {
  getFirstRow,
  getResultRows,
  getSqlClient,
  type CountRow,
  type ProductSearchRow,
} from "./core.js";
import { executeSqlFile } from "./sqlFiles.js";

const SEARCH_PRODUCT_COUNT_SQL_FILE = new URL(
  "./sql/search_product_count.sql",
  import.meta.url,
);
const SEARCH_PRODUCT_ITEMS_SQL_FILE = new URL(
  "./sql/search_product_items.sql",
  import.meta.url,
);

type SearchQueryParams = {
  audience: string[];
  brand: string[];
  category: string[];
  closureType: string[];
  color: string[];
  embeddingVector: string | null;
  fit: string[];
  formalityLevel: string[];
  likedOnly: boolean;
  normalizedUrlPrefix: string | null;
  occasions: string[];
  pattern: string[];
  profileEmail: string | null;
  priceMax: number | null;
  priceMin: number | null;
  season: string[];
  semanticDistanceThreshold: number | null;
  silhouette: string[];
  style: string[];
  textContainsPattern: string | null;
  textPrefixPattern: string | null;
  textQuery: string | null;
  textSearchMode: "none" | "lexical" | "hybrid" | "semantic";
};

type SearchItemsQueryParams = SearchQueryParams & {
  limit: number;
  offset: number;
};

function buildSearchQuerySqlValues({
  audience,
  brand,
  category,
  closureType,
  color,
  embeddingVector,
  fit,
  formalityLevel,
  likedOnly,
  normalizedUrlPrefix,
  occasions,
  pattern,
  profileEmail,
  priceMax,
  priceMin,
  season,
  semanticDistanceThreshold,
  silhouette,
  style,
  textContainsPattern,
  textPrefixPattern,
  textQuery,
  textSearchMode,
}: SearchQueryParams): readonly unknown[] {
  return [
    embeddingVector,
    textQuery,
    textPrefixPattern,
    textContainsPattern,
    brand,
    normalizedUrlPrefix,
    priceMin,
    priceMax,
    likedOnly,
    profileEmail,
    audience,
    category,
    season,
    formalityLevel,
    style,
    occasions,
    color,
    pattern,
    silhouette,
    fit,
    closureType,
    textSearchMode,
    semanticDistanceThreshold,
  ];
}

function buildSearchItemsSqlValues(
  params: SearchItemsQueryParams,
): readonly unknown[] {
  return [...buildSearchQuerySqlValues(params), params.limit, params.offset];
}

async function querySearchProductCount(
  sql: ReturnType<typeof getSqlClient>,
  params: SearchQueryParams,
): Promise<CountRow | null> {
  return getFirstRow(
    await executeSqlFile<CountRow>(
      sql,
      SEARCH_PRODUCT_COUNT_SQL_FILE,
      buildSearchQuerySqlValues(params),
    ),
  );
}

async function querySearchProductItems(
  sql: ReturnType<typeof getSqlClient>,
  params: SearchItemsQueryParams,
): Promise<ProductSearchRow[]> {
  return getResultRows(
    await executeSqlFile<ProductSearchRow>(
      sql,
      SEARCH_PRODUCT_ITEMS_SQL_FILE,
      buildSearchItemsSqlValues(params),
    ),
  );
}

export { querySearchProductCount, querySearchProductItems };
