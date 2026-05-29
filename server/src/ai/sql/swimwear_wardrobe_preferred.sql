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
    WHERE wardrobe.profile_email = $1
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
  WHERE products.category = 'swimwear'
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
  WHERE wardrobe_deduped.category = 'swimwear'
)
SELECT
  candidate_items.*,
  CASE
    WHEN candidate_items.name ILIKE '%swimsuit%' THEN 'swimsuit'
    WHEN candidate_items.name ILIKE '%tankini%' OR candidate_items.name ILIKE '%bikini top%' THEN 'swimwear_top'
    WHEN candidate_items.name ~* '(bikini bottoms|bikini bottom|bikini briefs|hipsters|tanga|thong)' THEN 'swimwear_bottom'
    ELSE 'swimsuit'
  END AS swimwear_type,
  (candidate_items.embedding <=> $2::vector) AS distance
FROM candidate_items
WHERE
  lower(COALESCE(candidate_items.audience, '')) = lower($3::text)
ORDER BY
  (
    CASE WHEN candidate_items.color_base && $4::text[] THEN 2 ELSE 0 END
    +
    CASE
      WHEN $5::text IS NOT NULL
        AND $5::text = ANY(COALESCE(candidate_items.style, ARRAY[]::text[]))
      THEN 1 ELSE 0
    END
    +
    CASE WHEN candidate_items.item_source = 'wardrobe' THEN $6 ELSE 0 END
  ) DESC,
  (candidate_items.embedding <=> $2::vector) ASC
LIMIT $7
