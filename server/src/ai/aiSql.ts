/* eslint-disable max-lines */
import type { CountByKey, UserProfileLike } from "./types.js";
import { queryCapsuleWardrobeItemsForMultipleAccentColors } from "./aiSqlMultipleAccent.js";
import type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
  CapsuleWardrobeSqlRow,
} from "./aiSqlTypes.js";

const MULTIPLE_ACCENT_COLORS = "multiple_accent_colors";
const WARDROBE_RELEVANCE_BOOST = 25;
const CATALOG_POOL_LIMIT = 8;
const WARDROBE_POOL_LIMIT = 5;
const FINAL_CANDIDATE_LIMIT = 10;

const AUDIENCE_FILTERS_BY_PROFILE = {
  man: ["man", "all"],
  woman: ["woman", "all"],
  any: ["man", "woman", "all"],
};

function normalizePatternValue(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function getSqlPattern(value) {
  return normalizePatternValue(value) || "solid";
}

function getAudienceFilters(audience) {
  return (
    AUDIENCE_FILTERS_BY_PROFILE[audience] || AUDIENCE_FILTERS_BY_PROFILE.any
  );
}

function getProfileStringArray(value) {
  return Array.isArray(value) ? value : [];
}

function getRejectedUrls(value) {
  return Array.isArray(value)
    ? value.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];
}

function getSqlNoiseFactor(userProfile: UserProfileLike | null) {
  const additionalText =
    typeof userProfile?.text === "string" ? userProfile.text.trim() : "";
  return additionalText ? 0 : 0.05;
}

function getSqlSourceMode(
  userProfile: UserProfileLike | null,
): CapsuleWardrobeSqlParams["sourceMode"] {
  return userProfile?.sourceMode === "wardrobe_preferred"
    ? "wardrobe_preferred"
    : "catalog_only";
}

function getProfileSqlFilters(userProfile: UserProfileLike | null) {
  return {
    formalityLevel: userProfile?.formalityLevel ?? null,
    style: userProfile?.style ?? null,
    occasions: getProfileStringArray(userProfile?.occasions),
    season: getProfileStringArray(userProfile?.season),
    audienceFilters: getAudienceFilters(userProfile?.audience),
    color: userProfile?.color ?? null,
    pattern: getSqlPattern(userProfile?.pattern),
    rejectedUrls: getRejectedUrls(userProfile?.rejected),
    noiseFactor: getSqlNoiseFactor(userProfile),
  };
}

function buildCapsuleWardrobeSqlParams(
  userProfile: UserProfileLike | null = null,
  promptEmbeddings: number[] = [],
  capsuleCategories: CountByKey,
): CapsuleWardrobeSqlParams {
  return {
    categories: Object.keys(capsuleCategories),
    sourceMode: getSqlSourceMode(userProfile),
    profileEmail:
      typeof userProfile?.email === "string" ? userProfile.email.trim() : "",
    wardrobeBoost: WARDROBE_RELEVANCE_BOOST,
    catalogPoolLimit: CATALOG_POOL_LIMIT,
    wardrobePoolLimit: WARDROBE_POOL_LIMIT,
    finalCandidateLimit: FINAL_CANDIDATE_LIMIT,
    ...getProfileSqlFilters(userProfile),
    embeddingVector: `[${promptEmbeddings.join(",")}]`,
  };
}

