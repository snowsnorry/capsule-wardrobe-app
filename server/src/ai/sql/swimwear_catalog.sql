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
  products.embedding,
  CASE
    WHEN products.name ILIKE '%swimsuit%' THEN 'swimsuit'
    WHEN products.name ILIKE '%tankini%' OR products.name ILIKE '%bikini top%' THEN 'swimwear_top'
    WHEN products.name ~* '(bikini bottoms|bikini bottom|bikini briefs|hipsters|tanga|thong)' THEN 'swimwear_bottom'
    ELSE 'swimsuit'
  END AS swimwear_type,
  (products.embedding <=> $1::vector) AS distance
FROM products
WHERE
  products.category = 'swimwear'
  AND lower(COALESCE(products.audience, '')) = lower($2::text)
ORDER BY
  (
    CASE WHEN products.color_base && $3::text[] THEN 2 ELSE 0 END
    +
    CASE
      WHEN $4::text IS NOT NULL
        AND $4::text = ANY(COALESCE(products.style, ARRAY[]::text[]))
      THEN 1 ELSE 0
    END
  ) DESC,
  (products.embedding <=> $1::vector) ASC
LIMIT $5
