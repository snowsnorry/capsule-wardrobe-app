-- Selects catalog products for each requested capsule category.
-- The query scores products against profile/style constraints, diversifies by color,
-- and returns the highest-ranked catalog-only candidates for AI wardrobe generation.
WITH query_params AS (
  SELECT
    -- Target wardrobe categories that must each receive candidate items.
    $1::text[] AS categories,
    -- Randomization multiplier used only as a tie-breaker around vector distance.
    $2::float AS noise_factor,
    -- Query embedding produced from the capsule/profile prompt.
    $3::vector AS embedding_vector,
    -- Preferred style aesthetic; non-minimalistic matches are treated as accent items.
    $4::text AS style,
    -- Preferred accent color; matching color items are capped to avoid overuse.
    $5::text AS color,
    -- Preferred pattern; non-solid pattern matches are capped to avoid overuse.
    $6::text AS pattern,
    -- Preferred formality level used as a scoring boost.
    $7::text AS formality_level,
    -- Target occasions used as a scoring boost.
    $8::text[] AS occasions,
    -- Target seasons used as a strong scoring boost.
    $9::text[] AS season,
    -- Allowed product audiences derived from the profile audience.
    $10::text[] AS audience_filters,
    -- Product URLs already rejected or selected elsewhere and therefore excluded.
    $11::text[] AS rejected_urls,
    -- Maximum number of candidates returned per category.
    $12::int AS final_candidate_limit
)
SELECT results.*
FROM query_params AS params
CROSS JOIN unnest(params.categories) AS cats(target_category)
CROSS JOIN LATERAL (
  SELECT * FROM (
    SELECT
      filtered_items.*,
      -- Final color diversity rank; keeps repeated color groups from dominating results.
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(color_base, ARRAY[]::text[])
        ORDER BY relevance_score DESC, (distance + (RANDOM() * params.noise_factor)) ASC
      ) as color_rank
    FROM (
      SELECT
        raw_scored.*,
        -- Style role rank; caps accent/base style groups depending on requested style.
        ROW_NUMBER() OVER (
          PARTITION BY style_role
          ORDER BY relevance_score DESC, distance ASC
        ) as style_rank,
        -- Accent color rank; caps exact color matches so they do not flood a category.
        ROW_NUMBER() OVER (
          PARTITION BY is_color_match
          ORDER BY relevance_score DESC, distance ASC
        ) as accent_rank,
        -- Pattern rank; caps limited non-solid pattern matches for visual variety.
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
          -- Semantic distance from the prompt embedding; lower distance is better.
          embedding <=> params.embedding_vector as distance,
          -- Scoring stage: classify items as requested-style accent, minimalistic base, or other.
          CASE WHEN params.style IS NOT NULL AND lower(params.style) != 'minimalistic' AND params.style = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'accent'
            WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'base'
            ELSE 'other' END as style_role,
          -- Scoring stage: mark exact accent-color matches for boosting and capping.
          (params.color IS NOT NULL AND params.color != '' AND params.color = ANY(color_base)) as is_color_match,
          -- Scoring stage: mark non-solid pattern matches so they can be capped.
          (CASE WHEN lower(params.pattern) = 'solid' THEN FALSE
            WHEN params.pattern IS NOT NULL AND params.pattern != '' THEN lower(COALESCE(pattern, '')) = lower(params.pattern)
            ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
          -- Scoring stage: combine profile/formality/style/occasion/season/color/pattern boosts.
          (
            -- Boost items matching the requested formality level.
            CASE WHEN params.formality_level IS NOT NULL AND params.formality_level = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
            +
            -- Boost exact style matches, with a smaller base-item boost for minimalistic items.
            CASE
              WHEN params.style IS NOT NULL AND params.style = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
              WHEN params.style IS NOT NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 15
              WHEN params.style IS NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
              ELSE 0
            END
            +
            -- Boost items that match any requested occasion.
            CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && params.occasions THEN 20 ELSE 0 END
            +
            -- Strongly boost seasonal matches, while keeping seasonless products viable.
            CASE WHEN COALESCE(season, ARRAY[]::text[]) && params.season THEN 50
              WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
              ELSE 0 END
            +
            -- Boost exact color matches.
            CASE WHEN params.color IS NOT NULL AND params.color != '' AND params.color = ANY(color_base) THEN 20 ELSE 0 END
            +
            -- Boost exact pattern matches.
            CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
          ) as relevance_score
        FROM products
        WHERE
          -- Hard filter: only search the category currently being expanded.
          category = cats.target_category
          -- Hard filter: only include profile-compatible product audiences.
          AND lower(COALESCE(audience, '')) = ANY(params.audience_filters)
          -- Hard filter: when a color is requested, allow exact matches or neutrals; otherwise require neutrals.
          AND (CASE WHEN params.color IS NOT NULL AND params.color != '' THEN params.color = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
            ELSE COALESCE(is_neutral, false) END)
          -- Hard filter: keep solid requests solid-like; otherwise allow exact requested pattern plus solid fallback.
          AND (CASE WHEN lower(params.pattern) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
            ELSE lower(COALESCE(pattern, '')) = lower(params.pattern) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
          -- Hard filter: exclude URLs already rejected by previous capsule attempts.
          AND NOT (products.url = ANY(params.rejected_urls))
      ) raw_scored
    ) filtered_items
    WHERE
      -- Hard filter: cap accent/base style groups after relevance ranking.
      (CASE WHEN params.style IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
        ELSE (style_role != 'base' OR style_rank <= 6) END)
      AND
      -- Hard filter: cap exact accent-color matches after relevance ranking.
      (is_color_match IS NOT TRUE OR accent_rank <= 3)
      AND
      -- Hard filter: cap non-solid pattern matches after relevance ranking.
      (is_pattern_limited_item IS NOT TRUE OR lower(params.pattern) = 'solid' OR pattern_rank <= 3)
  ) results
  ORDER BY
    relevance_score DESC,
    color_rank ASC,
    (distance + (RANDOM() * params.noise_factor)) ASC
  LIMIT (SELECT final_candidate_limit FROM query_params)
) results
