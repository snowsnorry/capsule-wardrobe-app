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
  stableStringify,
} from "./core.js";
import { buildPriceBuckets, normalizeFacetRows } from "./searchPersistence.js";

const PRICE_BUCKET_COUNT = 100;
const SEARCH_STATS_CACHE_TTL_MS = 30_000;
const SEARCH_STATS_CACHE_MAX_ENTRIES = 100;
const SEARCH_STATS_QUERY_CONCURRENCY = 4;

type SearchStatsInput = Omit<
  SearchProductsInput,
  | "queryEmbedding"
  | "semanticDistanceThreshold"
  | "page"
  | "offset"
  | "limit"
  | "textQuery"
  | "textSearchMode"
>;
type SearchStatsFilters = Required<Omit<SearchStatsInput, "urlPrefix">>;
type SearchStatsFacetKey = Exclude<
  keyof SearchStatsFilters,
  "likedOnly" | "priceMin" | "priceMax" | "profileEmail"
>;

type SearchStatsResult = {
  total: number;
  stats: Record<SearchStatsFacetKey, Array<{ value: string; count: number }>>;
  priceBuckets: PriceBucket[];
};
type SearchStatsCacheEntry = {
  expiresAt: number;
  pending: Promise<SearchStatsResult> | null;
  value: SearchStatsResult | null;
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
  likedOnly: false,
  profileEmail: null,
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
const searchStatsCache = new Map<string, SearchStatsCacheEntry>();

function withDefault<T>(value: T | undefined, defaultValue: T) {
  return value === undefined ? defaultValue : value;
}

function normalizeArrayFilter(
  value: string[] | undefined,
  defaultValue: string[],
) {
  return [...withDefault(value, defaultValue)].sort();
}

function normalizeSearchStatsInput(
  input: SearchStatsInput = {},
): SearchStatsFilters {
  return {
    brand: normalizeArrayFilter(input.brand, DEFAULT_FILTERS.brand),
    likedOnly: withDefault(input.likedOnly, DEFAULT_FILTERS.likedOnly),
    profileEmail: withDefault(input.profileEmail, DEFAULT_FILTERS.profileEmail),
    priceMin: withDefault(input.priceMin, DEFAULT_FILTERS.priceMin),
    priceMax: withDefault(input.priceMax, DEFAULT_FILTERS.priceMax),
    audience: normalizeArrayFilter(input.audience, DEFAULT_FILTERS.audience),
    category: normalizeArrayFilter(input.category, DEFAULT_FILTERS.category),
    season: normalizeArrayFilter(input.season, DEFAULT_FILTERS.season),
    formalityLevel: normalizeArrayFilter(
      input.formalityLevel,
      DEFAULT_FILTERS.formalityLevel,
    ),
    style: normalizeArrayFilter(input.style, DEFAULT_FILTERS.style),
    occasions: normalizeArrayFilter(input.occasions, DEFAULT_FILTERS.occasions),
    color: normalizeArrayFilter(input.color, DEFAULT_FILTERS.color),
    pattern: normalizeArrayFilter(input.pattern, DEFAULT_FILTERS.pattern),
    silhouette: normalizeArrayFilter(
      input.silhouette,
      DEFAULT_FILTERS.silhouette,
    ),
    fit: normalizeArrayFilter(input.fit, DEFAULT_FILTERS.fit),
    closureType: normalizeArrayFilter(
      input.closureType,
      DEFAULT_FILTERS.closureType,
    ),
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
    `::text[]) = 0 or ${facet.column} && `,
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

function addLikedOnlyFilter(
  sql: BuiltSql,
  likedOnly: boolean,
  profileEmail: string | null,
) {
  addSqlValue(sql, `(`, likedOnly, `::boolean is not true or (`);
  addSqlValue(sql, "", profileEmail, "::text is not null and exists (");
  addSqlValue(
    sql,
    `
          select 1
          from user_liked_items
          where user_liked_items.user_email = `,
    profileEmail,
    `
            and user_liked_items.item_url = products.url
        )))`,
  );
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
  addCondition(sql, conditionIndex + 2);
  addLikedOnlyFilter(sql, filters.likedOnly, filters.profileEmail);
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

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );
  return results;
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

function getCachedStatsValue(
  cacheKey: string,
  cached: SearchStatsCacheEntry | undefined,
  now: number,
) {
  if (cached?.value && cached.expiresAt > now) {
    searchStatsCache.delete(cacheKey);
    searchStatsCache.set(cacheKey, cached);
    return cached.value;
  }
  return cached?.pending || null;
}

function createStatsTasks(
  sql: SqlClientLike,
  filters: SearchStatsFilters,
): Array<() => Promise<SqlResultLike>> {
  return [
    () => queryCount(sql, filters),
    ...FACETS.map((facet) => () => queryFacet(sql, filters, facet)),
    () => queryPriceBuckets(sql, filters),
  ];
}

function trimSearchStatsCache() {
  while (searchStatsCache.size > SEARCH_STATS_CACHE_MAX_ENTRIES) {
    const firstKey = searchStatsCache.keys().next().value;
    if (firstKey === undefined) return;
    searchStatsCache.delete(firstKey);
  }
}

function restoreFailedStatsCacheRefresh(
  cacheKey: string,
  entry: SearchStatsCacheEntry,
  cached: SearchStatsCacheEntry | undefined,
) {
  if (searchStatsCache.get(cacheKey) !== entry) {
    return;
  }
  if (!cached?.value) {
    searchStatsCache.delete(cacheKey);
    return;
  }
  searchStatsCache.set(cacheKey, {
    expiresAt: cached.expiresAt,
    pending: null,
    value: cached.value,
  });
}

async function resolveStatsPending({
  cacheKey,
  cached,
  entry,
  pending,
}: {
  cacheKey: string;
  cached: SearchStatsCacheEntry | undefined;
  entry: SearchStatsCacheEntry;
  pending: Promise<SearchStatsResult>;
}) {
  let succeeded = false;
  try {
    const value = await pending;
    succeeded = true;
    entry.value = value;
    entry.expiresAt = Date.now() + SEARCH_STATS_CACHE_TTL_MS;
    return value;
  } finally {
    if (entry.pending === pending) {
      entry.pending = null;
    }
    if (!succeeded) {
      restoreFailedStatsCacheRefresh(cacheKey, entry, cached);
    }
  }
}

export async function searchProductStats(
  input: SearchStatsInput = {},
): Promise<SearchStatsResult> {
  const sql = getSqlClient();
  const filters = normalizeSearchStatsInput(input);
  const cacheKey = stableStringify(filters);
  const now = Date.now();
  const cached = searchStatsCache.get(cacheKey);
  const cachedValue = getCachedStatsValue(cacheKey, cached, now);
  if (cachedValue) {
    return cachedValue;
  }

  const pending = runWithConcurrency(
    createStatsTasks(sql, filters),
    SEARCH_STATS_QUERY_CONCURRENCY,
  ).then(buildStatsResult);
  const entry: SearchStatsCacheEntry = {
    expiresAt: cached?.expiresAt || 0,
    pending,
    value: cached?.value || null,
  };
  searchStatsCache.set(cacheKey, entry);
  trimSearchStatsCache();

  return resolveStatsPending({ cacheKey, cached, entry, pending });
}

export function clearSearchProductStatsCache() {
  searchStatsCache.clear();
}
