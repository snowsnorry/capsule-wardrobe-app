import type { CountByKey, UserProfileLike } from "./types.js";
import { queryCapsuleWardrobeItemsForMultipleAccentColors } from "./aiSqlMultipleAccent.js";
import type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
  CapsuleWardrobeSqlRow,
} from "./aiSqlTypes.js";

const MULTIPLE_ACCENT_COLORS = "multiple_accent_colors";

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
    ...getProfileSqlFilters(userProfile),
    embeddingVector: `[${promptEmbeddings.join(",")}]`,
  };
}

async function queryCapsuleWardrobeItems(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  const {
    categories,
    formalityLevel,
    style,
    occasions,
    season,
    audienceFilters,
    color,
    pattern,
    rejectedUrls,
    embeddingVector,
    noiseFactor,
  } = params;

  return sql<CapsuleWardrobeSqlRow>`
    SELECT results.*
    FROM unnest(${categories}::text[]) AS cats(target_category)
    CROSS JOIN LATERAL (
      SELECT * FROM (
        SELECT 
          filtered_items.*,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(color_base, ARRAY[]::text[])
            ORDER BY relevance_score DESC, (distance + (RANDOM() * ${noiseFactor}::float)) ASC
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
              products.*,
              embedding <=> ${embeddingVector}::vector as distance,
              CASE WHEN ${style}::text IS NOT NULL AND lower(${style}::text) != 'minimalistic' AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'accent'
                WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 'base'
                ELSE 'other' END as style_role,
              (${color}::text IS NOT NULL AND ${color}::text != '' AND ${color}::text = ANY(color_base)) as is_color_match,
              (CASE WHEN lower(${pattern}::text) = 'solid' THEN FALSE
                WHEN ${pattern}::text IS NOT NULL AND ${pattern}::text != '' THEN lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
              (
                CASE WHEN ${formalityLevel}::text IS NOT NULL AND ${formalityLevel}::text = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
                +
                CASE 
                  WHEN ${style}::text IS NOT NULL AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
                  WHEN ${style}::text IS NOT NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 15
                  WHEN ${style}::text IS NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
                  ELSE 0 
                END
                +
                CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && ${occasions}::text[] THEN 20 ELSE 0 END
                +
                CASE WHEN COALESCE(season, ARRAY[]::text[]) && ${season}::text[] THEN 50
                  WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
                  ELSE 0 END
                +
                CASE WHEN ${color}::text IS NOT NULL AND ${color}::text != '' AND ${color}::text = ANY(color_base) THEN 20 ELSE 0 END
                +
                CASE WHEN ${pattern}::text IS NOT NULL AND ${pattern}::text != '' AND lower(COALESCE(pattern, '')) = lower(${pattern}::text) THEN 20 ELSE 0 END
              ) as relevance_score

            FROM products
            WHERE 
              category = cats.target_category
              AND lower(COALESCE(audience, '')) = ANY(${audienceFilters}::text[])
              AND (CASE WHEN ${color}::text IS NOT NULL AND ${color}::text != '' THEN ${color}::text = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
                ELSE COALESCE(is_neutral, false) END)
              AND (CASE WHEN lower(${pattern}::text) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
                ELSE lower(COALESCE(pattern, '')) = lower(${pattern}::text) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
              AND NOT (products.url = ANY(${rejectedUrls}::text[]))
          ) raw_scored
        ) filtered_items
        WHERE
          (CASE WHEN ${style}::text IS NOT NULL THEN (style_role != 'accent' OR style_rank <= 3)
            ELSE (style_role != 'base' OR style_rank <= 6) END)
          AND 
          (is_color_match IS NOT TRUE OR accent_rank <= 3)
          AND 
          (is_pattern_limited_item IS NOT TRUE OR lower(${pattern}::text) = 'solid' OR pattern_rank <= 3)
      ) results
      ORDER BY 
        relevance_score DESC, 
        color_rank ASC,        
        (distance + (RANDOM() * ${noiseFactor}::float)) ASC
      LIMIT 10
    ) results`;
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
  queryCapsuleWardrobeItemsForMultipleAccentColors,
  queryCapsuleWardrobeItemsForProfile,
};
export type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
  CapsuleWardrobeSqlRow,
} from "./aiSqlTypes.js";
