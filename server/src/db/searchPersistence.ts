import {
  SEARCH_PAGE_SIZE,
  getFirstRow,
  getSqlClient,
  isPriceBucket,
  toOptionalNumber,
  type BucketRangeRow,
  type FacetRow,
  type PriceBucket,
  type PriceBucketRow,
  type SearchProductsInput,
  type SearchProductsResult,
  type SearchRow,
  type SearchRowQuery,
  type UpsertSearchInput,
} from "./core.js";
import {
  querySearchProductCount,
  querySearchProductItems,
} from "./searchProductQueries.js";
import { hexToLabVector } from "../colorLab.js";
import type { ExactColorRange } from "../searchTypes.js";

const EXACT_COLOR_DISTANCE_BY_RANGE = Object.freeze({
  closest: 4,
  close: 7,
  balanced: 10,
  broad: 15,
  broadest: 20,
} satisfies Record<ExactColorRange, number>);

type ProductSearchInput = SearchProductsInput & {
  profileEmail?: string | null;
  offset?: number;
  limit?: number;
};

function normalizeSearchRow(row: SearchRowQuery | null): SearchRow | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    embedding: Array.isArray(row.embedding)
      ? row.embedding.filter(
          (value): value is number => typeof value === "number",
        )
      : null,
    likedOnly: row.likedOnly === true,
    priceMin: toOptionalNumber(row.priceMin),
    priceMax: toOptionalNumber(row.priceMax),
  };
}

export async function getSearchByEmail(
  email: string,
): Promise<SearchRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<SearchRowQuery>`
    select
      email,
      query,
      exact_color as "exactColor",
      exact_color_range as "exactColorRange",
      embedding,
      liked_only as "likedOnly",
      brand,
      price_min as "priceMin",
      price_max as "priceMax",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color,
      pattern,
      silhouette,
      fit,
      closure_type as "closureType",
      page,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from search
    where email = ${email}
    limit 1
  `,
  );
  return normalizeSearchRow(row);
}

export async function upsertSearchByEmail({
  email,
  query,
  exactColor,
  exactColorRange,
  embedding,
  likedOnly,
  brand,
  priceMin,
  priceMax,
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
  page,
}: UpsertSearchInput): Promise<SearchRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<SearchRowQuery>`
	    insert into search (
	      email, query, exact_color, exact_color_range, embedding, liked_only, brand, price_min, price_max, audience, category, season,
	      formality_level, style, occasions, color, pattern, silhouette, fit, closure_type, page
	    )
	    values (
	      ${email}, ${query}, ${exactColor}, ${exactColorRange}, ${embedding === null ? null : JSON.stringify(embedding)}, ${likedOnly}, ${brand},
	      ${priceMin}, ${priceMax}, ${audience}, ${category}, ${season}, ${formalityLevel},
	      ${style}, ${occasions}, ${color}, ${pattern}, ${silhouette}, ${fit}, ${closureType}, ${page}
	    )
	    on conflict (email)
	    do update set
	      query = excluded.query, embedding = excluded.embedding, liked_only = excluded.liked_only,
	      exact_color = excluded.exact_color, exact_color_range = excluded.exact_color_range,
	      brand = excluded.brand,
	      price_min = excluded.price_min, price_max = excluded.price_max, audience = excluded.audience,
	      category = excluded.category, season = excluded.season, formality_level = excluded.formality_level,
	      style = excluded.style, occasions = excluded.occasions, color = excluded.color,
	      pattern = excluded.pattern, silhouette = excluded.silhouette, fit = excluded.fit,
	      closure_type = excluded.closure_type, page = excluded.page,
	      updated_at = now()
	    returning
	      email, query, exact_color as "exactColor", exact_color_range as "exactColorRange", embedding, liked_only as "likedOnly", brand, price_min as "priceMin", price_max as "priceMax",
	      audience, category, season, formality_level as "formalityLevel", style, occasions,
	      color, pattern, silhouette, fit, closure_type as "closureType", page,
	      created_at as "createdAt", updated_at as "updatedAt"
	  `,
  );
  return normalizeSearchRow(row);
}

export async function searchProducts(
  input: ProductSearchInput = {},
): Promise<SearchProductsResult> {
  const sql = getSqlClient();
  const currentPage = getSearchPage(input.page);
  const limit = getSearchLimit(input.limit);
  const offset = getSearchOffset(input.offset, currentPage, limit);
  const searchQueryParams = buildSearchQueryParams(input);

  const [countRow, items] = await Promise.all([
    querySearchProductCount(sql, searchQueryParams),
    querySearchProductItems(sql, { ...searchQueryParams, limit, offset }),
  ]);

  return {
    items,
    total: Number(countRow?.total || 0),
    page: currentPage,
    pageSize: limit,
  };
}

