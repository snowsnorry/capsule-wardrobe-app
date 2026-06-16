-- Selects product search matches after applying lexical, semantic, URL, liked,
-- price, and facet filters. Keep query_params aliases in sync with
-- buildSearchItemsSqlValues in searchProductQueries.ts.
WITH query_params AS (
  SELECT
    -- Optional query embedding vector used for semantic ranking and filtering.
    $1::text AS embedding_vector_text,
    $1::vector AS embedding_vector,
    -- Normalized exact lexical query used for name equality scoring.
    $2::text AS text_query,
    -- Escaped LIKE prefix pattern for lexical name, description, composition, and color matching.
    $3::text AS text_prefix_pattern,
    -- Escaped LIKE contains pattern for lexical name, description, composition, and color matching.
    $4::text AS text_contains_pattern,
    -- Brand filters normalized by the search payload.
    $5::text[] AS brand,
    -- Optional product URL prefix used for URL searches.
    $6::text AS normalized_url_prefix,
    -- Optional lower inclusive price bound.
    $7::double precision AS price_min,
    -- Optional upper inclusive price bound.
    $8::double precision AS price_max,
    -- Whether results must be present in user_liked_items for the profile.
    $9::boolean AS liked_only,
    -- Profile email used for liked-only filtering and per-user joins.
    $10::text AS profile_email,
    -- Audience facet filters.
    $11::text[] AS audience,
    -- Category facet filters.
    $12::text[] AS category,
    -- Season facet filters.
    $13::text[] AS season,
    -- Formality-level facet filters.
    $14::text[] AS formality_level,
    -- Style facet filters.
    $15::text[] AS style,
    -- Occasion facet filters.
    $16::text[] AS occasions,
    -- Base-color facet filters.
    $17::text[] AS color,
    -- Pattern facet filters.
    $18::text[] AS pattern,
    -- Silhouette facet filters.
    $19::text[] AS silhouette,
    -- Fit facet filters.
    $20::text[] AS fit,
    -- Closure-type facet filters.
    $21::text[] AS closure_type,
    -- Search routing mode: none, lexical, hybrid, or semantic.
    $22::text AS text_search_mode,
    -- Maximum semantic distance accepted for hybrid and semantic searches.
    $23::double precision AS semantic_distance_threshold,
    -- Maximum number of product rows returned.
    $24::integer AS result_limit,
    -- Product row offset for pagination.
    $25::integer AS result_offset
),
filtered_products AS (
  SELECT
    products.*,
    CASE
      WHEN params.embedding_vector_text IS NULL THEN NULL
      ELSE products.embedding <=> params.embedding_vector
    END AS distance,
    (
      CASE
        WHEN params.text_query IS NULL THEN 0
        WHEN lower(coalesce(products.name, '')) = params.text_query THEN 120
        WHEN lower(coalesce(products.name, '')) LIKE params.text_prefix_pattern ESCAPE '~' THEN 90
        WHEN lower(coalesce(products.name, '')) LIKE params.text_contains_pattern ESCAPE '~' THEN 70
        ELSE 0
      END
      +
      greatest(
        CASE
          WHEN params.text_query IS NULL THEN 0
          WHEN lower(coalesce(products.description, '')) LIKE params.text_prefix_pattern ESCAPE '~' THEN 45
          WHEN lower(coalesce(products.description, '')) LIKE params.text_contains_pattern ESCAPE '~' THEN 30
          ELSE 0
        END,
        CASE
          WHEN params.text_query IS NULL THEN 0
          WHEN lower(coalesce(products.composition, '')) LIKE params.text_prefix_pattern ESCAPE '~' THEN 45
          WHEN lower(coalesce(products.composition, '')) LIKE params.text_contains_pattern ESCAPE '~' THEN 30
          ELSE 0
        END,
        CASE
          WHEN params.text_query IS NULL THEN 0
          WHEN EXISTS (
            SELECT 1
            FROM unnest(coalesce(products.color_base, ARRAY[]::text[])) AS color_value(value)
            WHERE lower(color_value.value) LIKE params.text_prefix_pattern ESCAPE '~'
          ) THEN 45
          WHEN EXISTS (
            SELECT 1
            FROM unnest(coalesce(products.color_base, ARRAY[]::text[])) AS color_value(value)
            WHERE lower(color_value.value) LIKE params.text_contains_pattern ESCAPE '~'
          ) THEN 30
          ELSE 0
        END
      )
    ) AS lexical_score
  FROM query_params AS params
  CROSS JOIN products
  WHERE
    (cardinality(params.brand) = 0 OR lower(coalesce(products.brand, '')) = ANY(params.brand))
    AND (params.normalized_url_prefix IS NULL OR products.url LIKE params.normalized_url_prefix)
    AND (params.price_min IS NULL OR products.price >= params.price_min)
    AND (params.price_max IS NULL OR products.price <= params.price_max)
    AND (
      params.liked_only IS NOT TRUE
      OR (
        params.profile_email IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM user_liked_items
          WHERE user_liked_items.user_email = params.profile_email
            AND user_liked_items.item_url = products.url
        )
      )
    )
    AND (cardinality(params.audience) = 0 OR lower(coalesce(products.audience, '')) = ANY(params.audience))
    AND (cardinality(params.category) = 0 OR lower(coalesce(products.category, '')) = ANY(params.category))
    AND (cardinality(params.season) = 0 OR coalesce(products.season, ARRAY[]::text[]) && params.season)
    AND (cardinality(params.formality_level) = 0 OR coalesce(products.formality_level, ARRAY[]::text[]) && params.formality_level)
    AND (cardinality(params.style) = 0 OR coalesce(products.style, ARRAY[]::text[]) && params.style)
    AND (cardinality(params.occasions) = 0 OR coalesce(products.occasions, ARRAY[]::text[]) && params.occasions)
    AND (cardinality(params.color) = 0 OR coalesce(products.color_base, ARRAY[]::text[]) && params.color)
    AND (cardinality(params.pattern) = 0 OR lower(coalesce(products.pattern, '')) = ANY(params.pattern))
    AND (cardinality(params.silhouette) = 0 OR lower(coalesce(products.silhouette, '')) = ANY(params.silhouette))
    AND (cardinality(params.fit) = 0 OR lower(coalesce(products.fit, '')) = ANY(params.fit))
    AND (cardinality(params.closure_type) = 0 OR coalesce(products.closure_type, ARRAY[]::text[]) && params.closure_type)
),
matching_products AS (
  SELECT
    filtered_products.*,
    row_number() OVER (
      ORDER BY lexical_score DESC, lower(coalesce(brand, '')) ASC, lower(coalesce(name, '')) ASC
    ) AS lexical_rank,
    row_number() OVER (
      ORDER BY distance ASC NULLS LAST, lower(coalesce(brand, '')) ASC, lower(coalesce(name, '')) ASC
    ) AS semantic_rank
  FROM filtered_products
  CROSS JOIN query_params AS params
  WHERE
    params.text_search_mode = 'none'
    OR (params.text_search_mode = 'lexical' AND lexical_score > 0)
    OR (
      params.text_search_mode = 'hybrid'
      AND (
        lexical_score > 0
        OR (
          params.embedding_vector_text IS NOT NULL
          AND params.semantic_distance_threshold IS NOT NULL
          AND distance <= params.semantic_distance_threshold
        )
      )
    )
    OR (
      params.text_search_mode = 'semantic'
      AND (
        params.embedding_vector_text IS NULL
        OR params.semantic_distance_threshold IS NULL
        OR distance <= params.semantic_distance_threshold
      )
    )
)
SELECT
  id,
  name,
  url,
  description,
  brand,
  price,
  currency,
  availability,
  image_url AS "imageUrl",
  audience,
  category,
  season,
  formality_level AS "formalityLevel",
  style,
  occasions,
  color_base AS "colorBase",
  pattern,
  finish,
  is_neutral AS "isNeutral",
  composition,
  silhouette,
  fit,
  closure_type AS "closureType",
  EXISTS (
    SELECT 1
    FROM wardrobe
    WHERE wardrobe.profile_email = params.profile_email
      AND wardrobe.source = 'from_catalog'
      AND wardrobe.url = matching_products.url
  ) AS "isSavedToWardrobe",
  EXISTS (
    SELECT 1
    FROM user_liked_items
    WHERE user_liked_items.user_email = params.profile_email
      AND user_liked_items.item_url = matching_products.url
  ) AS "isLiked",
  distance
FROM matching_products
CROSS JOIN query_params AS params
ORDER BY
  CASE
    WHEN params.text_search_mode = 'hybrid' THEN
      (CASE WHEN lexical_score > 0 THEN 1.0 / (60 + lexical_rank) ELSE 0 END)
      +
      (
        CASE
          WHEN params.semantic_distance_threshold IS NOT NULL
            AND distance <= params.semantic_distance_threshold
          THEN 1.0 / (60 + semantic_rank)
          ELSE 0
        END
      )
    ELSE NULL
  END DESC NULLS LAST,
  CASE WHEN params.text_search_mode = 'lexical' THEN lexical_score ELSE NULL END DESC NULLS LAST,
  CASE WHEN params.text_search_mode = 'semantic' THEN distance ELSE NULL END ASC NULLS LAST,
  CASE WHEN params.text_search_mode = 'semantic' THEN lexical_score ELSE NULL END DESC NULLS LAST,
  lower(coalesce(brand, '')) ASC,
  lower(coalesce(name, '')) ASC
LIMIT (SELECT result_limit FROM query_params)
OFFSET (SELECT result_offset FROM query_params)
