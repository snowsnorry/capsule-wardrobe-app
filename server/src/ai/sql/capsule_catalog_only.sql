WITH query_params AS (
  SELECT
    $1::text[] AS categories,
    $2::float AS noise_factor,
    $3::vector AS embedding_vector,
    $4::text AS style,
    $5::text AS color,
    $6::text AS pattern,
    $7::text AS formality_level,
    $8::text[] AS occasions,
    $9::text[] AS season,
    $10::text[] AS audience_filters,
    $11::text[] AS rejected_urls,
    $12::int AS final_candidate_limit
)
SELECT results.*
FROM query_params AS params
CROSS JOIN unnest(params.categories) AS cats(target_category)
CROSS JOIN LATERAL (
  SELECT * FROM (
    SELECT
      filtered_items.*,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(color_base, ARRAY[]::text[])
        ORDER BY relevance_score DESC, (distance + (RANDOM() * params.noise_factor)) ASC
      ) as color_rank
    FROM (
      SELECT
        raw_scored.*,
        ROW_NUMBER() OVER (
          PARTITION BY style_role
          ORDER BY relevance_score DESC, distance ASC
        ) as style_rank,
        ROW_NUMBER() OVER (
          PARTITION BY is_color_match
          ORDER BY relevance_score DESC, distance ASC
        ) as accent_rank,
        ROW_NUMBER() OVER (
          PARTITION BY is_pattern_limited_item
          ORDER BY relevance_score DESC, distance ASC
        ) as pattern_rank
      FROM (
        SELECT
          products.id::text as id,
          'catalog'::text as item_source,
          products.name,
          products.url,
          products.description,
          products.brand,
          products.price,
          products.currency,
          products.availability,
          products.image_url,
          products.audience,
          products.category,
          products.season,
          products.formality_level,
          products.style,
          products.occasions,
          products.color_base,
          products.pattern,
          products.finish,
          products.is_neutral,
          products.composition,
          products.silhouette,
          products.fit,
          products.closure_type,
          products.embedding,
          embedding <=> params.embedding_vector as distance,
          CASE WHEN params.style IS NOT NULL AND lower(params.style) != 'minimalistic' AND params.style = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'accent'
            WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'base'
            ELSE 'other' END as style_role,
          (params.color IS NOT NULL AND params.color != '' AND params.color = ANY(color_base)) as is_color_match,
          (CASE WHEN lower(params.pattern) = 'solid' THEN FALSE
            WHEN params.pattern IS NOT NULL AND params.pattern != '' THEN lower(COALESCE(pattern, '')) = lower(params.pattern)
            ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
          (
            CASE WHEN params.formality_level IS NOT NULL AND params.formality_level = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
            +
            CASE
              WHEN params.style IS NOT NULL AND params.style = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
              WHEN params.style IS NOT NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 15
              WHEN params.style IS NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
              ELSE 0
            END
            +
            CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && params.occasions THEN 20 ELSE 0 END
            +
            CASE WHEN COALESCE(season, ARRAY[]::text[]) && params.season THEN 50
              WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
              ELSE 0 END
            +
            CASE WHEN params.color IS NOT NULL AND params.color != '' AND params.color = ANY(color_base) THEN 20 ELSE 0 END
            +
            CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
          ) as relevance_score
        FROM products
        WHERE
          category = cats.target_category
          AND lower(COALESCE(audience, '')) = ANY(params.audience_filters)
          AND (CASE WHEN params.color IS NOT NULL AND params.color != '' THEN params.color = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
            ELSE COALESCE(is_neutral, false) END)
          AND (CASE WHEN lower(params.pattern) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
            ELSE lower(COALESCE(pattern, '')) = lower(params.pattern) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
          AND NOT (products.url = ANY(params.rejected_urls))
      ) raw_scored
    ) filtered_items
    WHERE
      (CASE WHEN params.style IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
        ELSE (style_role != 'base' OR style_rank <= 6) END)
      AND
      (is_color_match IS NOT TRUE OR accent_rank <= 3)
      AND
      (is_pattern_limited_item IS NOT TRUE OR lower(params.pattern) = 'solid' OR pattern_rank <= 3)
  ) results
  ORDER BY
    relevance_score DESC,
    color_rank ASC,
    (distance + (RANDOM() * params.noise_factor)) ASC
  LIMIT (SELECT final_candidate_limit FROM query_params)
) results
