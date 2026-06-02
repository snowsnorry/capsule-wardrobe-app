-- Selects catalog replacement candidates when multiple accent colors are allowed.
WITH query_params AS (
  SELECT
    $1::text[] AS categories,
    $2::float AS noise_factor,
    $3::vector AS embedding_vector,
    $4::text AS style,
    $5::text AS pattern,
    $6::text AS formality_level,
    $7::text[] AS occasions,
    $8::text[] AS season,
    $9::text[] AS audience_filters,
    $10::text[] AS excluded_urls
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
      ) AS color_rank
    FROM (
      SELECT
        raw_scored.*,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(is_neutral, false)
          ORDER BY relevance_score DESC, distance ASC
        ) AS neutrality_rank,
        ROW_NUMBER() OVER (
          PARTITION BY style_role
          ORDER BY relevance_score DESC, distance ASC
        ) AS style_rank,
        ROW_NUMBER() OVER (
          PARTITION BY is_pattern_limited_item
          ORDER BY relevance_score DESC, distance ASC
        ) AS pattern_rank
      FROM (
        SELECT
          products.id::text AS id,
          'catalog'::text AS item_source,
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
          products.embedding <=> params.embedding_vector AS distance,
          CASE WHEN params.style IS NOT NULL AND lower(params.style) != 'minimalistic' AND params.style = ANY(COALESCE(products.style, ARRAY[]::text[])) THEN 'accent'
            WHEN 'minimalistic' = ANY(COALESCE(products.style, ARRAY[]::text[])) THEN 'base'
            ELSE 'other' END AS style_role,
          (COALESCE(products.is_neutral, false) IS NOT TRUE AND cardinality(COALESCE(products.color_base, ARRAY[]::text[])) > 0) AS is_non_neutral_color,
          (CASE WHEN lower(params.pattern) = 'solid' THEN FALSE
            WHEN params.pattern IS NOT NULL AND params.pattern != '' THEN lower(COALESCE(products.pattern, '')) = lower(params.pattern)
            ELSE products.pattern IS NOT NULL AND trim(products.pattern) != '' AND lower(products.pattern) != 'solid' END) AS is_pattern_limited_item,
          (
            CASE WHEN params.formality_level IS NOT NULL AND params.formality_level = ANY(COALESCE(products.formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
            + CASE WHEN params.style IS NOT NULL AND params.style = ANY(COALESCE(products.style, ARRAY[]::text[])) THEN 20
              WHEN params.style IS NOT NULL AND 'minimalistic' = ANY(COALESCE(products.style, ARRAY[]::text[])) THEN 15
              WHEN params.style IS NULL AND 'minimalistic' = ANY(COALESCE(products.style, ARRAY[]::text[])) THEN 20
              ELSE 0 END
            + CASE WHEN COALESCE(products.occasions, ARRAY[]::text[]) && params.occasions THEN 20 ELSE 0 END
            + CASE WHEN COALESCE(products.season, ARRAY[]::text[]) && params.season THEN 50
              WHEN cardinality(COALESCE(products.season, ARRAY[]::text[])) = 0 THEN 40 ELSE 0 END
            + CASE WHEN COALESCE(products.is_neutral, false) IS NOT TRUE AND cardinality(COALESCE(products.color_base, ARRAY[]::text[])) > 0 THEN 20 ELSE 0 END
            + CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(products.pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
          ) AS relevance_score
        FROM products
        WHERE products.category = cats.target_category
          AND lower(COALESCE(products.audience, '')) = ANY(params.audience_filters)
          AND (COALESCE(products.is_neutral, false) OR cardinality(COALESCE(products.color_base, ARRAY[]::text[])) > 0)
          AND (CASE WHEN lower(params.pattern) = 'solid' THEN products.pattern IS NULL OR trim(products.pattern) = '' OR lower(products.pattern) = 'solid'
            ELSE lower(COALESCE(products.pattern, '')) = lower(params.pattern) OR products.pattern IS NULL OR trim(products.pattern) = '' OR lower(products.pattern) = 'solid' END)
          AND NOT (products.url = ANY(params.excluded_urls))
      ) raw_scored
    ) filtered_items
    WHERE (CASE WHEN params.style IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
        ELSE (style_role != 'base' OR style_rank <= 6) END)
      AND (COALESCE(is_neutral, false) IS TRUE OR (is_non_neutral_color IS TRUE AND neutrality_rank <= 4))
      AND (is_pattern_limited_item IS NOT TRUE OR lower(params.pattern) = 'solid' OR pattern_rank <= 3)
  ) results
  ORDER BY relevance_score DESC, color_rank ASC, (distance + (RANDOM() * params.noise_factor)) ASC
  LIMIT 10
) results
