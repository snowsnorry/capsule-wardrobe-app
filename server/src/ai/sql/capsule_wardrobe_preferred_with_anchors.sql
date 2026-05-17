-- Selects mandatory wardrobe anchors plus optional catalog and wardrobe candidates.
-- The query returns anchors separately, excludes them from optional wardrobe candidates,
-- balances catalog/wardrobe pools, and reduces optional wardrobe capacity by anchor count.
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
    -- Product or wardrobe URLs already rejected or selected elsewhere and therefore excluded.
    $11::text[] AS rejected_urls,
    -- Maximum number of final optional candidates returned per category.
    $12::int AS final_candidate_limit,
    -- Profile email used to select only the current user's wardrobe rows.
    $13::text AS profile_email,
    -- Additional relevance score granted to wardrobe-owned optional candidates.
    $14::int AS wardrobe_boost,
    -- Maximum catalog candidates kept before final cross-source ranking.
    $15::int AS catalog_pool_limit,
    -- Maximum wardrobe candidates kept before final cross-source ranking.
    $16::int AS wardrobe_pool_limit,
    -- Numeric wardrobe ids that must be included as mandatory anchors.
    $17::bigint[] AS anchor_wardrobe_ids,
    -- Additional relevance weight for optional candidates similar to selected anchors.
    $18::float AS anchor_similarity_bonus_weight
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
anchor_counts AS (
  -- Anchor count per category, used to reduce optional wardrobe capacity in that category.
  SELECT category, count(*)::int AS anchor_count
  FROM anchor_items
  GROUP BY category
),
optional_candidates AS (
  SELECT results.*
  FROM query_params AS params
  CROSS JOIN anchor_catalog_urls AS anchor_urls
  CROSS JOIN unnest(params.categories) AS cats(target_category)
  CROSS JOIN LATERAL (
    WITH candidate_items AS (
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
        products.embedding
      FROM products
      -- Hard filter: catalog candidates must match the category currently being expanded.
      WHERE products.category = cats.target_category
        -- Hard filter: exclude catalog products already represented by mandatory anchors.
        AND NOT (products.url = ANY(anchor_urls.urls))

      UNION ALL

      SELECT
        ('W' || wardrobe.id::text) AS id,
        'wardrobe'::text AS item_source,
        'candidate'::text AS selection_role,
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
        wardrobe.embedding
      FROM wardrobe
      -- Hard filter: only ready current-profile wardrobe candidates from this category are optional candidates.
      WHERE wardrobe.profile_email = params.profile_email
        AND wardrobe.processing_status = 'ready'
        AND wardrobe.category = cats.target_category
        -- Hard filter: mandatory anchors must not also appear in AVAILABLE ITEMS.
        AND wardrobe.id <> ALL(params.anchor_wardrobe_ids)
    ),
    scored AS (
      SELECT
        candidate_items.*,
        -- Semantic distance from the prompt embedding; lower distance is better.
        candidate_items.embedding <=> params.embedding_vector AS distance,
        -- Scoring stage: combine profile boosts, wardrobe preference, and anchor-similarity preference.
        (
          -- Boost items matching the requested formality level.
          CASE WHEN params.formality_level IS NOT NULL AND params.formality_level = ANY(COALESCE(candidate_items.formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
          -- Boost exact style matches, with a smaller base-item boost for minimalistic items.
          + CASE WHEN params.style IS NOT NULL AND params.style = ANY(COALESCE(candidate_items.style, ARRAY[]::text[])) THEN 20
                 WHEN 'minimalistic' = ANY(COALESCE(candidate_items.style, ARRAY[]::text[])) THEN 15 ELSE 0 END
          -- Boost items that match any requested occasion.
          + CASE WHEN COALESCE(candidate_items.occasions, ARRAY[]::text[]) && params.occasions THEN 20 ELSE 0 END
          -- Strongly boost seasonal matches, while keeping seasonless products viable.
          + CASE WHEN COALESCE(candidate_items.season, ARRAY[]::text[]) && params.season THEN 50
                 WHEN cardinality(COALESCE(candidate_items.season, ARRAY[]::text[])) = 0 THEN 40 ELSE 0 END
          -- Boost exact accent-color matches.
          + CASE WHEN params.color IS NOT NULL AND params.color != '' AND params.color = ANY(COALESCE(candidate_items.color_base, ARRAY[]::text[])) THEN 20 ELSE 0 END
          -- Boost exact pattern matches.
          + CASE WHEN params.pattern IS NOT NULL AND params.pattern != '' AND lower(COALESCE(candidate_items.pattern, '')) = lower(params.pattern) THEN 20 ELSE 0 END
          -- Boost wardrobe-owned optional candidates so user's wardrobe remains preferred.
          + CASE WHEN candidate_items.item_source = 'wardrobe' THEN params.wardrobe_boost ELSE 0 END
          -- Boost candidates similar to anchors, reduced when they are in the same category as an anchor.
          + CASE WHEN EXISTS (
              SELECT 1 FROM anchor_items AS anchor
              WHERE lower(COALESCE(anchor.category, '')) = lower(COALESCE(candidate_items.category, ''))
            )
            THEN params.anchor_similarity_bonus_weight * 0.25 * COALESCE((
              SELECT MAX(1 - (candidate_items.embedding <=> anchor.embedding))
              FROM anchor_items AS anchor
              WHERE candidate_items.embedding IS NOT NULL AND anchor.embedding IS NOT NULL
            ), 0)
            ELSE params.anchor_similarity_bonus_weight * COALESCE((
              SELECT MAX(1 - (candidate_items.embedding <=> anchor.embedding))
              FROM anchor_items AS anchor
              WHERE candidate_items.embedding IS NOT NULL AND anchor.embedding IS NOT NULL
            ), 0)
          END
        ) AS relevance_score
      FROM candidate_items
      -- Hard filter: only include profile-compatible audiences.
      WHERE lower(COALESCE(candidate_items.audience, '')) = ANY(params.audience_filters)
        -- Hard filter: when a color is requested, allow exact matches or neutrals; otherwise require neutrals.
        AND (
          CASE WHEN params.color IS NOT NULL AND params.color != '' THEN
            params.color = ANY(COALESCE(candidate_items.color_base, ARRAY[]::text[])) OR COALESCE(candidate_items.is_neutral, false)
          ELSE COALESCE(candidate_items.is_neutral, false) END
        )
        -- Hard filter: keep solid requests solid-like; otherwise allow exact requested pattern plus solid fallback.
        AND (
          CASE WHEN lower(params.pattern) = 'solid' THEN
            candidate_items.pattern IS NULL OR trim(candidate_items.pattern) = '' OR lower(candidate_items.pattern) = 'solid'
          ELSE lower(COALESCE(candidate_items.pattern, '')) = lower(params.pattern)
            OR candidate_items.pattern IS NULL OR trim(candidate_items.pattern) = '' OR lower(candidate_items.pattern) = 'solid' END
        )
        -- Hard filter: exclude URLs already rejected by previous capsule attempts.
        AND NOT (candidate_items.url = ANY(params.rejected_urls))
    ),
    source_ranked AS (
      SELECT
        scored.*,
        -- Source rank; caps catalog and wardrobe pools before final cross-source ranking.
        ROW_NUMBER() OVER (PARTITION BY item_source ORDER BY relevance_score DESC, distance ASC) AS source_rank
      FROM scored
    )
    SELECT id, item_source, selection_role, source, raw_image_url, processing_status, wardrobe_id, product_id, name, url, description, brand, price, currency, availability, image_url, audience, category, season, formality_level, style, occasions, color_base, pattern, finish, is_neutral, composition, silhouette, fit, closure_type, embedding, distance, relevance_score
    FROM source_ranked
    WHERE
      -- Hard filter: cap optional catalog candidates to the configured catalog pool.
      (item_source = 'catalog' AND source_rank <= params.catalog_pool_limit)
      OR (
        item_source = 'wardrobe'
        -- Hard filter: cap optional wardrobe candidates after reserving category slots for anchors.
        AND source_rank <= GREATEST(params.wardrobe_pool_limit - COALESCE((SELECT anchor_count FROM anchor_counts WHERE category = cats.target_category), 0), 0)
      )
    -- Final per-category ranking keeps the strongest optional candidates after source caps.
    ORDER BY relevance_score DESC, CASE WHEN item_source = 'wardrobe' THEN 0 ELSE 1 END, distance + (RANDOM() * params.noise_factor) ASC
    LIMIT (SELECT final_candidate_limit FROM query_params)
  ) results
)
-- Anchors and candidates are split later by selection_role before prompt rendering.
SELECT * FROM anchor_items
UNION ALL
SELECT * FROM optional_candidates
