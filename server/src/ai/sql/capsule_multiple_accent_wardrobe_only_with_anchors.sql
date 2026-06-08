-- Selects mandatory wardrobe anchors plus optional ready My Wardrobe candidates for multiple accent colors.
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
    $12::text AS profile_email,
    $13::bigint[] AS anchor_wardrobe_ids,
    $14::text[] AS anchor_catalog_urls,
    $15::float AS anchor_similarity_bonus_weight
),
anchor_items AS (
  SELECT
    ('W' || wardrobe.id::text) AS id,
    'wardrobe'::text AS item_source,
    'anchor'::text AS selection_role,
    wardrobe.source,
    wardrobe.raw_image_url,
    wardrobe.processing_status,
    wardrobe.id::text AS wardrobe_id,
    wardrobe.product_id,
    wardrobe.name,
    wardrobe.url,
    wardrobe.description,
    wardrobe.brand,
    wardrobe.price,
    wardrobe.currency,
    wardrobe.availability,
    wardrobe.image_url,
    wardrobe.audience,
    wardrobe.category,
    wardrobe.season,
    wardrobe.formality_level,
    wardrobe.style,
    wardrobe.occasions,
    wardrobe.color_base,
    wardrobe.pattern,
    wardrobe.finish,
    wardrobe.is_neutral,
    wardrobe.composition,
    wardrobe.silhouette,
    wardrobe.fit,
    wardrobe.closure_type,
    wardrobe.embedding,
    NULL::float AS distance,
    100000::float AS relevance_score
  FROM query_params AS params
  JOIN wardrobe
    ON wardrobe.profile_email = params.profile_email
   AND wardrobe.id = ANY(params.anchor_wardrobe_ids)
   AND wardrobe.processing_status = 'ready'
   AND NULLIF(trim(COALESCE(wardrobe.url, '')), '') IS NOT NULL
   AND NULLIF(trim(COALESCE(wardrobe.category, '')), '') IS NOT NULL

  UNION ALL

  SELECT
    products.id::text AS id,
    'catalog'::text AS item_source,
    'anchor'::text AS selection_role,
    NULL::text AS source,
    NULL::text AS raw_image_url,
    NULL::text AS processing_status,
    NULL::text AS wardrobe_id,
    products.id::text AS product_id,
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
    NULL::float AS distance,
    100000::float AS relevance_score
  FROM query_params AS params
  JOIN products
    ON products.url = ANY(params.anchor_catalog_urls)
   AND NULLIF(trim(COALESCE(products.category, '')), '') IS NOT NULL
),
anchor_dedupe_keys AS (
  SELECT COALESCE(array_agg(COALESCE(product_id, 'wardrobe:' || wardrobe_id)), ARRAY[]::text[]) AS keys
  FROM anchor_items
),
wardrobe_candidates AS (
  SELECT results.*
  FROM query_params AS params
  CROSS JOIN anchor_dedupe_keys AS anchor_keys
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
          AND wardrobe.id <> ALL(params.anchor_wardrobe_ids)
      ) ranked_wardrobe
      WHERE wardrobe_duplicate_rank = 1
    ),
    raw_scored AS (
      SELECT
        ('W' || wardrobe_deduped.id::text) AS id,
        'wardrobe'::text AS item_source,
        'candidate'::text AS selection_role,
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
        wardrobe_deduped.embedding <=> params.embedding_vector AS distance,
        CASE WHEN params.style IS NOT NULL AND lower(params.style) != 'minimalistic' AND params.style = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[])) THEN 'accent'
          WHEN 'minimalistic' = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[])) THEN 'base'
          ELSE 'other' END AS style_role,
        (COALESCE(wardrobe_deduped.is_neutral, false) IS NOT TRUE AND cardinality(COALESCE(wardrobe_deduped.color_base, ARRAY[]::text[])) > 0) AS is_non_neutral_color,
        (CASE WHEN lower(params.pattern) = 'solid' THEN FALSE
          WHEN params.pattern IS NOT NULL AND params.pattern != '' THEN lower(COALESCE(wardrobe_deduped.pattern, '')) = lower(params.pattern)
          ELSE wardrobe_deduped.pattern IS NOT NULL AND trim(wardrobe_deduped.pattern) != '' AND lower(wardrobe_deduped.pattern) != 'solid' END) AS is_pattern_limited_item,
        (
          CASE WHEN params.formality_level IS NOT NULL AND params.formality_level = ANY(COALESCE(wardrobe_deduped.formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
          + CASE WHEN params.style IS NOT NULL AND params.style = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[])) THEN 20
                 WHEN 'minimalistic' = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[])) THEN 15 ELSE 0 END
          + CASE WHEN COALESCE(wardrobe_deduped.occasions, ARRAY[]::text[]) && params.occasions THEN 20 ELSE 0 END
          + CASE WHEN COALESCE(wardrobe_deduped.season, ARRAY[]::text[]) && params.season THEN 50
                 WHEN cardinality(COALESCE(wardrobe_deduped.season, ARRAY[]::text[])) = 0 THEN 40 ELSE 0 END
          + CASE WHEN cardinality(COALESCE(wardrobe_deduped.color_base, ARRAY[]::text[])) > 0 AND NOT COALESCE(wardrobe_deduped.is_neutral, false) THEN 12 ELSE 0 END
          + CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(wardrobe_deduped.pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
          + CASE WHEN EXISTS (
              SELECT 1 FROM anchor_items AS anchor
              WHERE lower(COALESCE(anchor.category, '')) = lower(COALESCE(wardrobe_deduped.category, ''))
            )
            THEN params.anchor_similarity_bonus_weight * 0.25 * COALESCE((
              SELECT MAX(1 - (wardrobe_deduped.embedding <=> anchor.embedding))
              FROM anchor_items AS anchor
              WHERE wardrobe_deduped.embedding IS NOT NULL AND anchor.embedding IS NOT NULL
            ), 0)
            ELSE params.anchor_similarity_bonus_weight * COALESCE((
              SELECT MAX(1 - (wardrobe_deduped.embedding <=> anchor.embedding))
              FROM anchor_items AS anchor
              WHERE wardrobe_deduped.embedding IS NOT NULL AND anchor.embedding IS NOT NULL
            ), 0)
          END
        ) AS relevance_score
      FROM wardrobe_deduped
      WHERE wardrobe_deduped.category = cats.target_category
        AND NOT (COALESCE(wardrobe_deduped.product_id, 'wardrobe:' || wardrobe_deduped.id::text) = ANY(anchor_keys.keys))
        AND lower(COALESCE(wardrobe_deduped.audience, '')) = ANY(params.audience_filters)
        AND (
          COALESCE(wardrobe_deduped.is_neutral, false)
          OR cardinality(COALESCE(wardrobe_deduped.color_base, ARRAY[]::text[])) > 0
        )
        AND (
          CASE WHEN lower(params.pattern) = 'solid' THEN
            wardrobe_deduped.pattern IS NULL OR trim(wardrobe_deduped.pattern) = '' OR lower(wardrobe_deduped.pattern) = 'solid'
          ELSE lower(COALESCE(wardrobe_deduped.pattern, '')) = lower(params.pattern)
            OR wardrobe_deduped.pattern IS NULL OR trim(wardrobe_deduped.pattern) = '' OR lower(wardrobe_deduped.pattern) = 'solid' END
        )
        AND NOT (wardrobe_deduped.url = ANY(params.rejected_urls))
    ),
    ranked AS (
      SELECT
        raw_scored.*,
        ROW_NUMBER() OVER (PARTITION BY COALESCE(is_neutral, false) ORDER BY relevance_score DESC, distance ASC) AS neutrality_rank,
        ROW_NUMBER() OVER (PARTITION BY style_role ORDER BY relevance_score DESC, distance ASC) AS style_rank,
        ROW_NUMBER() OVER (PARTITION BY is_pattern_limited_item ORDER BY relevance_score DESC, distance ASC) AS pattern_rank
      FROM raw_scored
    ),
    filtered_items AS (
      SELECT *
      FROM ranked
      WHERE
        (CASE WHEN params.style IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
          ELSE (style_role != 'base' OR style_rank <= 6) END)
        AND (COALESCE(is_neutral, false) IS TRUE OR (is_non_neutral_color IS TRUE AND neutrality_rank <= 4))
        AND (is_pattern_limited_item IS NOT TRUE OR lower(params.pattern) = 'solid' OR pattern_rank <= 3)
    ),
    color_ranked AS (
      SELECT
        filtered_items.*,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(color_base, ARRAY[]::text[])
          ORDER BY relevance_score DESC, (distance + (RANDOM() * params.noise_factor)) ASC
        ) AS color_rank
      FROM filtered_items
    )
    SELECT id, item_source, selection_role, source, raw_image_url, processing_status, wardrobe_id, product_id, name, url, description, brand, price, currency, availability, image_url, audience, category, season, formality_level, style, occasions, color_base, pattern, finish, is_neutral, composition, silhouette, fit, closure_type, embedding, distance, relevance_score
    FROM color_ranked
    ORDER BY relevance_score DESC, color_rank ASC, (distance + (RANDOM() * params.noise_factor)) ASC
    LIMIT (SELECT final_candidate_limit FROM query_params)
  ) results
)
SELECT * FROM anchor_items
UNION ALL
SELECT * FROM wardrobe_candidates
