import {
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

// eslint-disable-next-line max-lines-per-function
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
  }: SearchQueryParams,
): Promise<CountRow | null> {
  return getFirstRow(
    await sql<CountRow>`
    with filtered_products as (
      select
        products.*,
        case when ${embeddingVector}::text is null then null else embedding <=> ${embeddingVector}::vector end as distance,
        (
          case
            when ${textQuery}::text is null then 0
            when lower(coalesce(name, '')) = ${textQuery} then 120
            when lower(coalesce(name, '')) like ${textPrefixPattern} escape '~' then 90
            when lower(coalesce(name, '')) like ${textContainsPattern} escape '~' then 70
            else 0
          end
          +
          greatest(
            case
              when ${textQuery}::text is null then 0
              when lower(coalesce(description, '')) like ${textPrefixPattern} escape '~' then 45
              when lower(coalesce(description, '')) like ${textContainsPattern} escape '~' then 30
              else 0
            end,
            case
              when ${textQuery}::text is null then 0
              when lower(coalesce(composition, '')) like ${textPrefixPattern} escape '~' then 45
              when lower(coalesce(composition, '')) like ${textContainsPattern} escape '~' then 30
              else 0
            end,
            case
              when ${textQuery}::text is null then 0
              when exists (
                select 1
                from unnest(coalesce(color_base, array[]::text[])) as color_value(value)
                where lower(color_value.value) like ${textPrefixPattern} escape '~'
              ) then 45
              when exists (
                select 1
                from unnest(coalesce(color_base, array[]::text[])) as color_value(value)
                where lower(color_value.value) like ${textContainsPattern} escape '~'
              ) then 30
              else 0
            end
          )
        ) as lexical_score
      from products
      where
        (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
        and (${normalizedUrlPrefix}::text is null or products.url like ${normalizedUrlPrefix})
        and (${priceMin}::double precision is null or price >= ${priceMin})
        and (${priceMax}::double precision is null or price <= ${priceMax})
        and (
          ${likedOnly}::boolean is not true
          or (
            ${profileEmail}::text is not null
            and exists (
              select 1
              from user_liked_items
              where user_liked_items.user_email = ${profileEmail}
                and user_liked_items.item_url = products.url
            )
          )
        )
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
    )
    select count(*)::integer as total
    from filtered_products
    where
      ${textSearchMode}::text = 'none'
      or (${textSearchMode}::text = 'lexical' and lexical_score > 0)
      or (
        ${textSearchMode}::text = 'hybrid'
        and (
          lexical_score > 0
          or (
            ${embeddingVector}::text is not null
            and ${semanticDistanceThreshold}::double precision is not null
            and distance <= ${semanticDistanceThreshold}
          )
        )
      )
      or (
        ${textSearchMode}::text = 'semantic'
        and (
          ${embeddingVector}::text is null
          or ${semanticDistanceThreshold}::double precision is null
          or distance <= ${semanticDistanceThreshold}
        )
      )
  `,
  );
}

