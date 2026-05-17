SELECT results.*
FROM unnest($1::text[]) AS cats(target_category)
CROSS JOIN LATERAL (
  SELECT * FROM (
    SELECT filtered_items.*,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(color_base, ARRAY[]::text[])
        ORDER BY relevance_score DESC, (distance + (RANDOM() * $2::float)) ASC
      ) as color_rank
    FROM (
      SELECT raw_scored.*,
        ROW_NUMBER() OVER (PARTITION BY is_style_match ORDER BY relevance_score DESC, distance ASC) as aesthetic_rank,
        ROW_NUMBER() OVER (PARTITION BY is_color_match ORDER BY relevance_score DESC, distance ASC) as accent_rank,
        ROW_NUMBER() OVER (PARTITION BY is_pattern_limited_item ORDER BY relevance_score DESC, distance ASC) as pattern_rank
      FROM (
        SELECT products.*, embedding <=> $3::vector as distance,
          ($4::text IS NOT NULL AND $4::text = ANY(COALESCE(style, ARRAY[]::text[]))) as is_style_match,
          ($5::text IS NOT NULL AND $5::text != '' AND $5::text = ANY(color_base)) as is_color_match,
          (CASE WHEN lower($6::text) = 'solid' THEN FALSE
            WHEN $6::text IS NOT NULL AND $6::text != '' THEN lower(COALESCE(pattern, '')) = lower($6::text)
            ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
          (
            CASE WHEN $7::text IS NOT NULL AND $7::text = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
            + CASE WHEN $4::text IS NOT NULL AND $4::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20 ELSE 0 END
            + CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && $8::text[] THEN 20 ELSE 0 END
            + CASE WHEN COALESCE(season, ARRAY[]::text[]) && $9::text[] THEN 50
              WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40 ELSE 0 END
            + CASE WHEN $5::text IS NOT NULL AND $5::text != '' AND $5::text = ANY(color_base) THEN 20 ELSE 0 END
            + CASE WHEN $6::text IS NOT NULL AND $6::text != '' AND lower(COALESCE(pattern, '')) = lower($6::text) THEN 20 ELSE 0 END
          ) as relevance_score
        FROM products
        WHERE category = cats.target_category
          AND lower(COALESCE(audience, '')) = ANY($10::text[])
          AND (CASE WHEN $5::text IS NOT NULL AND $5::text != '' THEN $5::text = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
            ELSE COALESCE(is_neutral, false) END)
          AND (CASE WHEN lower($6::text) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
            ELSE lower(COALESCE(pattern, '')) = lower($6::text) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
          AND NOT (products.url = ANY($11::text[]))
      ) raw_scored
    ) filtered_items
    WHERE (is_style_match IS NOT TRUE OR aesthetic_rank <= 3)
      AND (is_color_match IS NOT TRUE OR accent_rank <= 3)
      AND (is_pattern_limited_item IS NOT TRUE OR lower($6::text) = 'solid' OR pattern_rank <= 3)
  ) results
  ORDER BY relevance_score DESC, color_rank ASC, (distance + (RANDOM() * $2::float)) ASC
  LIMIT 10
) results
