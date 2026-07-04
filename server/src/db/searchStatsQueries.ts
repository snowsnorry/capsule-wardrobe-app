import {
  getFirstRow,
  getResultRows,
  type CountRow,
  type FacetRow,
  type PriceBucketRow,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
import { buildPriceBuckets, normalizeFacetRows } from "./searchPersistence.js";
import {
  PRICE_BUCKET_COUNT,
  SEARCH_STATS_FACETS,
} from "./searchStatsConfig.js";
import type {
  BuiltSql,
  SearchFacetConfig,
  SearchStatsFacetKey,
  SearchStatsFilters,
  SearchStatsResult,
} from "./searchStatsTypes.js";

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
  for (const facet of SEARCH_STATS_FACETS) {
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

export function createStatsTasks(
  sql: SqlClientLike,
  filters: SearchStatsFilters,
): Array<() => Promise<SqlResultLike>> {
  return [
    () => queryCount(sql, filters),
    ...SEARCH_STATS_FACETS.map(
      (facet) => () => queryFacet(sql, filters, facet),
    ),
    () => queryPriceBuckets(sql, filters),
  ];
}

export function buildStatsResult(rows: SqlResultLike[]): SearchStatsResult {
  const [countRow, ...facetRows] = rows;
  const priceRows = facetRows.pop();
  const stats = Object.fromEntries(
    SEARCH_STATS_FACETS.map((facet, index) => [
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
