-- Selects capsule candidates from both the product catalog and the user's wardrobe.
-- The query prefers ready wardrobe items via a scoring boost, excludes catalog products
-- already represented in wardrobe, balances catalog/wardrobe pools, and returns final AI candidates.
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
    -- Preferred accent color; matching color items are boosted and capped.
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
    -- Product or wardrobe URLs already rejected or selected elsewhere and therefore excluded.
    $11::text[] AS rejected_urls,
    -- Maximum number of final candidates returned per category.
    $12::int AS final_candidate_limit,
    -- Profile email used to select only the current user's wardrobe rows.
    $13::text AS profile_email,
    -- Additional relevance score granted to wardrobe-owned candidates.
    $14::int AS wardrobe_boost,
    -- Maximum catalog candidates kept before final cross-source ranking.
    $15::int AS catalog_pool_limit,
    -- Maximum wardrobe candidates kept before final cross-source ranking.
    $16::int AS wardrobe_pool_limit
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
        -- Wardrobe dedupe rank; keeps the newest row for each catalog-linked or uploaded item.
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(wardrobe.product_id, 'wardrobe:' || wardrobe.id::text)
          ORDER BY wardrobe.updated_at DESC NULLS LAST, wardrobe.id DESC
        ) AS wardrobe_duplicate_rank
      FROM wardrobe
      -- Hard filter: only consider the current profile's wardrobe rows.
      WHERE wardrobe.profile_email = params.profile_email
        -- Hard filter: only ready wardrobe items can be selected for generated capsules.
        AND wardrobe.processing_status = 'ready'
        -- Hard filter: wardrobe candidates must have a stable URL for downstream rejection tracking.
        AND NULLIF(trim(COALESCE(wardrobe.url, '')), '') IS NOT NULL
    ) ranked_wardrobe
    -- Hard filter: keep only the latest row from each dedupe group.
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
    -- Hard filter: catalog candidates must match the category currently being expanded.
    WHERE products.category = cats.target_category
      -- Hard filter: do not duplicate catalog products already present in wardrobe.
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
    -- Hard filter: wardrobe candidates must match the category currently being expanded.
    WHERE wardrobe_deduped.category = cats.target_category
  ),
  raw_scored AS (
    SELECT
      candidate_items.*,
      -- Semantic distance from the prompt embedding; lower distance is better.
      embedding <=> params.embedding_vector as distance,
      -- Scoring stage: classify items as requested-style accent, minimalistic base, or other.
      CASE WHEN params.style IS NOT NULL AND lower(params.style) != 'minimalistic' AND params.style = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'accent'
        WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'base'
        ELSE 'other' END as style_role,
      -- Scoring stage: mark exact accent-color matches for boosting and capping.
      (params.color IS NOT NULL AND params.color != '' AND params.color = ANY(COALESCE(color_base, ARRAY[]::text[]))) as is_color_match,
      -- Scoring stage: mark non-solid pattern matches so they can be capped.
      (CASE WHEN lower(params.pattern) = 'solid' THEN FALSE
        WHEN params.pattern IS NOT NULL AND params.pattern != '' THEN lower(COALESCE(pattern, '')) = lower(params.pattern)
        ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
      -- Scoring stage: combine profile boosts and wardrobe ownership preference.
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
        CASE WHEN params.color IS NOT NULL AND params.color != '' AND params.color = ANY(COALESCE(color_base, ARRAY[]::text[])) THEN 20 ELSE 0 END
        +
        -- Boost exact pattern matches.
        CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
        +
        -- Boost wardrobe-owned candidates so existing wardrobe items are preferred when relevant.
        CASE WHEN item_source = 'wardrobe' THEN params.wardrobe_boost ELSE 0 END
      ) as relevance_score
    FROM candidate_items
    WHERE
      -- Hard filter: only include profile-compatible audiences.
      lower(COALESCE(audience, '')) = ANY(params.audience_filters)
      -- Hard filter: when a color is requested, allow exact matches or neutrals; otherwise require neutrals.
      AND (CASE WHEN params.color IS NOT NULL AND params.color != '' THEN params.color = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
        ELSE COALESCE(is_neutral, false) END)
      -- Hard filter: keep solid requests solid-like; otherwise allow exact requested pattern plus solid fallback.
      AND (CASE WHEN lower(params.pattern) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
        ELSE lower(COALESCE(pattern, '')) = lower(params.pattern) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
      -- Hard filter: exclude URLs already rejected by previous capsule attempts.
      AND NOT (url = ANY(params.rejected_urls))
  ),
  ranked AS (
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
    FROM raw_scored
  ),
  filtered_items AS (
    SELECT *
    FROM ranked
    WHERE
      -- Hard filter: cap accent/base style groups after relevance ranking.
      (CASE WHEN params.style IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
        ELSE (style_role != 'base' OR style_rank <= 6) END)
      -- Hard filter: cap exact accent-color matches after relevance ranking.
      AND (is_color_match IS NOT TRUE OR accent_rank <= 3)
      -- Hard filter: cap non-solid pattern matches after relevance ranking.
      AND (is_pattern_limited_item IS NOT TRUE OR lower(params.pattern) = 'solid' OR pattern_rank <= 3)
  ),
  source_ranked AS (
    SELECT
      filtered_items.*,
      -- Source rank; limits catalog and wardrobe pools independently before final ordering.
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
      -- Hard filter: cap the catalog pool before mixing sources.
      (item_source = 'catalog' AND source_rank <= params.catalog_pool_limit)
      OR
      -- Hard filter: cap the wardrobe pool before mixing sources.
      (item_source = 'wardrobe' AND source_rank <= params.wardrobe_pool_limit)
  ),
  color_ranked AS (
    SELECT
      source_limited.*,
      -- Final color diversity rank; keeps repeated color groups from dominating results.
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
  LIMIT (SELECT final_candidate_limit FROM query_params)
) results
