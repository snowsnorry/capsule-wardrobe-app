import { getSqlClient } from "../db.js";
import { executeSqlFile } from "../db/sqlFiles.js";
import { countItemsByKey, logWardrobeInfo } from "./swimwearLogging.js";
import type { SwimwearCandidate, UserProfileLike } from "./types.js";
import { sanitizeProductRow } from "./swimwearUtils.js";

type SwimwearSqlLogContext = { capsuleRequestId?: string | null } | null;
type SwimwearSourceMode = NonNullable<UserProfileLike["sourceMode"]>;

const SWIMWEAR_CANDIDATE_LIMIT = 12;
const SWIMWEAR_WARDROBE_BOOST = 25;
const CATALOG_SQL_FILE = new URL("./sql/swimwear_catalog.sql", import.meta.url);
const WARDROBE_ONLY_SQL_FILE = new URL(
  "./sql/swimwear_wardrobe_only.sql",
  import.meta.url,
);
const WARDROBE_PREFERRED_SQL_FILE = new URL(
  "./sql/swimwear_wardrobe_preferred.sql",
  import.meta.url,
);

function normalizeSourceMode(value: unknown): SwimwearSourceMode {
  if (value === "wardrobe_preferred" || value === "wardrobe_only") {
    return value;
  }

  return "catalog_only";
}

function normalizeProfileEmail(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCandidates(rows: unknown): SwimwearCandidate[] {
  return (Array.isArray(rows) ? rows : [])
    .map(sanitizeProductRow)
    .filter(Boolean);
}

function buildCatalogSqlValues({
  audience,
  colorValues,
  embeddingVector,
  targetStyle,
}: {
  audience: string;
  colorValues: string[];
  embeddingVector: string;
  targetStyle: string | null;
}) {
  return [
    embeddingVector,
    audience,
    colorValues,
    targetStyle,
    SWIMWEAR_CANDIDATE_LIMIT,
  ];
}

function buildWardrobeOnlySqlValues({
  audience,
  colorValues,
  embeddingVector,
  profileEmail,
  targetStyle,
}: {
  audience: string;
  colorValues: string[];
  embeddingVector: string;
  profileEmail: unknown;
  targetStyle: string | null;
}) {
  return [
    normalizeProfileEmail(profileEmail),
    embeddingVector,
    audience,
    colorValues,
    targetStyle,
    SWIMWEAR_CANDIDATE_LIMIT,
  ];
}

function buildWardrobePreferredSqlValues({
  audience,
  colorValues,
  embeddingVector,
  profileEmail,
  targetStyle,
}: {
  audience: string;
  colorValues: string[];
  embeddingVector: string;
  profileEmail: unknown;
  targetStyle: string | null;
}) {
  return [
    normalizeProfileEmail(profileEmail),
    embeddingVector,
    audience,
    colorValues,
    targetStyle,
    SWIMWEAR_WARDROBE_BOOST,
    SWIMWEAR_CANDIDATE_LIMIT,
  ];
}

async function querySourceAwareSwimwear({
  sql,
  audience,
  targetStyle,
  colorValues,
  embeddingVector,
  sourceMode,
  profileEmail,
}: {
  sql: ReturnType<typeof getSqlClient>;
  audience: string;
  targetStyle: string | null;
  colorValues: string[];
  embeddingVector: string;
  sourceMode: SwimwearSourceMode;
  profileEmail: unknown;
}) {
  if (sourceMode === "wardrobe_only") {
    return executeSqlFile<SwimwearCandidate>(
      sql,
      WARDROBE_ONLY_SQL_FILE,
      buildWardrobeOnlySqlValues({
        audience,
        colorValues,
        embeddingVector,
        profileEmail,
        targetStyle,
      }),
    );
  }

  if (sourceMode === "wardrobe_preferred") {
    return executeSqlFile<SwimwearCandidate>(
      sql,
      WARDROBE_PREFERRED_SQL_FILE,
      buildWardrobePreferredSqlValues({
        audience,
        colorValues,
        embeddingVector,
        profileEmail,
        targetStyle,
      }),
    );
  }

  return executeSqlFile<SwimwearCandidate>(
    sql,
    CATALOG_SQL_FILE,
    buildCatalogSqlValues({
      audience,
      colorValues,
      embeddingVector,
      targetStyle,
    }),
  );
}

function logSwimwearSqlResult({
  candidates,
  logContext,
  sqlStartedAt,
}: {
  candidates: SwimwearCandidate[];
  logContext?: SwimwearSqlLogContext;
  sqlStartedAt: number;
}) {
  logWardrobeInfo(
    "swimwear-sql-completed",
    {
      swimwearSqlDurationMs: Date.now() - sqlStartedAt,
      swimwearCandidatesTotal: candidates.length,
      swimwearCandidatesBySource: countItemsByKey(candidates, "item_source"),
      swimwearCandidatesByType: countItemsByKey(candidates, "swimwear_type"),
    },
    logContext,
  );
}

async function selectSwimwear({
  sql,
  audience,
  targetStyle,
  colorValues,
  embeddingVector,
  sourceMode,
  profileEmail,
  logContext = null,
}: {
  sql: ReturnType<typeof getSqlClient>;
  audience: string;
  targetStyle: string | null;
  colorValues: string[];
  embeddingVector: string;
  sourceMode?: unknown;
  profileEmail?: unknown;
  logContext?: SwimwearSqlLogContext;
}): Promise<SwimwearCandidate[]> {
  const sqlStartedAt = Date.now();
  const candidates = normalizeCandidates(
    await querySourceAwareSwimwear({
      sql,
      audience,
      targetStyle,
      colorValues,
      embeddingVector,
      sourceMode: normalizeSourceMode(sourceMode),
      profileEmail,
    }),
  );
  logSwimwearSqlResult({ candidates, logContext, sqlStartedAt });
  return candidates;
}

export async function selectMaleSwimwear({
  sql,
  targetStyle,
  topColors,
  embeddingVector,
  sourceMode = "catalog_only",
  profileEmail = "",
  logContext = null,
}: {
  sql: ReturnType<typeof getSqlClient>;
  targetStyle: string | null;
  topColors: string[];
  embeddingVector: string;
  sourceMode?: unknown;
  profileEmail?: unknown;
  logContext?: SwimwearSqlLogContext;
}): Promise<SwimwearCandidate[]> {
  return selectSwimwear({
    sql,
    audience: "man",
    targetStyle,
    colorValues: topColors,
    embeddingVector,
    sourceMode,
    profileEmail,
    logContext,
  });
}

export async function selectFemaleSwimwear({
  sql,
  audience,
  targetStyle,
  bottomColors,
  embeddingVector,
  sourceMode = "catalog_only",
  profileEmail = "",
  logContext = null,
}: {
  sql: ReturnType<typeof getSqlClient>;
  audience: string;
  targetStyle: string | null;
  bottomColors: string[];
  embeddingVector: string;
  sourceMode?: unknown;
  profileEmail?: unknown;
  logContext?: SwimwearSqlLogContext;
}): Promise<SwimwearCandidate[]> {
  return selectSwimwear({
    sql,
    audience,
    targetStyle,
    colorValues: bottomColors,
    embeddingVector,
    sourceMode,
    profileEmail,
    logContext,
  });
}