// eslint-disable-next-line max-lines-per-function
async function queryCatalogOnlyCapsuleWardrobeItems(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  return sql<CapsuleWardrobeSqlRow>`
    SELECT results.*
    FROM unnest(${params.categories}::text[]) AS cats(target_category)
    CROSS JOIN LATERAL (
      SELECT * FROM (
        SELECT 
          filtered_items.*,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(color_base, ARRAY[]::text[])
            ORDER BY relevance_score DESC, (distance + (RANDOM() * ${params.noiseFactor}::float)) ASC
          ) as color_rank
        FROM (
          SELECT 
            raw_scored.*,
            ROW_NUMBER() OVER (
              PARTITION BY style_role
              ORDER BY relevance_score DESC, distance ASC
            ) as style_rank,
            ROW_NUMBER() OVER (
              PARTITION BY is_color_match
              ORDER BY relevance_score DESC, distance ASC
            ) as accent_rank,
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
              embedding <=> ${params.embeddingVector}::vector as distance,
              CASE WHEN ${params.style}::text IS NOT NULL AND lower(${params.style}::text) != 'minimalistic' AND ${params.style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'accent'
                WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'base'
                ELSE 'other' END as style_role,
              (${params.color}::text IS NOT NULL AND ${params.color}::text != '' AND ${params.color}::text = ANY(color_base)) as is_color_match,
              (CASE WHEN lower(${params.pattern}::text) = 'solid' THEN FALSE
                WHEN ${params.pattern}::text IS NOT NULL AND ${params.pattern}::text != '' THEN lower(COALESCE(pattern, '')) = lower(${params.pattern}::text)
                ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
              (
                CASE WHEN ${params.formalityLevel}::text IS NOT NULL AND ${params.formalityLevel}::text = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
                +
                CASE 
                  WHEN ${params.style}::text IS NOT NULL AND ${params.style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
                  WHEN ${params.style}::text IS NOT NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 15
                  WHEN ${params.style}::text IS NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
                  ELSE 0 
                END
                +
                CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && ${params.occasions}::text[] THEN 20 ELSE 0 END
                +
                CASE WHEN COALESCE(season, ARRAY[]::text[]) && ${params.season}::text[] THEN 50
                  WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
                  ELSE 0 END
                +
                CASE WHEN ${params.color}::text IS NOT NULL AND ${params.color}::text != '' AND ${params.color}::text = ANY(color_base) THEN 20 ELSE 0 END
                +
                CASE WHEN ${params.pattern}::text IS NOT NULL AND ${params.pattern}::text != '' AND lower(COALESCE(pattern, '')) = lower(${params.pattern}::text) THEN 20 ELSE 0 END
              ) as relevance_score

            FROM products
            WHERE 
              category = cats.target_category
              AND lower(COALESCE(audience, '')) = ANY(${params.audienceFilters}::text[])
              AND (CASE WHEN ${params.color}::text IS NOT NULL AND ${params.color}::text != '' THEN ${params.color}::text = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
                ELSE COALESCE(is_neutral, false) END)
              AND (CASE WHEN lower(${params.pattern}::text) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
                ELSE lower(COALESCE(pattern, '')) = lower(${params.pattern}::text) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
              AND NOT (products.url = ANY(${params.rejectedUrls}::text[]))
          ) raw_scored
        ) filtered_items
        WHERE
          (CASE WHEN ${params.style}::text IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
            ELSE (style_role != 'base' OR style_rank <= 6) END)
          AND 
          (is_color_match IS NOT TRUE OR accent_rank <= 3)
          AND 
          (is_pattern_limited_item IS NOT TRUE OR lower(${params.pattern}::text) = 'solid' OR pattern_rank <= 3)
      ) results
      ORDER BY 
        relevance_score DESC, 
        color_rank ASC,        
        (distance + (RANDOM() * ${params.noiseFactor}::float)) ASC
      LIMIT ${params.finalCandidateLimit}::int
    ) results`;
}

