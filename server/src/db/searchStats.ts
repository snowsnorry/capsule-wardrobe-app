import {
  getFirstRow,
  getResultRows,
  getSqlClient,
  type CountRow,
  type FacetRow,
  type PriceBucket,
  type PriceBucketRow,
  type SearchProductsInput,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
import { buildPriceBuckets, normalizeFacetRows } from "./searchPersistence.js";

const PRICE_BUCKET_COUNT = 100;

type SearchStatsInput = Omit<
  SearchProductsInput,
  | "queryEmbedding"
  | "semanticDistanceThreshold"
  | "page"
  | "profileEmail"
  | "offset"
  | "limit"
  | "textQuery"
  | "textSearchMode"
>;
type SearchStatsFilters = Required<Omit<SearchStatsInput, "urlPrefix">>;
type SearchStatsFacetKey = Exclude<
  keyof SearchStatsFilters,
  "priceMin" | "priceMax"
>;

type SearchStatsResult = {
  total: number;
  stats: Record<SearchStatsFacetKey, Array<{ value: string; count: number }>>;
  priceBuckets: PriceBucket[];
};

type SearchFacetConfig = {
  key: SearchStatsFacetKey;
  column: string;
  mode: "array" | "scalar";
};

type BuiltSql = {
  strings: string[];
  values: unknown[];
};

const FACETS: SearchFacetConfig[] = [
  { key: "brand", column: "brand", mode: "scalar" },
  { key: "category", column: "category", mode: "scalar" },
  { key: "season", column: "season", mode: "array" },
  { key: "audience", column: "audience", mode: "scalar" },
  { key: "formalityLevel", column: "formality_level", mode: "array" },
  { key: "style", column: "style", mode: "array" },
  { key: "occasions", column: "occasions", mode: "array" },
  { key: "color", column: "color_base", mode: "array" },
  { key: "pattern", column: "pattern", mode: "scalar" },
  { key: "silhouette", column: "silhouette", mode: "scalar" },
  { key: "fit", column: "fit", mode: "scalar" },
  { key: "closureType", column: "closure_type", mode: "array" },
];

const DEFAULT_FILTERS: SearchStatsFilters = {
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
};

function withDefault<T>(value: T | undefined, defaultValue: T) {
  return value === undefined ? defaultValue : value;
}

function normalizeSearchStatsInput(
  input: SearchStatsInput = {},
): SearchStatsFilters {
  return {
    brand: withDefault(input.brand, DEFAULT_FILTERS.brand),
    priceMin: withDefault(input.priceMin, DEFAULT_FILTERS.priceMin),
    priceMax: withDefault(input.priceMax, DEFAULT_FILTERS.priceMax),
    audience: withDefault(input.audience, DEFAULT_FILTERS.audience),
    category: withDefault(input.category, DEFAULT_FILTERS.category),
    season: withDefault(input.season, DEFAULT_FILTERS.season),
    formalityLevel: withDefault(
      input.formalityLevel,
      DEFAULT_FILTERS.formalityLevel,
    ),
    style: withDefault(input.style, DEFAULT_FILTERS.style),
    occasions: withDefault(input.occasions, DEFAULT_FILTERS.occasions),
    color: withDefault(input.color, DEFAULT_FILTERS.color),
    pattern: withDefault(input.pattern, DEFAULT_FILTERS.pattern),
    silhouette: withDefault(input.silhouette, DEFAULT_FILTERS.silhouette),
    fit: withDefault(input.fit, DEFAULT_FILTERS.fit),
    closureType: withDefault(input.closureType, DEFAULT_FILTERS.closureType),
  };
}

function addSqlValue(
  sql: BuiltSql,
  before: string,
  value: unknown,
  after = "",
) {
  sql.strings[sql.strings.length - 1] += before;
  sql.values.push(value);
  sql.strings.push(after);
}

function addCondition(sql: BuiltSql, conditionIndex: number) {
  if (conditionIndex > 0) {
    sql.strings[sql.strings.length - 1] += "\n        and ";
  }
}

function addScalarFilter(
  sql: BuiltSql,
  facet: SearchFacetConfig,
  value: string[],
) {
  addSqlValue(
    sql,
    `(cardinality(`,
    value,
    `::text[]) = 0 or lower(coalesce(${facet.column}, '')) = any(`,
  );
  addSqlValue(sql, "", value, "::text[]))");
}

function addArrayFilter(
  sql: BuiltSql,
  facet: SearchFacetConfig,
  value: string[],
) {
  addSqlValue(
    sql,
    `(cardinality(`,
    value,
    `::text[]) = 0 or coalesce(${facet.column}, array[]::text[]) && `,
  );
  addSqlValue(sql, "", value, "::text[])");
}

function addPriceFilter(
  sql: BuiltSql,
  column: "priceMin" | "priceMax",
  value: number | null,
) {
  const operator = column === "priceMin" ? ">=" : "<=";
  addSqlValue(
    sql,
    `(`,
    value,
    `::double precision is null or price ${operator} `,
  );
  addSqlValue(sql, "", value, ")");
}

function addFilterCondition(
  sql: BuiltSql,
  filters: SearchStatsFilters,
  facet: SearchFacetConfig,
) {
  const value = filters[facet.key] as string[];
  if (facet.mode === "array") {
    addArrayFilter(sql, facet, value);
    return;
  }
  addScalarFilter(sql, facet, value);
}

function buildWhereSql(
  filters: SearchStatsFilters,
  excludedFacetKey: SearchStatsFacetKey | null = null,
) {
  const sql: BuiltSql = { strings: ["\n      where\n        "], values: [] };
  let conditionIndex = 0;
  for (const facet of FACETS) {
    if (facet.key === excludedFacetKey) {
      continue;
    }
    addCondition(sql, conditionIndex);
    addFilterCondition(sql, filters, facet);
    conditionIndex += 1;
  }
  addCondition(sql, conditionIndex);
  addPriceFilter(sql, "priceMin", filters.priceMin);
  addCondition(sql, conditionIndex + 1);
  addPriceFilter(sql, "priceMax", filters.priceMax);
  return sql;
}

function toTemplateStringsArray(strings: string[]) {
  const raw = [...strings];
  return Object.assign([...strings], {
    raw,
  }) as unknown as TemplateStringsArray;
}

function mergeSql(start: string, middle: BuiltSql, end = "") {
  const strings = [...middle.strings];
  strings[0] = start + strings[0];
  strings[strings.length - 1] += end;
  return {
    strings: toTemplateStringsArray(strings),
    values: middle.values,
  };
}

function queryBuiltSql<TRow>(
  sql: SqlClientLike,
  start: string,
  middle: BuiltSql,
  end = "",
) {
  const query = mergeSql(start, middle, end);
  return sql<TRow>(query.strings, ...query.values);
}

function queryCount(sql: SqlClientLike, filters: SearchStatsFilters) {
  return queryBuiltSql<CountRow>(
    sql,
    `
      select count(*)::integer as total
      from products`,
    buildWhereSql(filters),
  );
}

function getFacetSelect(facet: SearchFacetConfig) {
  if (facet.mode === "array") {
    return `
      select lower(value) as value, count(*)::integer as count
      from (
        select unnest(coalesce(${facet.column}, array[]::text[])) as value
        from products`;
  }

  return `
      select lower(coalesce(${facet.column}, '')) as value, count(*)::integer as count
      from products`;
}

function getFacetEnd(facet: SearchFacetConfig) {
  const emptyFilter =
    facet.mode === "array"
      ? "\n      ) values_table\n      where value <> ''"
      : `\n        and coalesce(${facet.column}, '') <> ''`;
  return `${emptyFilter}
      group by 1
      order by count desc, value asc
    `;
}

function queryFacet(
  sql: SqlClientLike,
  filters: SearchStatsFilters,
  facet: SearchFacetConfig,
) {
  return queryBuiltSql<FacetRow>(
    sql,
    getFacetSelect(facet),
    buildWhereSql(filters, facet.key),
    getFacetEnd(facet),
  );
}

function queryPriceBuckets(sql: SqlClientLike, filters: SearchStatsFilters) {
  return queryBuiltSql<PriceBucketRow>(
    sql,
    `
      with filtered as (
        select price
        from products`,
    buildWhereSql(filters),
    `
          and price is not null
      ),
      bounds as (
        select min(price) as min_price, max(price) as max_price
        from filtered
      ),
      bucketed as (
        select
          case
            when bounds.min_price is null or bounds.max_price is null then null
            when bounds.min_price = bounds.max_price then 1
            else least(width_bucket(filtered.price, bounds.min_price, bounds.max_price, ${PRICE_BUCKET_COUNT}), ${PRICE_BUCKET_COUNT})
          end as bucket,
          bounds.min_price as "rangeMin",
          bounds.max_price as "rangeMax"
        from filtered
        cross join bounds
      )
      select
        bucket,
        count(*)::integer as count,
        min("rangeMin") as "rangeMin",
        max("rangeMax") as "rangeMax"
      from bucketed
      where bucket is not null
      group by bucket
      order by bucket asc
    `,
  );
}

function buildStatsResult(rows: SqlResultLike[]): SearchStatsResult {
  const [countRow, ...facetRows] = rows;
  const priceRows = facetRows.pop();
  const stats = Object.fromEntries(
    FACETS.map((facet, index) => [
      facet.key,
      normalizeFacetRows(
        getResultRows(facetRows[index] as SqlResultLike<FacetRow>),
      ),
    ]),
  ) as SearchStatsResult["stats"];

  return {
    total: Number(getFirstRow(countRow as SqlResultLike<CountRow>)?.total || 0),
    stats,
    priceBuckets: buildPriceBuckets(
      getResultRows(priceRows as SqlResultLike<PriceBucketRow>),
      PRICE_BUCKET_COUNT,
    ),
  };
}

export async function searchProductStats(
  input: SearchStatsInput = {},
): Promise<SearchStatsResult> {
  const sql = getSqlClient();
  const filters = normalizeSearchStatsInput(input);
  const rows = await Promise.all([
    queryCount(sql, filters),
    ...FACETS.map((facet) => queryFacet(sql, filters, facet)),
    queryPriceBuckets(sql, filters),
  ]);

  return buildStatsResult(rows);
}
