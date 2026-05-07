import {
  SEARCH_PAGE_SIZE,
  getFirstRow,
  getSqlClient,
  isPriceBucket,
  normalizeSearchRow,
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

export async function getSearchByEmail(
  email: string,
): Promise<SearchRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<SearchRowQuery>`
    select
      email,
      query,
      embedding,
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
  embedding,
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
	      email, query, embedding, brand, price_min, price_max, audience, category, season,
	      formality_level, style, occasions, color, pattern, silhouette, fit, closure_type, page
	    )
	    values (
	      ${email}, ${query}, ${embedding === null ? null : JSON.stringify(embedding)}, ${brand},
	      ${priceMin}, ${priceMax}, ${audience}, ${category}, ${season}, ${formalityLevel},
	      ${style}, ${occasions}, ${color}, ${pattern}, ${silhouette}, ${fit}, ${closureType}, ${page}
	    )
	    on conflict (email)
	    do update set
	      query = excluded.query, embedding = excluded.embedding, brand = excluded.brand,
	      price_min = excluded.price_min, price_max = excluded.price_max, audience = excluded.audience,
	      category = excluded.category, season = excluded.season, formality_level = excluded.formality_level,
	      style = excluded.style, occasions = excluded.occasions, color = excluded.color,
	      pattern = excluded.pattern, silhouette = excluded.silhouette, fit = excluded.fit,
	      closure_type = excluded.closure_type, page = excluded.page,
	      updated_at = now()
	    returning
	      email, query, embedding, brand, price_min as "priceMin", price_max as "priceMax",
	      audience, category, season, formality_level as "formalityLevel", style, occasions,
	      color, pattern, silhouette, fit, closure_type as "closureType", page,
	      created_at as "createdAt", updated_at as "updatedAt"
	  `,
  );
  return normalizeSearchRow(row);
}

export async function searchProducts(
  input: SearchProductsInput = {},
): Promise<SearchProductsResult> {
  const sql = getSqlClient();
  const currentPage = getSearchPage(input.page);
  const offset = (currentPage - 1) * SEARCH_PAGE_SIZE;
  const searchQueryParams = buildSearchQueryParams(input);

  const [countRow, items] = await Promise.all([
    querySearchProductCount(sql, searchQueryParams),
    querySearchProductItems(sql, { ...searchQueryParams, offset }),
  ]);

  return {
    items,
    total: Number(countRow?.total || 0),
    page: currentPage,
    pageSize: SEARCH_PAGE_SIZE,
  };
}

function getSearchPage(page) {
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getSearchArray(input, key) {
  return input[key] ?? [];
}

function getEmbeddingVector(queryEmbedding) {
  return Array.isArray(queryEmbedding) && queryEmbedding.length > 0
    ? `[${queryEmbedding.join(",")}]`
    : null;
}

function getNormalizedUrlPrefix(urlPrefix) {
  return typeof urlPrefix === "string" && urlPrefix.trim()
    ? `${urlPrefix.trim()}%`
    : null;
}

function buildSearchQueryParams(input) {
  return {
    audience: getSearchArray(input, "audience"),
    brand: getSearchArray(input, "brand"),
    category: getSearchArray(input, "category"),
    closureType: getSearchArray(input, "closureType"),
    color: getSearchArray(input, "color"),
    embeddingVector: getEmbeddingVector(input.queryEmbedding),
    fit: getSearchArray(input, "fit"),
    formalityLevel: getSearchArray(input, "formalityLevel"),
    normalizedUrlPrefix: getNormalizedUrlPrefix(input.urlPrefix),
    occasions: getSearchArray(input, "occasions"),
    pattern: getSearchArray(input, "pattern"),
    priceMax: input.priceMax ?? null,
    priceMin: input.priceMin ?? null,
    season: getSearchArray(input, "season"),
    semanticDistanceThreshold: input.semanticDistanceThreshold ?? null,
    silhouette: getSearchArray(input, "silhouette"),
    style: getSearchArray(input, "style"),
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