// eslint-disable-next-line max-lines-per-function
async function queryCapsuleWardrobePreferredItems(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  return sql<CapsuleWardrobeSqlRow>`
    SELECT results.*
    FROM unnest(${params.categories}::text[]) AS cats(target_category)
    CROSS JOIN LATERAL (
      WITH wardrobe_deduped AS (
        SELECT *
        FROM (
          SELECT
            wardrobe.*,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(wardrobe.product_id, 'wardrobe:' || wardrobe.id::text)
              ORDER BY wardrobe.updated_at DESC NULLS LAST, wardrobe.id DESC
            ) AS wardrobe_duplicate_rank
          FROM wardrobe
          WHERE wardrobe.profile_email = ${params.profileEmail}::text
            AND wardrobe.processing_status = 'ready'
            AND NULLIF(trim(COALESCE(wardrobe.url, '')), '') IS NOT NULL
        ) ranked_wardrobe
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
        WHERE products.category = cats.target_category
          AND NOT EXISTS (
            SELECT 1
            FROM wardrobe_catalog_product_ids owned
            WHERE owned.product_id = products.id::text
          )

        UNION ALL

        SELECT
          ('W' || wardrobe_deduped.id::text) AS id,
          'wardrobe'::text AS item_source,
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
        WHERE wardrobe_deduped.category = cats.target_category
      ),
      raw_scored AS (
        SELECT
          candidate_items.*,
          embedding <=> ${params.embeddingVector}::vector as distance,
          CASE WHEN ${params.style}::text IS NOT NULL AND lower(${params.style}::text) != 'minimalistic' AND ${params.style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'accent'
            WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'base'
            ELSE 'other' END as style_role,
          (${params.color}::text IS NOT NULL AND ${params.color}::text != '' AND ${params.color}::text = ANY(COALESCE(color_base, ARRAY[]::text[]))) as is_color_match,
          (CASE WHEN lower(${params.pattern}::text) = 'solid' THEN FALSE
            WHEN ${params.pattern}::text IS NOT NULL AND ${params.pattern}::text != '' THEN lower(COALESCE(pattern, '')) = lower(${params.pattern}::text)
            ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
          (
            CASE WHEN ${params.formalityLevel}::text IS NOT NULL AND ${params.formalityLevel}::text = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
            +
            CASE
              WHEN ${params.style}::text IS NOT NULL AND ${params.style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
              WHEN ${params.style}::text IS NOT NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 15
              WHEN ${params.style}::text IS NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
              ELSE 0
            END
            +
            CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && ${params.occasions}::text[] THEN 20 ELSE 0 END
            +
            CASE WHEN COALESCE(season, ARRAY[]::text[]) && ${params.season}::text[] THEN 50
              WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
              ELSE 0 END
            +
            CASE WHEN ${params.color}::text IS NOT NULL AND ${params.color}::text != '' AND ${params.color}::text = ANY(COALESCE(color_base, ARRAY[]::text[])) THEN 20 ELSE 0 END
            +
            CASE WHEN ${params.pattern}::text IS NOT NULL AND ${params.pattern}::text != '' AND lower(COALESCE(pattern, '')) = lower(${params.pattern}::text) THEN 20 ELSE 0 END
            +
            CASE WHEN item_source = 'wardrobe' THEN ${params.wardrobeBoost}::int ELSE 0 END
          ) as relevance_score
        FROM candidate_items
        WHERE
          lower(COALESCE(audience, '')) = ANY(${params.audienceFilters}::text[])
          AND (CASE WHEN ${params.color}::text IS NOT NULL AND ${params.color}::text != '' THEN ${params.color}::text = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
            ELSE COALESCE(is_neutral, false) END)
          AND (CASE WHEN lower(${params.pattern}::text) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
            ELSE lower(COALESCE(pattern, '')) = lower(${params.pattern}::text) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
          AND NOT (url = ANY(${params.rejectedUrls}::text[]))
      ),
      ranked AS (
        SELECT
          raw_scored.*,
          ROW_NUMBER() OVER (
            PARTITION BY style_role
            ORDER BY relevance_score DESC, distance ASC
          ) as style_rank,
          ROW_NUMBER() OVER (
            PARTITION BY is_color_match
            ORDER BY relevance_score DESC, distance ASC
          ) as accent_rank,
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
          (CASE WHEN ${params.style}::text IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
            ELSE (style_role != 'base' OR style_rank <= 6) END)
          AND (is_color_match IS NOT TRUE OR accent_rank <= 3)
          AND (is_pattern_limited_item IS NOT TRUE OR lower(${params.pattern}::text) = 'solid' OR pattern_rank <= 3)
      ),
      source_ranked AS (
        SELECT
          filtered_items.*,
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
          (item_source = 'catalog' AND source_rank <= ${params.catalogPoolLimit}::int)
          OR
          (item_source = 'wardrobe' AND source_rank <= ${params.wardrobePoolLimit}::int)
      ),
      color_ranked AS (
        SELECT
          source_limited.*,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(color_base, ARRAY[]::text[])
            ORDER BY relevance_score DESC, (distance + (RANDOM() * ${params.noiseFactor}::float)) ASC
          ) AS color_rank
        FROM source_limited
      )
      SELECT *
      FROM color_ranked
      ORDER BY
        relevance_score DESC,
        CASE WHEN item_source = 'wardrobe' THEN 0 ELSE 1 END,
        color_rank ASC,
        (distance + (RANDOM() * ${params.noiseFactor}::float)) ASC
      LIMIT ${params.finalCandidateLimit}::int
    ) results`;
}

async function queryCapsuleWardrobeItems(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  if (params.sourceMode === "wardrobe_preferred") {
    return queryCapsuleWardrobePreferredItems(sql, params);
  }

  return queryCatalogOnlyCapsuleWardrobeItems(sql, params);
}

function queryCapsuleWardrobeItemsForProfile(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  if (params.color === MULTIPLE_ACCENT_COLORS) {
    return queryCapsuleWardrobeItemsForMultipleAccentColors(sql, params);
  }

  return queryCapsuleWardrobeItems(sql, params);
}

export {
  buildCapsuleWardrobeSqlParams,
  queryCapsuleWardrobeItems,
  queryCapsuleWardrobePreferredItems,
  queryCapsuleWardrobeItemsForMultipleAccentColors,
  queryCapsuleWardrobeItemsForProfile,
};
export type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
} from "./aiSqlTypes.js";
