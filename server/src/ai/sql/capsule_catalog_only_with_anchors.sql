-- Selects mandatory wardrobe anchor items plus catalog products for each requested capsule category.
-- The query returns anchors as non-candidate rows, excludes catalog duplicates already represented
-- by anchors, and scores optional catalog candidates with an anchor-similarity boost.
WITH query_params AS (
  SELECT
    -- Target wardrobe categories that must each receive candidate items.
    $1::text[] AS categories,
    -- Randomization multiplier used only as a tie-breaker around vector distance.
    $2::float AS noise_factor,
    -- Query embedding produced from the capsule/profile prompt.
    $3::vector AS embedding_vector,
    -- Preferred style aesthetic used as a scoring boost.
    $4::text AS style,
    -- Preferred accent color; matching color items are boosted and filtered with neutral fallback.
    $5::text AS color,
    -- Preferred pattern; non-solid requests allow exact requested pattern plus solid fallback.
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
    -- Maximum number of optional catalog candidates returned per category.
    $12::int AS final_candidate_limit,
    -- Profile email used to select only the current user's wardrobe anchors.
    $13::text AS profile_email,
    -- Numeric wardrobe ids that must be included as mandatory anchors.
    $14::bigint[] AS anchor_wardrobe_ids,
    -- Additional relevance weight for optional candidates similar to selected anchors.
    $15::float AS anchor_similarity_bonus_weight
),
anchor_items AS (
  SELECT
    ('W' || wardrobe.id::text) AS id,
    'wardrobe'::text AS item_source,
    'anchor'::text AS selection_role,
    wardrobe.source,
    wardrobe.raw_image_url,
    wardrobe.processing_status,
    wardrobe.id::text AS wardrobe_id,
    wardrobe.product_id,
    wardrobe.name,
    wardrobe.url,
    wardrobe.description,
    wardrobe.brand,
    wardrobe.price,
    wardrobe.currency,
    wardrobe.availability,
    wardrobe.image_url,
    wardrobe.audience,
    wardrobe.category,
    wardrobe.season,
    wardrobe.formality_level,
    wardrobe.style,
    wardrobe.occasions,
    wardrobe.color_base,
    wardrobe.pattern,
    wardrobe.finish,
    wardrobe.is_neutral,
    wardrobe.composition,
    wardrobe.silhouette,
    wardrobe.fit,
    wardrobe.closure_type,
    wardrobe.embedding,
    NULL::float AS distance,
    100000::float AS relevance_score
  FROM query_params AS params
  JOIN wardrobe
    -- Hard filter: anchors must belong to the current profile and match the requested ids.
    ON wardrobe.profile_email = params.profile_email
   AND wardrobe.id = ANY(params.anchor_wardrobe_ids)
   -- Hard filter: only ready wardrobe items with a stable category can be mandatory anchors.
   AND wardrobe.processing_status = 'ready'
   AND NULLIF(trim(COALESCE(wardrobe.category, '')), '') IS NOT NULL
),
anchor_catalog_urls AS (
  -- Catalog URLs represented by selected anchors, used to avoid duplicate catalog candidates.
  SELECT COALESCE(array_agg(url) FILTER (WHERE url ~* '^https?://'), ARRAY[]::text[]) AS urls
  FROM anchor_items
),
catalog_candidates AS (
  SELECT results.*
  FROM query_params AS params
  CROSS JOIN anchor_catalog_urls AS anchor_urls
  CROSS JOIN unnest(params.categories) AS cats(target_category)
  CROSS JOIN LATERAL (
    SELECT
      products.id::text AS id,
      'catalog'::text AS item_source,
      'candidate'::text AS selection_role,
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
      -- Semantic distance from the prompt embedding; lower distance is better.
      products.embedding <=> params.embedding_vector AS distance,
      -- Scoring stage: combine profile boosts with anchor-similarity preference.
      (
        -- Boost items matching the requested formality level.
        CASE WHEN params.formality_level IS NOT NULL AND params.formality_level = ANY(COALESCE(products.formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
        -- Boost exact style matches, with a smaller base-item boost for minimalistic items.
        + CASE WHEN params.style IS NOT NULL AND params.style = ANY(COALESCE(products.style, ARRAY[]::text[])) THEN 20
               WHEN 'minimalistic' = ANY(COALESCE(products.style, ARRAY[]::text[])) THEN 15 ELSE 0 END
        -- Boost items that match any requested occasion.
        + CASE WHEN COALESCE(products.occasions, ARRAY[]::text[]) && params.occasions THEN 20 ELSE 0 END
        -- Strongly boost seasonal matches, while keeping seasonless products viable.
        + CASE WHEN COALESCE(products.season, ARRAY[]::text[]) && params.season THEN 50
               WHEN cardinality(COALESCE(products.season, ARRAY[]::text[])) = 0 THEN 40 ELSE 0 END
        -- Boost exact accent-color matches.
        + CASE WHEN params.color IS NOT NULL AND params.color != '' AND params.color = ANY(COALESCE(products.color_base, ARRAY[]::text[])) THEN 20 ELSE 0 END
        -- Boost exact pattern matches.
        + CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(products.pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
        -- Boost candidates similar to anchors, reduced when they are in the same category as an anchor.
        + CASE WHEN EXISTS (
            SELECT 1 FROM anchor_items AS anchor
            WHERE lower(COALESCE(anchor.category, '')) = lower(COALESCE(products.category, ''))
          )
          THEN params.anchor_similarity_bonus_weight * 0.25 * COALESCE((
            SELECT MAX(1 - (products.embedding <=> anchor.embedding))
            FROM anchor_items AS anchor
            WHERE products.embedding IS NOT NULL AND anchor.embedding IS NOT NULL
          ), 0)
          ELSE params.anchor_similarity_bonus_weight * COALESCE((
            SELECT MAX(1 - (products.embedding <=> anchor.embedding))
            FROM anchor_items AS anchor
            WHERE products.embedding IS NOT NULL AND anchor.embedding IS NOT NULL
          ), 0)
        END
      ) AS relevance_score
    FROM products
    -- Hard filter: catalog candidates must match the category currently being expanded.
    WHERE products.category = cats.target_category
      -- Hard filter: only include profile-compatible product audiences.
      AND lower(COALESCE(products.audience, '')) = ANY(params.audience_filters)
      -- Hard filter: when a color is requested, allow exact matches or neutrals; otherwise require neutrals.
      AND (
        CASE WHEN params.color IS NOT NULL AND params.color != '' THEN
          params.color = ANY(COALESCE(products.color_base, ARRAY[]::text[])) OR COALESCE(products.is_neutral, false)
        ELSE COALESCE(products.is_neutral, false) END
      )
      -- Hard filter: keep solid requests solid-like; otherwise allow exact requested pattern plus solid fallback.
      AND (
        CASE WHEN lower(params.pattern) = 'solid' THEN
          products.pattern IS NULL OR trim(products.pattern) = '' OR lower(products.pattern) = 'solid'
        ELSE lower(COALESCE(products.pattern, '')) = lower(params.pattern)
          OR products.pattern IS NULL OR trim(products.pattern) = '' OR lower(products.pattern) = 'solid' END
      )
      -- Hard filter: exclude URLs already rejected by previous capsule attempts.
      AND NOT (products.url = ANY(params.rejected_urls))
      -- Hard filter: exclude catalog products already represented by mandatory anchors.
      AND NOT (products.url = ANY(anchor_urls.urls))
    -- Final per-category ranking keeps the strongest optional catalog candidates after scoring.
    ORDER BY relevance_score DESC, (products.embedding <=> params.embedding_vector) + (RANDOM() * params.noise_factor) ASC
    LIMIT (SELECT final_candidate_limit FROM query_params)
  ) results
)
-- Anchors and candidates are split later by selection_role before prompt rendering.
SELECT * FROM anchor_items
UNION ALL
SELECT * FROM catalog_candidates
