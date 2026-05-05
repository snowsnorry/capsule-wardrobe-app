import type {
  CountByKey,
  UserProfileLike,
  WardrobeUiItemLike
} from "./types.js";

const MULTIPLE_ACCENT_COLORS = "multiple_accent_colors";

type CapsuleWardrobeSqlRow = WardrobeUiItemLike & {
  embedding?: unknown;
};

type CapsuleWardrobeSqlClient = {
  <TRow = unknown>(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<TRow[] | { count: number }>;
};

type CapsuleWardrobeSqlParams = {
  categories: string[];
  formalityLevel: string | null;
  style: string | null;
  occasions: string[];
  season: string[];
  audienceFilters: string[];
  color: string | null;
  pattern: string;
  rejectedUrls: string[];
  embeddingVector: string;
  noiseFactor: number;
};

function normalizePatternValue(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function buildCapsuleWardrobeSqlParams(
  userProfile: UserProfileLike | null = null,
  promptEmbeddings: number[] = [],
  capsuleCategories: CountByKey
): CapsuleWardrobeSqlParams {
  const audienceByProfile = {
    man: ["man", "all"],
    woman: ["woman", "all"],
    any: ["man", "woman", "all"]
  };
  const additionalText = typeof userProfile?.text === "string" ? userProfile.text.trim() : "";

  return {
    categories: Object.keys(capsuleCategories),
    formalityLevel: userProfile?.formalityLevel ?? null,
    style: userProfile?.style ?? null,
    occasions: Array.isArray(userProfile?.occasions) ? userProfile.occasions : [],
    season: Array.isArray(userProfile?.season) ? userProfile.season : [],
    audienceFilters: audienceByProfile[userProfile?.audience] || audienceByProfile.any,
    color: userProfile?.color ?? null,
    pattern: normalizePatternValue(userProfile?.pattern) || "solid",
    rejectedUrls: Array.isArray(userProfile?.rejected)
      ? userProfile.rejected.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
      : [],
    embeddingVector: `[${promptEmbeddings.join(",")}]`,
    // There should be no random noise when the user makes a specific request.
    noiseFactor: additionalText ? 0 : 0.05
  };
}

async function queryCapsuleWardrobeItems(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams
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
    noiseFactor
  } = params;

  return sql<CapsuleWardrobeSqlRow>`
    SELECT results.*
    FROM unnest(${categories}::text[]) AS cats(target_category)
    CROSS JOIN LATERAL (
      SELECT * FROM (
        SELECT 
          filtered_items.*,
          -- 4. Calculate Color Rank (FINAL VISUAL SORTING)
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(color_base, ARRAY[]::text[])
            ORDER BY 
              relevance_score DESC, 
              (distance + (RANDOM() * ${noiseFactor}::float)) ASC
          ) as color_rank
        FROM (
          SELECT 
            raw_scored.*,
            -- 3. INDEPENDENT QUOTA RANKING
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
              -- 1. Calculate Vector Distance
              embedding <=> ${embeddingVector}::vector as distance,
              
              -- 1.1 Identify Style Role (Accent, Base, Other)
              CASE
                WHEN ${style}::text IS NOT NULL 
                     AND lower(${style}::text) != 'minimalistic'
                     AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[]))
                THEN 'accent'
                WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[]))
                THEN 'base'
                ELSE 'other'
              END as style_role,

              -- Identify Color & Pattern Matches
              (
                ${color}::text IS NOT NULL
                AND ${color}::text != ''
                AND ${color}::text = ANY(color_base)
              ) as is_color_match,
              (
                CASE
                  WHEN lower(${pattern}::text) = 'solid'
                  THEN FALSE
                  WHEN ${pattern}::text IS NOT NULL AND ${pattern}::text != ''
                  THEN lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                  ELSE pattern IS NOT NULL
                    AND trim(pattern) != ''
                    AND lower(pattern) != 'solid'
                END
              ) as is_pattern_limited_item,
              
              -- 2. Calculate Relevance Score
              (
                -- Formality Match (+20)
                CASE WHEN ${formalityLevel}::text IS NOT NULL
                  AND ${formalityLevel}::text = ANY(COALESCE(formality_level, ARRAY[]::text[]))
                THEN 20 ELSE 0 END
                +
                -- Style Match (+20, fallback +15 for base)
                CASE 
                  WHEN ${style}::text IS NOT NULL AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
                  WHEN ${style}::text IS NOT NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 15
                  WHEN ${style}::text IS NULL AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20
                  ELSE 0 
                END
                +
                -- Occasion Match (+20)
                CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && ${occasions}::text[]
                THEN 20 ELSE 0 END
                +
                -- Season Match (+50 or +40 fallback)
                CASE WHEN COALESCE(season, ARRAY[]::text[]) && ${season}::text[] THEN 50
                WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40
                ELSE 0 END
                +
                -- COLOR BOOST (+20)
                -- We keep the boost to ensure the allowed color items are the "best" ones.
                CASE 
                  WHEN ${color}::text IS NOT NULL AND ${color}::text != ''
                      AND ${color}::text = ANY(color_base)
                  THEN 20 ELSE 0 
                END
                +
                -- PATTERN BOOST (+20)
                CASE
                  WHEN ${pattern}::text IS NOT NULL AND ${pattern}::text != ''
                      AND lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                  THEN 20 ELSE 0
                END
              ) as relevance_score

            FROM products
            WHERE 
              -- HARD FILTERS
              category = cats.target_category
              AND lower(COALESCE(audience, '')) = ANY(${audienceFilters}::text[])
              AND (
                CASE
                  WHEN ${color}::text IS NOT NULL AND ${color}::text != ''
                  THEN ${color}::text = ANY(COALESCE(color_base, ARRAY[]::text[]))
                    OR COALESCE(is_neutral, false)
                  ELSE COALESCE(is_neutral, false)
                END
              )
              AND (
                CASE
                  WHEN lower(${pattern}::text) = 'solid'
                  THEN pattern IS NULL
                    OR trim(pattern) = ''
                    OR lower(pattern) = 'solid'
                  ELSE lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                    OR pattern IS NULL
                    OR trim(pattern) = ''
                    OR lower(pattern) = 'solid'
                END
              )
              AND NOT (products.url = ANY(${rejectedUrls}::text[]))
          ) raw_scored
        ) filtered_items
        WHERE
          -- !!! INDEPENDENT QUOTA LIMITS !!!
          -- Rule 1: Style Logic (Accent max 3, or Base max 6 if no style is requested)
          (
            CASE 
              WHEN ${style}::text IS NOT NULL THEN 
                (style_role != 'accent' OR style_rank <= 3)
              ELSE 
                (style_role != 'base' OR style_rank <= 6)
            END
          )
          AND 
          -- Rule 2: If it's an accent item, it must be in the top 3 of accents.
          (is_color_match IS NOT TRUE OR accent_rank <= 3)
          AND 
          -- Rule 3: If it's a patterned item, it must be in the top 3 of patterns. (WITH BYPASS FOR 'SOLID')
          (
            is_pattern_limited_item IS NOT TRUE 
            OR lower(${pattern}::text) = 'solid'
            OR pattern_rank <= 3
          )
      ) results
      
      -- 5. FINAL SORTING STRATEGY
      ORDER BY 
        relevance_score DESC, 
        color_rank ASC,        
        (distance + (RANDOM() * ${noiseFactor}::float)) ASC
      LIMIT 10
    ) results`;
}

async function queryCapsuleWardrobeItemsForMultipleAccentColors(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams
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
    noiseFactor
  } = params;

  return sql<CapsuleWardrobeSqlRow>`
    SELECT results.*
    FROM unnest(${categories}::text[]) AS cats(target_category)
    CROSS JOIN LATERAL (
      SELECT * FROM (
        SELECT 
          filtered_items.*,

          -- 4. Calculate Color Rank (FINAL VISUAL SORTING)
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(color_base, ARRAY[]::text[])
            ORDER BY 
              relevance_score DESC, 
              (distance + (RANDOM() * ${noiseFactor}::float)) ASC
          ) as color_rank

        FROM (
          SELECT 
            raw_scored.*,

            -- 3. INDEPENDENT QUOTA RANKING

            -- Multiple accent mode:
            -- non-neutral colored items are capped at 4 per category.
            -- Therefore the final LIMIT 10 can contain at least 6 neutral items,
            -- assuming enough neutral candidates survive the other filters.
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(is_neutral, false)
              ORDER BY relevance_score DESC, distance ASC
            ) as neutrality_rank,

            ROW_NUMBER() OVER (
              PARTITION BY style_role
              ORDER BY relevance_score DESC, distance ASC
            ) as style_rank,

            ROW_NUMBER() OVER (
              PARTITION BY is_pattern_limited_item
              ORDER BY relevance_score DESC, distance ASC
            ) as pattern_rank

          FROM (
            SELECT
              products.*,

              -- 1. Calculate Vector Distance
              embedding <=> ${embeddingVector}::vector as distance,

              -- 1.1 Identify Style Role (Accent, Base, Other)
              CASE
                WHEN ${style}::text IS NOT NULL 
                    AND lower(${style}::text) != 'minimalistic'
                    AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[]))
                THEN 'accent'

                WHEN 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[]))
                THEN 'base'

                ELSE 'other'
              END as style_role,

              -- Multiple accent mode:
              -- true for any classified non-neutral colored item.
              -- Includes color_base = ARRAY['multicolor'] if multicolor is stored there.
              (
                COALESCE(is_neutral, false) IS NOT TRUE
                AND cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0
              ) as is_non_neutral_color,

              -- Identify Pattern Matches
              (
                CASE
                  WHEN lower(${pattern}::text) = 'solid'
                  THEN FALSE

                  WHEN ${pattern}::text IS NOT NULL AND ${pattern}::text != ''
                  THEN lower(COALESCE(pattern, '')) = lower(${pattern}::text)

                  ELSE pattern IS NOT NULL
                    AND trim(pattern) != ''
                    AND lower(pattern) != 'solid'
                END
              ) as is_pattern_limited_item,

              -- 2. Calculate Relevance Score
              (
                -- Formality Match (+20)
                CASE
                  WHEN ${formalityLevel}::text IS NOT NULL
                      AND ${formalityLevel}::text = ANY(COALESCE(formality_level, ARRAY[]::text[]))
                  THEN 20 ELSE 0
                END
                +
                -- Style Match (+20, fallback +15 for base)
                CASE 
                  WHEN ${style}::text IS NOT NULL
                      AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[]))
                  THEN 20

                  WHEN ${style}::text IS NOT NULL
                      AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[]))
                  THEN 15

                  WHEN ${style}::text IS NULL
                      AND 'minimalistic' = ANY(COALESCE(style, ARRAY[]::text[]))
                  THEN 20

                  ELSE 0 
                END
                +
                -- Occasion Match (+20)
                CASE
                  WHEN COALESCE(occasions, ARRAY[]::text[]) && ${occasions}::text[]
                  THEN 20 ELSE 0
                END
                +
                -- Season Match (+50 or +40 fallback)
                CASE
                  WHEN COALESCE(season, ARRAY[]::text[]) && ${season}::text[]
                  THEN 50

                  WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0
                  THEN 40

                  ELSE 0
                END
                +
                -- COLOR BOOST (+20)
                -- In multiple accent mode, boost non-neutral classified colored items,
                -- including multicolor items.
                CASE
                  WHEN COALESCE(is_neutral, false) IS NOT TRUE
                      AND cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0
                  THEN 20 ELSE 0
                END
                +
                -- PATTERN BOOST (+20)
                CASE
                  WHEN ${pattern}::text IS NOT NULL
                      AND ${pattern}::text != ''
                      AND lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                  THEN 20 ELSE 0
                END
              ) as relevance_score

            FROM products
            WHERE 
              -- HARD FILTERS
              category = cats.target_category

              AND lower(COALESCE(audience, '')) = ANY(${audienceFilters}::text[])

              -- Multiple accent mode:
              -- allow neutral items plus any classified non-neutral colored item.
              -- This includes color_base = ARRAY['multicolor'].
              AND (
                COALESCE(is_neutral, false)
                OR cardinality(COALESCE(color_base, ARRAY[]::text[])) > 0
              )

              AND (
                CASE
                  WHEN lower(${pattern}::text) = 'solid'
                  THEN pattern IS NULL
                    OR trim(pattern) = ''
                    OR lower(pattern) = 'solid'

                  ELSE lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                    OR pattern IS NULL
                    OR trim(pattern) = ''
                    OR lower(pattern) = 'solid'
                END
              )

              AND NOT (products.url = ANY(${rejectedUrls}::text[]))

          ) raw_scored

        ) filtered_items

        WHERE
          -- !!! INDEPENDENT QUOTA LIMITS !!!

          -- Rule 1: Style Logic
          -- Accent max 3, or Base max 6 if no style is requested.
          (
            CASE 
              WHEN ${style}::text IS NOT NULL THEN 
                (style_role != 'accent' OR style_rank <= 3)

              ELSE 
                (style_role != 'base' OR style_rank <= 6)
            END
          )

          AND 

          -- Rule 2: Color Logic for multiple accent mode
          -- Keep all neutral items.
          -- Keep only top 4 non-neutral colored items per category.
          (
            COALESCE(is_neutral, false) IS TRUE
            OR (
              is_non_neutral_color IS TRUE
              AND neutrality_rank <= 4
            )
          )

          AND 

          -- Rule 3: Pattern Logic
          -- If it's a patterned item, it must be in the top 3 of patterns.
          -- Bypass for 'solid'.
          (
            is_pattern_limited_item IS NOT TRUE 
            OR lower(${pattern}::text) = 'solid'
            OR pattern_rank <= 3
          )

      ) results

      -- 5. FINAL SORTING STRATEGY
      ORDER BY 
        relevance_score DESC, 
        color_rank ASC,        
        (distance + (RANDOM() * ${noiseFactor}::float)) ASC

      LIMIT 10
    ) results`;
}

function queryCapsuleWardrobeItemsForProfile(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams
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
  queryCapsuleWardrobeItemsForProfile
};
export type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
  CapsuleWardrobeSqlRow
};
