SELECT results.*
FROM unnest($1::text[]) AS cats(target_category)
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
      WHERE wardrobe.profile_email = $12::text
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
      embedding <=> $3::vector as distance,
      CASE WHEN $4::text IS NOT NULL AND lower($4::text) != 'minimalistic' AND $4::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'accent'
        WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'base'
        ELSE 'other' END as style_role,
      (COALESCE(is_neutral, false) IS NOT TRUE AND cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0) as is_non_neutral_color,
      (CASE WHEN lower($5::text) = 'solid' THEN FALSE
        WHEN $5::text IS NOT NULL AND $5::text != '' THEN lower(COALESCE(pattern, '')) = lower($5::text)
        ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
      (
        CASE WHEN $6::text IS NOT NULL AND $6::text = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
        +
        CASE WHEN $4::text IS NOT NULL AND $4::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
          WHEN $4::text IS NOT NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 15
          WHEN $4::text IS NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
          ELSE 0 END
        +
        CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && $7::text[] THEN 20 ELSE 0 END
        +
        CASE WHEN COALESCE(season, ARRAY[]::text[]) && $8::text[] THEN 50
          WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
          ELSE 0 END
        +
        CASE WHEN COALESCE(is_neutral, false) IS NOT TRUE AND cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0 THEN 20 ELSE 0 END
        +
        CASE WHEN $5::text IS NOT NULL AND $5::text != '' AND lower(COALESCE(pattern, '')) = lower($5::text) THEN 20 ELSE 0 END
        +
        CASE WHEN item_source = 'wardrobe' THEN $13::int ELSE 0 END
      ) as relevance_score
    FROM candidate_items
    WHERE
      lower(COALESCE(audience, '')) = ANY($9::text[])
      AND (COALESCE(is_neutral, false) OR cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0)
      AND (CASE WHEN lower($5::text) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
        ELSE lower(COALESCE(pattern, '')) = lower($5::text) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
      AND NOT (url = ANY($10::text[]))
  ),
  ranked AS (
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
    FROM raw_scored
  ),
  filtered_items AS (
    SELECT *
    FROM ranked
    WHERE
      (CASE WHEN $4::text IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
        ELSE (style_role != 'base' OR style_rank <= 6) END)
      AND (COALESCE(is_neutral, false) IS TRUE OR (is_non_neutral_color IS TRUE AND neutrality_rank <= 4))
      AND (is_pattern_limited_item IS NOT TRUE OR lower($5::text) = 'solid' OR pattern_rank <= 3)
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
    WHERE
      (item_source = 'catalog' AND source_rank <= $14::int)
      OR
      (item_source = 'wardrobe' AND source_rank <= $15::int)
  ),
  color_ranked AS (
    SELECT
      source_limited.*,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(color_base, ARRAY[]::text[])
        ORDER BY relevance_score DESC, (distance + (RANDOM() * $2::float)) ASC
      ) as color_rank
    FROM source_limited
  )
  SELECT *
  FROM color_ranked
  ORDER BY
    relevance_score DESC,
    CASE WHEN item_source = 'wardrobe' THEN 0 ELSE 1 END,
    color_rank ASC,
    (distance + (RANDOM() * $2::float)) ASC
  LIMIT $11::int
) results