function getSearchPage(page) {
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getSearchLimit(limit) {
  return Number.isInteger(limit) && limit > 0 ? limit : SEARCH_PAGE_SIZE;
}

function getSearchOffset(offset, page, limit) {
  return Number.isInteger(offset) && offset >= 0 ? offset : (page - 1) * limit;
}

function getSearchArray(input, key) {
  return input[key] ?? [];
}

function getEmbeddingVector(queryEmbedding) {
  return Array.isArray(queryEmbedding) && queryEmbedding.length > 0
    ? `[${queryEmbedding.join(",")}]`
    : null;
}

function getExactColorLab(exactColor) {
  return typeof exactColor === "string" && /^#[0-9a-f]{6}$/.test(exactColor)
    ? hexToLabVector(exactColor)
    : null;
}

function getExactColorMaximumDistance(
  exactColorRange: ExactColorRange | undefined,
): number {
  return EXACT_COLOR_DISTANCE_BY_RANGE[exactColorRange || "balanced"];
}

function getNormalizedUrlPrefix(urlPrefix) {
  return typeof urlPrefix === "string" && urlPrefix.trim()
    ? `${urlPrefix.trim()}%`
    : null;
}

function getNormalizedTextQuery(textQuery) {
  return typeof textQuery === "string" && textQuery.trim()
    ? textQuery.trim().toLowerCase()
    : null;
}

function escapeLikePattern(value) {
  return value.replace(/~/g, "~~").replace(/%/g, "~%").replace(/_/g, "~_");
}

function getTextSearchMode(input) {
  const textQuery = getNormalizedTextQuery(input.textQuery);
  const mode = input.textSearchMode;
  if (
    textQuery &&
    (mode === "lexical" || mode === "hybrid" || mode === "semantic")
  ) {
    return mode;
  }
  if (
    Array.isArray(input.queryEmbedding) &&
    input.queryEmbedding.length > 0 &&
    input.semanticDistanceThreshold !== null &&
    input.semanticDistanceThreshold !== undefined
  ) {
    return "semantic";
  }
  return "none";
}

function buildSearchQueryParams(input) {
  const normalizedTextQuery = getNormalizedTextQuery(input.textQuery);
  const escapedTextQuery = normalizedTextQuery
    ? escapeLikePattern(normalizedTextQuery)
    : null;
  return {
    audience: getSearchArray(input, "audience"),
    brand: getSearchArray(input, "brand"),
    category: getSearchArray(input, "category"),
    closureType: getSearchArray(input, "closureType"),
    color: getSearchArray(input, "color"),
    exactColorLab: getExactColorLab(input.exactColor),
    exactColorMaximumDistance: getExactColorMaximumDistance(
      input.exactColorRange,
    ),
    embeddingVector: getEmbeddingVector(input.queryEmbedding),
    fit: getSearchArray(input, "fit"),
    formalityLevel: getSearchArray(input, "formalityLevel"),
    likedOnly: input.likedOnly === true,
    normalizedUrlPrefix: getNormalizedUrlPrefix(input.urlPrefix),
    occasions: getSearchArray(input, "occasions"),
    pattern: getSearchArray(input, "pattern"),
    profileEmail:
      typeof input.profileEmail === "string" && input.profileEmail.trim()
        ? input.profileEmail.trim()
        : null,
    priceMax: input.priceMax ?? null,
    priceMin: input.priceMin ?? null,
    season: getSearchArray(input, "season"),
    semanticDistanceThreshold: input.semanticDistanceThreshold ?? null,
    silhouette: getSearchArray(input, "silhouette"),
    style: getSearchArray(input, "style"),
    textContainsPattern: escapedTextQuery ? `%${escapedTextQuery}%` : null,
    textPrefixPattern: escapedTextQuery ? `${escapedTextQuery}%` : null,
    textQuery: normalizedTextQuery,
    textSearchMode: getTextSearchMode(input),
  };
}

export function normalizeFacetRows(
  rows: FacetRow[] = [],
): Array<{ value: string; count: number }> {
  return rows
    .map((row) => ({
      value: String(row?.value || "")
        .trim()
        .toLowerCase(),
      count: Number(row?.count || 0),
    }))
    .filter((row) => row.value && row.count > 0);
}

export function buildPriceBuckets(
  rows: PriceBucketRow[] = [],
  bucketCount: number,
): PriceBucket[] {
  const normalizedRows = rows
    .map(normalizePriceBucketRow)
    .filter((row): row is PriceBucket | BucketRangeRow => Boolean(row));

  if (normalizedRows.length === 0) {
    return [];
  }

  const firstRow = normalizedRows[0];
  if (isPriceBucket(firstRow)) {
    return [
      {
        key: `${firstRow.min}:${firstRow.max}`,
        min: firstRow.min,
        max: firstRow.max,
        count: firstRow.count,
      },
    ];
  }

  const rangeRows = normalizedRows.filter(
    (row): row is BucketRangeRow => !isPriceBucket(row),
  );
  const { rangeMin, rangeMax } = firstRow;
  const countByBucket = new Map(
    rangeRows.map((row) => [row.bucket, row.count]),
  );
  const step = (rangeMax - rangeMin) / bucketCount;

  return Array.from({ length: bucketCount }, (_, index) =>
    buildPriceBucketRange({
      index,
      bucketCount,
      rangeMin,
      rangeMax,
      step,
      countByBucket,
    }),
  );
}

function normalizePriceBucketRow(row): PriceBucket | BucketRangeRow | null {
  const bucket = Number(row?.bucket || 0);
  const count = Number(row?.count || 0);
  const rangeMin = Number(row?.rangeMin);
  const rangeMax = Number(row?.rangeMax);

  if (!isValidBucketRange({ bucket, count, rangeMin, rangeMax })) {
    return null;
  }

  return rangeMin === rangeMax
    ? { key: `${rangeMin}:${rangeMax}`, min: rangeMin, max: rangeMax, count }
    : { bucket, rangeMin, rangeMax, count };
}

function isValidBucketRange({ bucket, count, rangeMin, rangeMax }) {
  return (
    Number.isInteger(bucket) &&
    bucket > 0 &&
    count >= 0 &&
    Number.isFinite(rangeMin) &&
    Number.isFinite(rangeMax)
  );
}

function buildPriceBucketRange({
  index,
  bucketCount,
  rangeMin,
  rangeMax,
  step,
  countByBucket,
}) {
  const bucket = index + 1;
  const min = rangeMin + step * index;
  const max = bucket === bucketCount ? rangeMax : rangeMin + step * bucket;

  return {
    key: `${min}:${max}`,
    min,
    max,
    count: countByBucket.get(bucket) || 0,
  };
}
