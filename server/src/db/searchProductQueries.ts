import {
  SEARCH_PAGE_SIZE,
  getFirstRow,
  getResultRows,
  getSqlClient,
  type CountRow,
  type ProductSearchRow,
} from "./core.js";

type SearchQueryParams = {
  audience: string[];
  brand: string[];
  category: string[];
  closureType: string[];
  color: string[];
  embeddingVector: string | null;
  fit: string[];
  formalityLevel: string[];
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
};

type SearchItemsQueryParams = SearchQueryParams & {
  offset: number;
};

async function querySearchProductCount(
  sql: ReturnType<typeof getSqlClient>,
  {
    audience,
    brand,
    category,
    closureType,
    color,
    embeddingVector,
    fit,
    formalityLevel,
    normalizedUrlPrefix,
    occasions,
    pattern,
    priceMax,
    priceMin,
    season,
    semanticDistanceThreshold,
    silhouette,
    style,
  }: SearchQueryParams,
): Promise<CountRow | null> {
  return getFirstRow(
    await sql<CountRow>`
    select count(*)::integer as total
    from products
    where
      (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
      and (${normalizedUrlPrefix}::text is null or products.url like ${normalizedUrlPrefix})
      and (${priceMin}::double precision is null or price >= ${priceMin})
      and (${priceMax}::double precision is null or price <= ${priceMax})
      and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
      and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
      and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
      and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
      and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
      and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
      and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
      and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
      and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
      and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
      and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
      and (${embeddingVector}::text is null or ${semanticDistanceThreshold}::double precision is null or embedding <=> ${embeddingVector}::vector <= ${semanticDistanceThreshold})
  `,
  );
}

async function querySearchProductItems(
  sql: ReturnType<typeof getSqlClient>,
  {
    audience,
    brand,
    category,
    closureType,
    color,
    embeddingVector,
    fit,
    formalityLevel,
    normalizedUrlPrefix,
    occasions,
    offset,
    pattern,
    profileEmail,
    priceMax,
    priceMin,
    season,
    semanticDistanceThreshold,
    silhouette,
    style,
  }: SearchItemsQueryParams,
): Promise<ProductSearchRow[]> {
  return getResultRows(
    await sql<ProductSearchRow>`
    select id, name, url, description, brand, price, currency, availability, image_url as "imageUrl",
      audience, category, season, formality_level as "formalityLevel", style, occasions,
      color_base as "colorBase", pattern, finish, is_neutral as "isNeutral", composition,
      silhouette, fit, closure_type as "closureType",
      exists (
        select 1
        from wardrobe
        where wardrobe.profile_email = ${profileEmail}
          and wardrobe.source = 'from_catalog'
          and wardrobe.url = products.url
      ) as "isSavedToWardrobe",
      case when ${embeddingVector}::text is null then null else embedding <=> ${embeddingVector}::vector end as distance
    from products
    where
      (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
      and (${normalizedUrlPrefix}::text is null or products.url like ${normalizedUrlPrefix})
      and (${priceMin}::double precision is null or price >= ${priceMin})
      and (${priceMax}::double precision is null or price <= ${priceMax})
      and (cardinality(${audience}::text[]) = 0 or lower(coalesce(audience, '')) = any(${audience}::text[]))
      and (cardinality(${category}::text[]) = 0 or lower(coalesce(category, '')) = any(${category}::text[]))
      and (cardinality(${season}::text[]) = 0 or coalesce(season, array[]::text[]) && ${season}::text[])
      and (cardinality(${formalityLevel}::text[]) = 0 or coalesce(formality_level, array[]::text[]) && ${formalityLevel}::text[])
      and (cardinality(${style}::text[]) = 0 or coalesce(style, array[]::text[]) && ${style}::text[])
      and (cardinality(${occasions}::text[]) = 0 or coalesce(occasions, array[]::text[]) && ${occasions}::text[])
      and (cardinality(${color}::text[]) = 0 or coalesce(color_base, array[]::text[]) && ${color}::text[])
      and (cardinality(${pattern}::text[]) = 0 or lower(coalesce(pattern, '')) = any(${pattern}::text[]))
      and (cardinality(${silhouette}::text[]) = 0 or lower(coalesce(silhouette, '')) = any(${silhouette}::text[]))
      and (cardinality(${fit}::text[]) = 0 or lower(coalesce(fit, '')) = any(${fit}::text[]))
      and (cardinality(${closureType}::text[]) = 0 or coalesce(closure_type, array[]::text[]) && ${closureType}::text[])
      and (${embeddingVector}::text is null or ${semanticDistanceThreshold}::double precision is null or embedding <=> ${embeddingVector}::vector <= ${semanticDistanceThreshold})
    order by
      case when ${embeddingVector}::text is null then 1 else 0 end asc,
      case when ${embeddingVector}::text is null then null else embedding <=> ${embeddingVector}::vector end asc nulls last,
      lower(coalesce(brand, '')) asc,
      lower(coalesce(name, '')) asc
    limit ${SEARCH_PAGE_SIZE}
    offset ${offset}
  `,
  );
}

export { querySearchProductCount, querySearchProductItems };
