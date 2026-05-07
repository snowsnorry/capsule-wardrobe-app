import {
  getFirstRow,
  getResultRows,
  getSqlClient,
  toOptionalNumber,
  type BrandOptionRow,
  type BooleanFlagRow,
  type NumericRangeRow,
  type ProductRow,
  type ProductWithEmbeddingRow,
  type StringValueRow,
} from "./core.js";

export async function hasProfileByEmail(email: string): Promise<boolean> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<BooleanFlagRow>`
    select exists(select 1 from profiles where email = ${email}) as "hasProfile"
  `,
  );
  return Boolean(row?.hasProfile);
}

export async function getDistinctProductFormalityLevels(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<StringValueRow>`
    select distinct trim(value) as value
    from products
    cross join unnest(coalesce(formality_level, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value
  `,
  );
  return rows.map((row) => row.value).filter(Boolean);
}

export async function getDistinctProductOccasions(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<StringValueRow>`
    select distinct trim(value) as value
    from products
    cross join unnest(coalesce(occasions, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value
  `,
  );
  return rows.map((row) => row.value).filter(Boolean);
}

export async function getDistinctProductSeasons(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<StringValueRow>`
    select distinct trim(value) as value
    from products
    cross join unnest(coalesce(season, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value
  `,
  );
  return rows.map((row) => row.value).filter(Boolean);
}

export async function getDistinctProductPatterns(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<StringValueRow>`
    select distinct
      lower(trim(pattern)) as value
    from products
    where
      nullif(trim(pattern), '') is not null
    order by value asc
  `,
  );
  return rows.map((row) => row.value).filter(Boolean);
}

export async function getDistinctProductBrands(): Promise<
  Array<{ value: string; label: string }>
> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<BrandOptionRow>`
    with ranked_brands as (
      select
        lower(trim(brand)) as value,
        trim(brand) as label,
        count(*) as usage_count,
        row_number() over (
          partition by lower(trim(brand))
          order by count(*) desc, trim(brand) asc
        ) as row_number
      from products
      where nullif(trim(brand), '') is not null
      group by lower(trim(brand)), trim(brand)
    )
    select value, label
    from ranked_brands
    where row_number = 1
    order by value asc
  `,
  );
  return rows
    .map((row) => ({
      value: row.value,
      label: row.label,
    }))
    .filter((row) => row.value && row.label);
}

export async function getDistinctProductCategories(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<StringValueRow>`
    select distinct lower(trim(category)) as value
    from products
    where nullif(trim(category), '') is not null
    order by value asc
  `,
  );
  return rows.map((row) => row.value).filter(Boolean);
}

export async function getDistinctProductSilhouettes(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<StringValueRow>`
    select distinct lower(trim(silhouette)) as value
    from products
    where nullif(trim(silhouette), '') is not null
    order by value asc
  `,
  );
  return rows.map((row) => row.value).filter(Boolean);
}

export async function getDistinctProductFits(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<StringValueRow>`
    select distinct lower(trim(fit)) as value
    from products
    where nullif(trim(fit), '') is not null
    order by value asc
  `,
  );
  return rows.map((row) => row.value).filter(Boolean);
}

export async function getDistinctProductClosureTypes(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<StringValueRow>`
    select distinct lower(trim(value)) as value
    from products
    cross join unnest(coalesce(closure_type, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value asc
  `,
  );
  return rows.map((row) => row.value).filter(Boolean);
}

export async function getDistinctProductColors(): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<StringValueRow>`
    select distinct lower(trim(value)) as value
    from products
    cross join unnest(coalesce(color_base, array[]::text[])) as value
    where nullif(trim(value), '') is not null
    order by value asc
  `,
  );
  return rows.map((row) => row.value).filter(Boolean);
}

export async function getProductPriceRange(): Promise<{
  min: number | null;
  max: number | null;
}> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<NumericRangeRow>`
    select
      min(price) as min,
      max(price) as max
    from products
    where price is not null
  `,
  );
  return {
    min: toOptionalNumber(row?.min),
    max: toOptionalNumber(row?.max),
  };
}

export async function getProductsByUrlsInOrder(
  urls: unknown[] = [],
): Promise<ProductRow[]> {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  const sql = getSqlClient();
  const normalizedUrls = urls
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (normalizedUrls.length === 0) {
    return [];
  }

  return getResultRows(
    await sql<ProductRow>`
    select
      products.id,
      products.name,
      products.url,
      products.description,
      products.brand,
      products.price,
      products.currency,
      products.availability,
      products.image_url as "imageUrl",
      products.audience,
      products.category,
      products.season,
      products.formality_level as "formalityLevel",
      products.style,
      products.occasions,
      products.color_base as "colorBase",
      products.pattern,
      products.finish,
      products.is_neutral as "isNeutral",
      products.composition,
      products.silhouette,
      products.fit,
      products.closure_type as "closureType"
    from unnest(${normalizedUrls}::text[]) with ordinality as selected(url, position)
    join products on products.url = selected.url
    order by selected.position asc
  `,
  );
}

export async function getProductsWithEmbeddingsByUrlsInOrder(
  urls: unknown[] = [],
): Promise<ProductWithEmbeddingRow[]> {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  const sql = getSqlClient();
  const normalizedUrls = urls
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (normalizedUrls.length === 0) {
    return [];
  }

  return getResultRows(
    await sql<ProductWithEmbeddingRow>`
    select
      products.*,
      products.image_url as "imageUrl",
      products.formality_level as "formalityLevel",
      products.color_base as "colorBase",
      products.is_neutral as "isNeutral",
      products.closure_type as "closureType"
    from unnest(${normalizedUrls}::text[]) with ordinality as selected(url, position)
    join products on products.url = selected.url
    order by selected.position asc
  `,
  );
}
