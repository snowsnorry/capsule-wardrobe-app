-- Selects replacement candidates from both the catalog and the user's ready wardrobe.
-- Wardrobe items receive a relevance boost and source pools are balanced before final ranking.
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
    $11::text[] AS excluded_urls,
    $12::text AS profile_email,
    $13::int AS wardrobe_boost,
    $14::int AS catalog_pool_limit,
    $15::int AS wardrobe_pool_limit
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
  ),
  wardrobe_catalog_product_ids AS (
    SELECT DISTINCT product_id
    FROM wardrobe_deduped
    WHERE product_id IS NOT NULL
  ),
  candidate_items AS (
    SELECT
      products.id::text AS id,
      'catalog'::text AS item_source,
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
      products.embedding
    FROM products
    WHERE products.category = cats.target_category
      AND NOT EXISTS (
        SELECT 1
        FROM wardrobe_catalog_product_ids owned
        WHERE owned.product_id = products.id::text
      )

    UNION ALL

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
      wardrobe_deduped.embedding
    FROM wardrobe_deduped
    WHERE wardrobe_deduped.category = cats.target_category
  ),
  raw_scored AS (
    SELECT
      candidate_items.*,
      embedding <=> params.embedding_vector AS distance,
      (params.style IS NOT NULL AND params.style = ANY(COALESCE(style, ARRAY[]::text[]))) AS is_style_match,
      (params.color IS NOT NULL AND params.color != '' AND params.color = ANY(COALESCE(color_base, ARRAY[]::text[]))) AS is_color_match,
      (CASE WHEN lower(params.pattern) = 'solid' THEN FALSE
        WHEN params.pattern IS NOT NULL AND params.pattern != '' THEN lower(COALESCE(pattern, '')) = lower(params.pattern)
        ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) AS is_pattern_limited_item,
      (
        CASE WHEN params.formality_level IS NOT NULL AND params.formality_level = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
        + CASE WHEN params.style IS NOT NULL AND params.style = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20 ELSE 0 END
        + CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && params.occasions THEN 20 ELSE 0 END
        + CASE WHEN COALESCE(season, ARRAY[]::text[]) && params.season THEN 50
          WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40 ELSE 0 END
        + CASE WHEN params.color IS NOT NULL AND params.color != '' AND params.color = ANY(COALESCE(color_base, ARRAY[]::text[])) THEN 20 ELSE 0 END
        + CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
        + CASE WHEN item_source = 'wardrobe' THEN params.wardrobe_boost ELSE 0 END
      ) AS relevance_score
    FROM candidate_items
    WHERE lower(COALESCE(audience, '')) = ANY(params.audience_filters)
      AND (CASE WHEN params.color IS NOT NULL AND params.color != '' THEN params.color = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
        ELSE COALESCE(is_neutral, false) END)
      AND (CASE WHEN lower(params.pattern) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
        ELSE lower(COALESCE(pattern, '')) = lower(params.pattern) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
      AND NOT (url = ANY(params.excluded_urls))
  ),
  ranked AS (
    SELECT
      raw_scored.*,
      ROW_NUMBER() OVER (
        PARTITION BY is_style_match
        ORDER BY relevance_score DESC, distance ASC
      ) AS aesthetic_rank,
      ROW_NUMBER() OVER (
        PARTITION BY is_color_match
        ORDER BY relevance_score DESC, distance ASC
      ) AS accent_rank,
      ROW_NUMBER() OVER (
        PARTITION BY is_pattern_limited_item
        ORDER BY relevance_score DESC, distance ASC
      ) AS pattern_rank
    FROM raw_scored
  ),
  filtered_items AS (
    SELECT *
    FROM ranked
    WHERE (is_style_match IS NOT TRUE OR aesthetic_rank <= 3)
      AND (is_color_match IS NOT TRUE OR accent_rank <= 3)
      AND (is_pattern_limited_item IS NOT TRUE OR lower(params.pattern) = 'solid' OR pattern_rank <= 3)
  ),
  source_ranked AS (
    SELECT
      filtered_items.*,
      ROW_NUMBER() OVER (
        PARTITION BY item_source
        ORDER BY relevance_score DESC, distance ASC
      ) AS source_rank
    FROM filtered_items
  ),
  source_limited AS (
    SELECT *
    FROM source_ranked
    WHERE (item_source = 'catalog' AND source_rank <= params.catalog_pool_limit)
      OR (item_source = 'wardrobe' AND source_rank <= params.wardrobe_pool_limit)
  ),
  color_ranked AS (
    SELECT
      source_limited.*,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(color_base, ARRAY[]::text[])
        ORDER BY relevance_score DESC, (distance + (RANDOM() * params.noise_factor)) ASC
      ) AS color_rank
    FROM source_limited
  )
  SELECT *
  FROM color_ranked
  ORDER BY
    relevance_score DESC,
    CASE WHEN item_source = 'wardrobe' THEN 0 ELSE 1 END,
    color_rank ASC,
    (distance + (RANDOM() * params.noise_factor)) ASC
  LIMIT 10
) results
