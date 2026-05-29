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
)
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
  CASE
    WHEN wardrobe_deduped.name ILIKE '%swimsuit%' THEN 'swimsuit'
    WHEN wardrobe_deduped.name ILIKE '%tankini%' OR wardrobe_deduped.name ILIKE '%bikini top%' THEN 'swimwear_top'
    WHEN wardrobe_deduped.name ~* '(bikini bottoms|bikini bottom|bikini briefs|hipsters|tanga|thong)' THEN 'swimwear_bottom'
    ELSE 'swimsuit'
  END AS swimwear_type,
  (wardrobe_deduped.embedding <=> $2::vector) AS distance
FROM wardrobe_deduped
WHERE
  wardrobe_deduped.category = 'swimwear'
  AND lower(COALESCE(wardrobe_deduped.audience, '')) = lower($3::text)
ORDER BY
  (
    CASE WHEN wardrobe_deduped.color_base && $4::text[] THEN 2 ELSE 0 END
    +
    CASE
      WHEN $5::text IS NOT NULL
        AND $5::text = ANY(COALESCE(wardrobe_deduped.style, ARRAY[]::text[]))
      THEN 1 ELSE 0
    END
  ) DESC,
  (wardrobe_deduped.embedding <=> $2::vector) ASC
LIMIT $6
