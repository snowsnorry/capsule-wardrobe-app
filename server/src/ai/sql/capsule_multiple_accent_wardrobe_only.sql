-- Selects ready My Wardrobe items when multiple accent colors are allowed.
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
    $10::text[] AS rejected_urls,
    $11::int AS final_candidate_limit,
    $12::text AS profile_email
)
SELECT results.*
FROM query_params AS params
CROSS JOIN unnest(params.categories) AS cats(target_category)
CROSS JOIN LATERAL (
  WITH wardrobe_deduped AS (
    SELECT *
    FROM (
      SELECT
        wardrobe.*,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(wardrobe.product_id, 'wardrobe:' || wardrobe.id::text)
          ORDER BY wardrobe.updated_at DESC NULLS LAST, wardrobe.id DESC
        ) AS wardrobe_duplicate_rank
      FROM wardrobe
      WHERE wardrobe.profile_email = params.profile_email
        AND wardrobe.processing_status = 'ready'
        AND NULLIF(trim(COALESCE(wardrobe.url, '')), '') IS NOT NULL
    ) ranked_wardrobe
    WHERE wardrobe_duplicate_rank = 1
  )
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
          ('W' || wardrobe_deduped.id::text) AS id,
          'wardrobe'::text AS item_source,
          wardrobe_deduped.source,
          wardrobe_deduped.raw_image_url,
          wardrobe_deduped.processing_status,
          wardrobe_deduped.id::text AS wardrobe_id,
          wardrobe_deduped.product_id,
          wardrobe_deduped.name,
          wardrobe_deduped.url,
          wardrobe_deduped.description,
          wardrobe_deduped.brand,
          wardrobe_deduped.price,
          wardrobe_deduped.currency,
          wardrobe_deduped.availability,
          wardrobe_deduped.image_url,
          wardrobe_deduped.audience,
          wardrobe_deduped.category,
          wardrobe_deduped.season,
          wardrobe_deduped.formality_level,
          wardrobe_deduped.style,
          wardrobe_deduped.occasions,
          wardrobe_deduped.color_base,
          wardrobe_deduped.pattern,
          wardrobe_deduped.finish,
          wardrobe_deduped.is_neutral,
          wardrobe_deduped.composition,
          wardrobe_deduped.silhouette,
          wardrobe_deduped.fit,
          wardrobe_deduped.closure_type,
          wardrobe_deduped.embedding,
          wardrobe_deduped.embedding <=> params.embedding_vector as distance,
          CASE WHEN params.style IS NOT NULL AND lower(params.style) != 'minimalistic' AND params.style = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[])) THEN 'accent'
            WHEN 'minimalistic' = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[])) THEN 'base'
            ELSE 'other' END as style_role,
          (COALESCE(wardrobe_deduped.is_neutral, false) IS NOT TRUE AND cardinality(COALESCE(wardrobe_deduped.color_base, ARRAY[]::text[])) > 0) as is_non_neutral_color,
          (CASE WHEN lower(params.pattern) = 'solid' THEN FALSE
            WHEN params.pattern IS NOT NULL AND params.pattern != '' THEN lower(COALESCE(wardrobe_deduped.pattern, '')) = lower(params.pattern)
            ELSE wardrobe_deduped.pattern IS NOT NULL AND trim(wardrobe_deduped.pattern) != '' AND lower(wardrobe_deduped.pattern) != 'solid' END) as is_pattern_limited_item,
          (
            CASE WHEN params.formality_level IS NOT NULL AND params.formality_level = ANY(COALESCE(wardrobe_deduped.formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
            +
            CASE WHEN params.style IS NOT NULL AND params.style = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[])) THEN 20
              WHEN params.style IS NOT NULL AND 'minimalistic' = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[])) THEN 15
              WHEN params.style IS NULL AND 'minimalistic' = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[])) THEN 20
              ELSE 0 END
            +
            CASE WHEN COALESCE(wardrobe_deduped.occasions, ARRAY[]::text[]) && params.occasions THEN 20 ELSE 0 END
            +
            CASE WHEN COALESCE(wardrobe_deduped.season, ARRAY[]::text[]) && params.season THEN 50
              WHEN cardinality(COALESCE(wardrobe_deduped.season, ARRAY[]::text[])) = 0 THEN 40
              ELSE 0 END
            +
            CASE WHEN COALESCE(wardrobe_deduped.is_neutral, false) IS NOT TRUE AND cardinality(COALESCE(wardrobe_deduped.color_base, ARRAY[]::text[])) > 0 THEN 20 ELSE 0 END
            +
            CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(wardrobe_deduped.pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
          ) as relevance_score
        FROM wardrobe_deduped
        WHERE
          wardrobe_deduped.category = cats.target_category
          AND lower(COALESCE(wardrobe_deduped.audience, '')) = ANY(params.audience_filters)
          AND (COALESCE(wardrobe_deduped.is_neutral, false) OR cardinality(COALESCE(wardrobe_deduped.color_base, ARRAY[]::text[])) > 0)
          AND (CASE WHEN lower(params.pattern) = 'solid' THEN wardrobe_deduped.pattern IS NULL OR trim(wardrobe_deduped.pattern) = '' OR lower(wardrobe_deduped.pattern) = 'solid'
            ELSE lower(COALESCE(wardrobe_deduped.pattern, '')) = lower(params.pattern) OR wardrobe_deduped.pattern IS NULL OR trim(wardrobe_deduped.pattern) = '' OR lower(wardrobe_deduped.pattern) = 'solid' END)
          AND NOT (wardrobe_deduped.url = ANY(params.rejected_urls))
      ) raw_scored
    ) filtered_items
    WHERE
      (CASE WHEN params.style IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
        ELSE (style_role != 'base' OR style_rank <= 6) END)
      AND (COALESCE(is_neutral, false) IS TRUE OR (is_non_neutral_color IS TRUE AND neutrality_rank <= 4))
      AND (is_pattern_limited_item IS NOT TRUE OR lower(params.pattern) = 'solid' OR pattern_rank <= 3)
  ) results
  ORDER BY
    relevance_score DESC,
    color_rank ASC,
    (distance + (RANDOM() * params.noise_factor)) ASC
  LIMIT (SELECT final_candidate_limit FROM query_params)
) results
