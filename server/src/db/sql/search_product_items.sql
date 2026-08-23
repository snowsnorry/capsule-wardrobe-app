-- Selects product search matches after applying lexical, semantic, URL, liked,
-- price, and facet filters. Keep query_params aliases in sync with
-- buildSearchItemsSqlValues in searchProductQueries.ts.
WITH query_params AS (
  SELECT
    -- Optional query embedding vector used for semantic ranking and filtering.
    $1::text AS embedding_vector_text,
    $1::vector(1024) AS embedding_vector,
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
    /* EXACT_COLOR_PARAMS */
),
filtered_products AS (
  SELECT
    products.id,
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
    CASE
      WHEN params.embedding_vector_text IS NULL THEN NULL
      WHEN products.embedding IS NULL THEN NULL
      WHEN vector_dims(products.embedding) <> 1024 THEN NULL
      ELSE products.embedding::vector(1024) <=> params.embedding_vector
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
    AND (cardinality(params.season) = 0 OR products.season && params.season)
    AND (cardinality(params.formality_level) = 0 OR products.formality_level && params.formality_level)
    AND (cardinality(params.style) = 0 OR products.style && params.style)
    AND (cardinality(params.occasions) = 0 OR products.occasions && params.occasions)
    AND (cardinality(params.color) = 0 OR products.color_base && params.color)
    AND (cardinality(params.pattern) = 0 OR lower(coalesce(products.pattern, '')) = ANY(params.pattern))
    AND (cardinality(params.silhouette) = 0 OR lower(coalesce(products.silhouette, '')) = ANY(params.silhouette))
    AND (cardinality(params.fit) = 0 OR lower(coalesce(products.fit, '')) = ANY(params.fit))
    AND (cardinality(params.closure_type) = 0 OR products.closure_type && params.closure_type)
),
matching_products AS (
  SELECT
    filtered_products.id,
    filtered_products.name,
    filtered_products.url,
    filtered_products.description,
    filtered_products.brand,
    filtered_products.price,
    filtered_products.currency,
    filtered_products.availability,
    filtered_products.image_url,
    filtered_products.audience,
    filtered_products.category,
    filtered_products.season,
    filtered_products.formality_level,
    filtered_products.style,
    filtered_products.occasions,
    filtered_products.color_base,
    filtered_products.pattern,
    filtered_products.finish,
    filtered_products.is_neutral,
    filtered_products.composition,
    filtered_products.silhouette,
    filtered_products.fit,
    filtered_products.closure_type,
    filtered_products.distance,
    filtered_products.lexical_score,
    row_number() OVER (
      ORDER BY
        filtered_products.lexical_score DESC,
        lower(coalesce(filtered_products.brand, '')) ASC,
        lower(coalesce(filtered_products.name, '')) ASC
    ) AS lexical_rank,
    row_number() OVER (
      ORDER BY
        filtered_products.distance ASC NULLS LAST,
        lower(coalesce(filtered_products.brand, '')) ASC,
        lower(coalesce(filtered_products.name, '')) ASC
    ) AS semantic_rank
  FROM filtered_products
  CROSS JOIN query_params AS params
  WHERE
    params.text_search_mode = 'none'
    OR (params.text_search_mode = 'lexical' AND filtered_products.lexical_score > 0)
    OR (
      params.text_search_mode = 'hybrid'
      AND (
        filtered_products.lexical_score > 0
        OR (
          params.embedding_vector_text IS NOT NULL
          AND params.semantic_distance_threshold IS NOT NULL
          AND filtered_products.distance <= params.semantic_distance_threshold
        )
      )
    )
    OR (
      params.text_search_mode = 'semantic'
      AND (
        params.embedding_vector_text IS NULL
        OR params.semantic_distance_threshold IS NULL
        OR filtered_products.distance <= params.semantic_distance_threshold
      )
    )
)
SELECT
  matching_products.id,
  matching_products.name,
  matching_products.url,
  matching_products.description,
  matching_products.brand,
  matching_products.price,
  matching_products.currency,
  matching_products.availability,
  matching_products.image_url AS "imageUrl",
  matching_products.audience,
  matching_products.category,
  matching_products.season,
  matching_products.formality_level AS "formalityLevel",
  matching_products.style,
  matching_products.occasions,
  matching_products.color_base AS "colorBase",
  matching_products.pattern,
  matching_products.finish,
  matching_products.is_neutral AS "isNeutral",
  matching_products.composition,
  matching_products.silhouette,
  matching_products.fit,
  matching_products.closure_type AS "closureType",
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
  matching_products.distance
  /* EXACT_COLOR_SELECT */
FROM matching_products
CROSS JOIN query_params AS params
/* EXACT_COLOR_JOIN */
ORDER BY
  CASE
    WHEN params.text_search_mode = 'hybrid' THEN
      (CASE WHEN matching_products.lexical_score > 0 THEN 1.0 / (60 + matching_products.lexical_rank) ELSE 0 END)
      +
      (
        CASE
          WHEN params.semantic_distance_threshold IS NOT NULL
            AND matching_products.distance <= params.semantic_distance_threshold
          THEN 1.0 / (60 + matching_products.semantic_rank)
          ELSE 0
        END
      )
    ELSE NULL
  END DESC NULLS LAST,
  CASE WHEN params.text_search_mode = 'lexical' THEN matching_products.lexical_score ELSE NULL END DESC NULLS LAST,
  CASE WHEN params.text_search_mode = 'semantic' THEN matching_products.distance ELSE NULL END ASC NULLS LAST,
  CASE WHEN params.text_search_mode = 'semantic' THEN matching_products.lexical_score ELSE NULL END DESC NULLS LAST,
  /* EXACT_COLOR_ORDER */
  lower(coalesce(matching_products.brand, '')) ASC,
  lower(coalesce(matching_products.name, '')) ASC,
  matching_products.url ASC
LIMIT (SELECT result_limit FROM query_params)
OFFSET (SELECT result_offset FROM query_params)
