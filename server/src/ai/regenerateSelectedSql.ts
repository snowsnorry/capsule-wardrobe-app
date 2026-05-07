import type { SqlWardrobeRow } from "./regenerateSelectedPrompt.js";

type RegenerateSelectedSqlClient = {
  <TRow = unknown>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<TRow[] | { count: number }>;
};

type RegenerateSelectedSqlParams = {
  audienceFilters: string[];
  categories: string[];
  color: string | null;
  embeddingVector: string;
  excludedUrls: string[];
  formalityLevel: string | null;
  noiseFactor: number;
  occasions: string[];
  pattern: string;
  season: string[];
  style: string | null;
};

function queryRegenerationCandidateItems(
  sql: RegenerateSelectedSqlClient,
  {
    audienceFilters,
    categories,
    color,
    embeddingVector,
    excludedUrls,
    formalityLevel,
    noiseFactor,
    occasions,
    pattern,
    season,
    style,
  }: RegenerateSelectedSqlParams,
) {
  return sql<SqlWardrobeRow>`
    SELECT results.*
    FROM unnest(${categories}::text[]) AS cats(target_category)
    CROSS JOIN LATERAL (
      SELECT * FROM (
        SELECT filtered_items.*,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(color_base, ARRAY[]::text[])
            ORDER BY relevance_score DESC, (distance + (RANDOM() * ${noiseFactor}::float)) ASC
          ) as color_rank
        FROM (
          SELECT raw_scored.*,
            ROW_NUMBER() OVER (PARTITION BY is_style_match ORDER BY relevance_score DESC, distance ASC) as aesthetic_rank,
            ROW_NUMBER() OVER (PARTITION BY is_color_match ORDER BY relevance_score DESC, distance ASC) as accent_rank,
            ROW_NUMBER() OVER (PARTITION BY is_pattern_limited_item ORDER BY relevance_score DESC, distance ASC) as pattern_rank
          FROM (
            SELECT products.*, embedding <=> ${embeddingVector}::vector as distance,
              (${style}::text IS NOT NULL AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[]))) as is_style_match,
              (${color}::text IS NOT NULL AND ${color}::text != '' AND ${color}::text = ANY(color_base)) as is_color_match,
              (CASE WHEN lower(${pattern}::text) = 'solid' THEN FALSE
                WHEN ${pattern}::text IS NOT NULL AND ${pattern}::text != '' THEN lower(COALESCE(pattern, '')) = lower(${pattern}::text)
                ELSE pattern IS NOT NULL AND trim(pattern) != '' AND lower(pattern) != 'solid' END) as is_pattern_limited_item,
              (
                CASE WHEN ${formalityLevel}::text IS NOT NULL AND ${formalityLevel}::text = ANY(COALESCE(formality_level, ARRAY[]::text[])) THEN 20 ELSE 0 END
                + CASE WHEN ${style}::text IS NOT NULL AND ${style}::text = ANY(COALESCE(style, ARRAY[]::text[])) THEN 20 ELSE 0 END
                + CASE WHEN COALESCE(occasions, ARRAY[]::text[]) && ${occasions}::text[] THEN 20 ELSE 0 END
                + CASE WHEN COALESCE(season, ARRAY[]::text[]) && ${season}::text[] THEN 50
                  WHEN cardinality(COALESCE(season, ARRAY[]::text[])) = 0 THEN 40 ELSE 0 END
                + CASE WHEN ${color}::text IS NOT NULL AND ${color}::text != '' AND ${color}::text = ANY(color_base) THEN 20 ELSE 0 END
                + CASE WHEN ${pattern}::text IS NOT NULL AND ${pattern}::text != '' AND lower(COALESCE(pattern, '')) = lower(${pattern}::text) THEN 20 ELSE 0 END
              ) as relevance_score
            FROM products
            WHERE category = cats.target_category
              AND lower(COALESCE(audience, '')) = ANY(${audienceFilters}::text[])
              AND (CASE WHEN ${color}::text IS NOT NULL AND ${color}::text != '' THEN ${color}::text = ANY(COALESCE(color_base, ARRAY[]::text[])) OR COALESCE(is_neutral, false)
                ELSE COALESCE(is_neutral, false) END)
              AND (CASE WHEN lower(${pattern}::text) = 'solid' THEN pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid'
                ELSE lower(COALESCE(pattern, '')) = lower(${pattern}::text) OR pattern IS NULL OR trim(pattern) = '' OR lower(pattern) = 'solid' END)
              AND NOT (products.url = ANY(${excludedUrls}::text[]))
          ) raw_scored
        ) filtered_items
        WHERE (is_style_match IS NOT TRUE OR aesthetic_rank <= 3)
          AND (is_color_match IS NOT TRUE OR accent_rank <= 3)
          AND (is_pattern_limited_item IS NOT TRUE OR lower(${pattern}::text) = 'solid' OR pattern_rank <= 3)
      ) results
      ORDER BY relevance_score DESC, color_rank ASC, (distance + (RANDOM() * ${noiseFactor}::float)) ASC
      LIMIT 10
    ) results`;
}

export { queryRegenerationCandidateItems };
export type { RegenerateSelectedSqlClient, RegenerateSelectedSqlParams };
