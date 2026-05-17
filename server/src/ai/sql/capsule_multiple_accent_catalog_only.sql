SELECT results.*
FROM unnest($1::text[]) AS cats(target_category)
CROSS JOIN LATERAL (
  SELECT * FROM (
    SELECT
      filtered_items.*,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(color_base, ARRAY[]::text[])
        ORDER BY relevance_score DESC, (distance + (RANDOM() * $2::float)) ASC
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
          ) as relevance_score
        FROM products
        WHERE
          category = cats.target_category
          AND lower(COALESCE(audience, '')) = ANY($9::text[])
          AND (COALESCE(is_neutral, false) OR cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0)
          AND (CASE WHEN lower($5::text) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
            ELSE lower(COALESCE(pattern, '')) = lower($5::text) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
          AND NOT (products.url = ANY($10::text[]))
      ) raw_scored
    ) filtered_items
    WHERE
      (CASE WHEN $4::text IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
        ELSE (style_role != 'base' OR style_rank <= 6) END)
      AND
      (COALESCE(is_neutral, false) IS TRUE OR (is_non_neutral_color IS TRUE AND neutrality_rank <= 4))
      AND
      (is_pattern_limited_item IS NOT TRUE OR lower($5::text) = 'solid' OR pattern_rank <= 3)
  ) results
  ORDER BY
    relevance_score DESC,
    color_rank ASC,
    (distance + (RANDOM() * $2::float)) ASC
  LIMIT $11::int
) results