// eslint-disable-next-line max-lines-per-function
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
    likedOnly,
    limit,
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
    textContainsPattern,
    textPrefixPattern,
    textQuery,
    textSearchMode,
  }: SearchItemsQueryParams,
): Promise<ProductSearchRow[]> {
  return getResultRows(
    await sql<ProductSearchRow>`
    with filtered_products as (
      select
        products.*,
        case when ${embeddingVector}::text is null then null else embedding <=> ${embeddingVector}::vector end as distance,
        (
          case
            when ${textQuery}::text is null then 0
            when lower(coalesce(name, '')) = ${textQuery} then 120
            when lower(coalesce(name, '')) like ${textPrefixPattern} escape '~' then 90
            when lower(coalesce(name, '')) like ${textContainsPattern} escape '~' then 70
            else 0
          end
          +
          greatest(
            case
              when ${textQuery}::text is null then 0
              when lower(coalesce(description, '')) like ${textPrefixPattern} escape '~' then 45
              when lower(coalesce(description, '')) like ${textContainsPattern} escape '~' then 30
              else 0
            end,
            case
              when ${textQuery}::text is null then 0
              when lower(coalesce(composition, '')) like ${textPrefixPattern} escape '~' then 45
              when lower(coalesce(composition, '')) like ${textContainsPattern} escape '~' then 30
              else 0
            end,
            case
              when ${textQuery}::text is null then 0
              when exists (
                select 1
                from unnest(coalesce(color_base, array[]::text[])) as color_value(value)
                where lower(color_value.value) like ${textPrefixPattern} escape '~'
              ) then 45
              when exists (
                select 1
                from unnest(coalesce(color_base, array[]::text[])) as color_value(value)
                where lower(color_value.value) like ${textContainsPattern} escape '~'
              ) then 30
              else 0
            end
          )
        ) as lexical_score
      from products
      where
        (cardinality(${brand}::text[]) = 0 or lower(coalesce(brand, '')) = any(${brand}::text[]))
        and (${normalizedUrlPrefix}::text is null or products.url like ${normalizedUrlPrefix})
        and (${priceMin}::double precision is null or price >= ${priceMin})
        and (${priceMax}::double precision is null or price <= ${priceMax})
        and (
          ${likedOnly}::boolean is not true
          or (
            ${profileEmail}::text is not null
            and exists (
              select 1
              from user_liked_items
              where user_liked_items.user_email = ${profileEmail}
                and user_liked_items.item_url = products.url
            )
          )
        )
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
    ),
    matching_products as (
      select
        filtered_products.*,
        row_number() over (
          order by lexical_score desc, lower(coalesce(brand, '')) asc, lower(coalesce(name, '')) asc
        ) as lexical_rank,
        row_number() over (
          order by distance asc nulls last, lower(coalesce(brand, '')) asc, lower(coalesce(name, '')) asc
        ) as semantic_rank
      from filtered_products
      where
        ${textSearchMode}::text = 'none'
        or (${textSearchMode}::text = 'lexical' and lexical_score > 0)
        or (
          ${textSearchMode}::text = 'hybrid'
          and (
            lexical_score > 0
            or (
              ${embeddingVector}::text is not null
              and ${semanticDistanceThreshold}::double precision is not null
              and distance <= ${semanticDistanceThreshold}
            )
          )
        )
        or (
          ${textSearchMode}::text = 'semantic'
          and (
            ${embeddingVector}::text is null
            or ${semanticDistanceThreshold}::double precision is null
            or distance <= ${semanticDistanceThreshold}
          )
        )
    )
    select id, name, url, description, brand, price, currency, availability, image_url as "imageUrl",
      audience, category, season, formality_level as "formalityLevel", style, occasions,
      color_base as "colorBase", pattern, finish, is_neutral as "isNeutral", composition,
      silhouette, fit, closure_type as "closureType",
      exists (
        select 1
        from wardrobe
        where wardrobe.profile_email = ${profileEmail}
          and wardrobe.source = 'from_catalog'
          and wardrobe.url = matching_products.url
      ) as "isSavedToWardrobe",
      exists (
        select 1
        from user_liked_items
        where user_liked_items.user_email = ${profileEmail}
          and user_liked_items.item_url = matching_products.url
      ) as "isLiked",
      distance
    from matching_products
    order by
      case
        when ${textSearchMode}::text = 'hybrid' then
          (case when lexical_score > 0 then 1.0 / (60 + lexical_rank) else 0 end)
          +
          (
            case
              when ${semanticDistanceThreshold}::double precision is not null
                and distance <= ${semanticDistanceThreshold}
                then 1.0 / (60 + semantic_rank)
              else 0
            end
          )
        else null
      end desc nulls last,
      case when ${textSearchMode}::text = 'lexical' then lexical_score else null end desc nulls last,
      case when ${textSearchMode}::text = 'semantic' then distance else null end asc nulls last,
      case when ${textSearchMode}::text = 'semantic' then lexical_score else null end desc nulls last,
      lower(coalesce(brand, '')) asc,
      lower(coalesce(name, '')) asc
    limit ${limit}
    offset ${offset}
  `,
  );
}

export { querySearchProductCount, querySearchProductItems };
