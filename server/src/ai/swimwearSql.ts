import { getSqlClient } from "../db.js";
import { countItemsByKey, logWardrobeInfo } from "./swimwearLogging.js";
import type { SwimwearCandidate } from "./types.js";
import { sanitizeProductRow } from "./swimwearUtils.js";

type SwimwearSqlLogContext = { capsuleRequestId?: string | null } | null;

export async function selectMaleSwimwear({
  sql,
  targetStyle,
  topColors,
  embeddingVector,
  logContext = null,
}: {
  sql: ReturnType<typeof getSqlClient>;
  targetStyle: string | null;
  topColors: string[];
  embeddingVector: string;
  logContext?: SwimwearSqlLogContext;
}): Promise<SwimwearCandidate[]> {
  const sqlStartedAt = Date.now();
  const rows = await sql`
    SELECT
      *,
      (embedding <=> ${embeddingVector}::vector) AS distance
    FROM products
    WHERE
      category = 'swimwear'
      AND lower(COALESCE(audience, '')) = 'man'
    ORDER BY
      (
        CASE WHEN color_base && ${topColors}::text[] THEN 2 ELSE 0 END
        +
        CASE
          WHEN ${targetStyle}::text IS NOT NULL
            AND ${targetStyle}::text = ANY(COALESCE(style, ARRAY[]::text[]))
          THEN 1 ELSE 0
        END
      ) DESC,
      (embedding <=> ${embeddingVector}::vector) ASC
    LIMIT 1
  `;
  const candidates = (Array.isArray(rows) ? rows : [])
    .map(sanitizeProductRow)
    .filter(Boolean);

  logWardrobeInfo(
    "swimwear-sql-completed",
    {
      swimwearSqlDurationMs: Date.now() - sqlStartedAt,
      swimwearCandidatesTotal: candidates.length,
      swimwearCandidatesByType: countItemsByKey(candidates, "category"),
    },
    logContext,
  );

  return candidates;
}

export async function selectFemaleSwimwear({
  sql,
  audience,
  targetStyle,
  bottomColors,
  embeddingVector,
  logContext = null,
}: {
  sql: ReturnType<typeof getSqlClient>;
  audience: string;
  targetStyle: string | null;
  bottomColors: string[];
  embeddingVector: string;
  logContext?: SwimwearSqlLogContext;
}): Promise<SwimwearCandidate[]> {
  const sqlStartedAt = Date.now();
  const rows = await sql`
    SELECT
      products.*,
      CASE
        WHEN name ILIKE '%swimsuit%' THEN 'swimsuit'
        WHEN name ILIKE '%tankini%' OR name ILIKE '%bikini top%' THEN 'swimwear_top'
        WHEN name ~* '(bikini bottoms|bikini bottom|bikini briefs|hipsters|tanga|thong)' THEN 'swimwear_bottom'
        ELSE 'swimsuit'
      END AS swimwear_type,
      (embedding <=> ${embeddingVector}::vector) AS distance
    FROM products
    WHERE
      category = 'swimwear'
      AND lower(COALESCE(audience, '')) = lower(${audience}::text)
    ORDER BY
      (
        CASE WHEN color_base && ${bottomColors}::text[] THEN 2 ELSE 0 END
        +
        CASE
          WHEN ${targetStyle}::text IS NOT NULL
            AND ${targetStyle}::text = ANY(COALESCE(style, ARRAY[]::text[]))
          THEN 1 ELSE 0
        END
      ) DESC,
      (embedding <=> ${embeddingVector}::vector) ASC
    LIMIT 12
  `;
  const candidates = (Array.isArray(rows) ? rows : [])
    .map(sanitizeProductRow)
    .filter(Boolean);

  logWardrobeInfo(
    "swimwear-sql-completed",
    {
      swimwearSqlDurationMs: Date.now() - sqlStartedAt,
      swimwearCandidatesTotal: candidates.length,
      swimwearCandidatesByType: countItemsByKey(candidates, "swimwear_type"),
    },
    logContext,
  );

  return candidates;
}
