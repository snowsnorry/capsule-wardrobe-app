-- Selects catalog replacement candidates for selected capsule items.
-- The query searches by category, scores candidates against the existing capsule profile,
-- excludes already-used URLs, and returns a compact ranked set for regeneration.
WITH query_params AS (
  SELECT
    -- Target categories for the selected items being regenerated.
    $1::text[] AS categories,
    -- Randomization multiplier used only as a tie-breaker around vector distance.
    $2::float AS noise_factor,
    -- Query embedding produced from the selected-regeneration prompt.
    $3::vector AS embedding_vector,
    -- Preferred style aesthetic used for matching and scoring.
    $4::text AS style,
    -- Preferred color used for matching and scoring.
    $5::text AS color,
    -- Preferred pattern; non-solid pattern matches are boosted and capped.
    $6::text AS pattern,
    -- Preferred formality level used as a scoring boost.
    $7::text AS formality_level,
    -- Target occasions used as a scoring boost.
    $8::text[] AS occasions,
    -- Target seasons used as a strong scoring boost.
    $9::text[] AS season,
    -- Allowed product audiences derived from the profile audience.
    $10::text[] AS audience_filters,
    -- Product URLs already present in the capsule or previously rejected.
    $11::text[] AS excluded_urls
)
SELECT results.*
FROM query_params AS params
CROSS JOIN unnest(params.categories) AS cats(target_category)
CROSS JOIN LATERAL (
  SELECT * FROM (
    SELECT filtered_items.*,
      -- Final color diversity rank; keeps repeated color groups from dominating replacements.
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(color_base, ARRAY[]::text[])
        ORDER BY relevance_score DESC, (distance + (RANDOM() * params.noise_factor)) ASC
      ) as color_rank
    FROM (
      SELECT raw_scored.*,
        -- Style match rank; caps exact style matches so one aesthetic does not dominate.
        ROW_NUMBER() OVER (PARTITION BY is_style_match ORDER BY relevance_score DESC, distance ASC) as aesthetic_rank,
        -- Accent color rank; caps exact color matches for replacement variety.
        ROW_NUMBER() OVER (PARTITION BY is_color_match ORDER BY relevance_score DESC, distance ASC) as accent_rank,
        -- Pattern rank; caps limited non-solid pattern matches for visual variety.
        ROW_NUMBER() OVER (PARTITION BY is_pattern_limited_item ORDER BY relevance_score DESC, distance ASC) as pattern_rank
      FROM (
        SELECT products.*, embedding <=> params.embedding_vector as distance,
          -- Scoring stage: mark exact style matches for boosting and capping.
          (params.style IS NOT NULL AND params.style = ANY(COALESCE(style, ARRAY[]::text[]))) as is_style_match,
          -- Scoring stage: mark exact color matches for boosting and capping.
          (params.color IS NOT NULL AND params.color != '' AND params.color = ANY(color_base)) as is_color_match,
          -- Scoring stage: mark non-solid pattern matches so they can be capped.
          (CASE WHEN lower(params.pattern) = 'solid' THEN FALSE
            WHEN params.pattern IS NOT NULL AND params.pattern != '' THEN lower(COALESCE(pattern, '')) = lower(params.pattern)
            ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
          -- Scoring stage: combine profile/formality/style/occasion/season/color/pattern boosts.
          (
            -- Boost items matching the requested formality level.
            CASE WHEN params.formality_level IS NOT NULL AND params.formality_level = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
            -- Boost exact style matches.
            + CASE WHEN params.style IS NOT NULL AND params.style = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20 ELSE 0 END
            -- Boost items that match any requested occasion.
            + CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && params.occasions THEN 20 ELSE 0 END
            -- Strongly boost seasonal matches, while keeping seasonless products viable.
            + CASE WHEN COALESCE(season, ARRAY[]::text[]) && params.season THEN 50
              WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40 ELSE 0 END
            -- Boost exact color matches.
            + CASE WHEN params.color IS NOT NULL AND params.color != '' AND params.color = ANY(color_base) THEN 20 ELSE 0 END
            -- Boost exact pattern matches.
            + CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
          ) as relevance_score
        FROM products
        -- Hard filter: only search the category currently being replaced.
        WHERE category = cats.target_category
          -- Hard filter: only include profile-compatible product audiences.
          AND lower(COALESCE(audience, '')) = ANY(params.audience_filters)
          -- Hard filter: when a color is requested, allow exact matches or neutrals; otherwise require neutrals.
          AND (CASE WHEN params.color IS NOT NULL AND params.color != '' THEN params.color = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
            ELSE COALESCE(is_neutral, false) END)
          -- Hard filter: keep solid requests solid-like; otherwise allow exact requested pattern plus solid fallback.
          AND (CASE WHEN lower(params.pattern) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
            ELSE lower(COALESCE(pattern, '')) = lower(params.pattern) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
          -- Hard filter: exclude URLs already used in the capsule or rejected.
          AND NOT (products.url = ANY(params.excluded_urls))
      ) raw_scored
    ) filtered_items
    -- Hard filter: cap exact style matches after relevance ranking.
    WHERE (is_style_match IS NOT TRUE OR aesthetic_rank <= 3)
      -- Hard filter: cap exact accent-color matches after relevance ranking.
      AND (is_color_match IS NOT TRUE OR accent_rank <= 3)
      -- Hard filter: cap non-solid pattern matches after relevance ranking.
      AND (is_pattern_limited_item IS NOT TRUE OR lower(params.pattern) = 'solid' OR pattern_rank <= 3)
  ) results
  ORDER BY relevance_score DESC, color_rank ASC, (distance + (RANDOM() * params.noise_factor)) ASC
  LIMIT 10
) results
