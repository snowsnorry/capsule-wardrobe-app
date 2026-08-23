import {
  getFirstRow,
  getResultRows,
  getSqlClient,
  type CountRow,
  type ProductSearchRow,
} from "./core.js";
import { executeSqlFile, executeTransformedSqlFile } from "./sqlFiles.js";

const EXACT_COLOR_MINIMUM_SHARE = 0.08;

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
  exactColorLab: string | null;
  exactColorMaximumDistance: number;
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
  const values = [
    ...buildSearchQuerySqlValues(params),
    params.limit,
    params.offset,
  ];
  return params.exactColorLab
    ? [
        ...values,
        params.exactColorLab,
        EXACT_COLOR_MINIMUM_SHARE,
        params.exactColorMaximumDistance,
      ]
    : values;
}

function buildSearchCountSqlValues(params: SearchQueryParams) {
  const values = [...buildSearchQuerySqlValues(params)];
  return params.exactColorLab
    ? [
        ...values,
        params.exactColorLab,
        EXACT_COLOR_MINIMUM_SHARE,
        params.exactColorMaximumDistance,
      ]
    : values;
}

function addExactColorItemsSql(query: string): string {
  return query
    .replace(
      "/* EXACT_COLOR_PARAMS */",
      `, $26::vector(3) AS exact_color_lab
       , $27::double precision AS exact_color_minimum_share
       , $28::double precision AS exact_color_maximum_distance`,
    )
    .replace(
      "/* EXACT_COLOR_SELECT */",
      `, matched_color.hex AS "matchedColor"
       , matched_color.share AS "matchedColorShare"
       , matched_color.color_index AS "matchedColorIndex"
       , matched_color.color_distance AS "colorDistance"`,
    )
    .replace(
      "/* EXACT_COLOR_JOIN */",
      `JOIN LATERAL (
         SELECT
           product_colors.hex,
           product_colors.share,
           product_colors.color_index,
           product_colors.lab <-> params.exact_color_lab AS color_distance
         FROM product_colors
         WHERE product_colors.product_url = matching_products.url
           AND product_colors.share >= params.exact_color_minimum_share
         ORDER BY
           product_colors.lab <-> params.exact_color_lab,
           product_colors.share DESC,
           product_colors.color_index
         LIMIT 1
       ) AS matched_color
         ON matched_color.color_distance <= params.exact_color_maximum_distance`,
    )
    .replace(
      "/* EXACT_COLOR_ORDER */",
      `matched_color.color_distance ASC,
       matched_color.share DESC,`,
    );
}

function addExactColorCountSql(query: string): string {
  return query
    .replace(
      "/* EXACT_COLOR_PARAMS */",
      `, $24::vector(3) AS exact_color_lab
       , $25::double precision AS exact_color_minimum_share
       , $26::double precision AS exact_color_maximum_distance`,
    )
    .replace(
      "/* EXACT_COLOR_JOIN */",
      `JOIN LATERAL (
         SELECT product_colors.lab <-> params.exact_color_lab AS color_distance
         FROM product_colors
         WHERE product_colors.product_url = filtered_products.url
           AND product_colors.share >= params.exact_color_minimum_share
         ORDER BY
           product_colors.lab <-> params.exact_color_lab,
           product_colors.share DESC,
           product_colors.color_index
         LIMIT 1
       ) AS matched_color
         ON matched_color.color_distance <= params.exact_color_maximum_distance`,
    );
}

async function querySearchProductCount(
  sql: ReturnType<typeof getSqlClient>,
  params: SearchQueryParams,
): Promise<CountRow | null> {
  const values = buildSearchCountSqlValues(params);
  return getFirstRow(
    await (params.exactColorLab
      ? executeTransformedSqlFile<CountRow>(
          sql,
          SEARCH_PRODUCT_COUNT_SQL_FILE,
          values,
          addExactColorCountSql,
        )
      : executeSqlFile<CountRow>(sql, SEARCH_PRODUCT_COUNT_SQL_FILE, values)),
  );
}

async function querySearchProductItems(
  sql: ReturnType<typeof getSqlClient>,
  params: SearchItemsQueryParams,
): Promise<ProductSearchRow[]> {
  const values = buildSearchItemsSqlValues(params);
  return getResultRows(
    await (params.exactColorLab
      ? executeTransformedSqlFile<ProductSearchRow>(
          sql,
          SEARCH_PRODUCT_ITEMS_SQL_FILE,
          values,
          addExactColorItemsSql,
        )
      : executeSqlFile<ProductSearchRow>(
          sql,
          SEARCH_PRODUCT_ITEMS_SQL_FILE,
          values,
        )),
  );
}

export { querySearchProductCount, querySearchProductItems };
