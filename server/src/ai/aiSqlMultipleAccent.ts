import type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
  CapsuleWardrobeSqlRow,
} from "./aiSqlTypes.js";

async function queryCapsuleWardrobeItemsForMultipleAccentColors(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  return sql<CapsuleWardrobeSqlRow>`
    SELECT results.*
    FROM unnest(${params.categories}::text[]) AS cats(target_category)
    CROSS JOIN LATERAL (
      SELECT * FROM (
        SELECT 
          filtered_items.*,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(color_base, ARRAY[]::text[])
            ORDER BY relevance_score DESC, (distance + (RANDOM() * ${params.noiseFactor}::float)) ASC
          ) as color_rank
        FROM (
          SELECT 
            raw_scored.*,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(is_neutral, false)
              ORDER BY relevance_score DESC, distance ASC
            ) as neutrality_rank,
            ROW_NUMBER() OVER (
              PARTITION BY style_role
              ORDER BY relevance_score DESC, distance ASC
            ) as style_rank,
            ROW_NUMBER() OVER (
              PARTITION BY is_pattern_limited_item
              ORDER BY relevance_score DESC, distance ASC
            ) as pattern_rank
          FROM (
            SELECT
              products.*,
              embedding <=> ${params.embeddingVector}::vector as distance,
              CASE WHEN ${params.style}::text IS NOT NULL AND lower(${params.style}::text) != 'minimalistic' AND ${params.style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'accent'
                WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'base'
                ELSE 'other' END as style_role,
              (COALESCE(is_neutral, false) IS NOT TRUE AND cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0) as is_non_neutral_color,
              (CASE WHEN lower(${params.pattern}::text) = 'solid' THEN FALSE
                WHEN ${params.pattern}::text IS NOT NULL AND ${params.pattern}::text != '' THEN lower(COALESCE(pattern, '')) = lower(${params.pattern}::text)
                ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
              (
                CASE WHEN ${params.formalityLevel}::text IS NOT NULL AND ${params.formalityLevel}::text = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
                +
                CASE WHEN ${params.style}::text IS NOT NULL AND ${params.style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
                  WHEN ${params.style}::text IS NOT NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 15
                  WHEN ${params.style}::text IS NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
                  ELSE 0 END
                +
                CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && ${params.occasions}::text[] THEN 20 ELSE 0 END
                +
                CASE WHEN COALESCE(season, ARRAY[]::text[]) && ${params.season}::text[] THEN 50
                  WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
                  ELSE 0 END
                +
                CASE WHEN COALESCE(is_neutral, false) IS NOT TRUE AND cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0 THEN 20 ELSE 0 END
                +
                CASE WHEN ${params.pattern}::text IS NOT NULL AND ${params.pattern}::text != '' AND lower(COALESCE(pattern, '')) = lower(${params.pattern}::text) THEN 20 ELSE 0 END
              ) as relevance_score

            FROM products
            WHERE 
              category = cats.target_category
              AND lower(COALESCE(audience, '')) = ANY(${params.audienceFilters}::text[])
              AND (COALESCE(is_neutral, false) OR cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0)
              AND (CASE WHEN lower(${params.pattern}::text) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
                ELSE lower(COALESCE(pattern, '')) = lower(${params.pattern}::text) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
              AND NOT (products.url = ANY(${params.rejectedUrls}::text[]))
          ) raw_scored
        ) filtered_items
        WHERE
          (CASE WHEN ${params.style}::text IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
            ELSE (style_role != 'base' OR style_rank <= 6) END)
          AND 
          (COALESCE(is_neutral, false) IS TRUE OR (is_non_neutral_color IS TRUE AND neutrality_rank <= 4))
          AND 
          (is_pattern_limited_item IS NOT TRUE OR lower(${params.pattern}::text) = 'solid' OR pattern_rank <= 3)
      ) results
      ORDER BY 
        relevance_score DESC, 
        color_rank ASC,        
        (distance + (RANDOM() * ${params.noiseFactor}::float)) ASC
      LIMIT 10
    ) results`;
}

export { queryCapsuleWardrobeItemsForMultipleAccentColors };
