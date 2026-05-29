import { executeSqlFile } from "../db/sqlFiles.js";
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
  profileEmail?: string | null;
  season: string[];
  sourceMode?: RegenerateSelectedSourceMode | null;
  style: string | null;
};

type RegenerateSelectedSourceMode =
  | "catalog_only"
  | "wardrobe_preferred"
  | "wardrobe_only";

const WARDROBE_RELEVANCE_BOOST = 25;
const CATALOG_POOL_LIMIT = 10;
const WARDROBE_POOL_LIMIT = 5;

const REGENERATE_SELECTED_CANDIDATES_SQL_FILE = new URL(
  "./sql/regenerate_selected_candidates.sql",
  import.meta.url,
);
const REGENERATE_SELECTED_WARDROBE_ONLY_SQL_FILE = new URL(
  "./sql/regenerate_selected_wardrobe_only.sql",
  import.meta.url,
);
const REGENERATE_SELECTED_WARDROBE_PREFERRED_SQL_FILE = new URL(
  "./sql/regenerate_selected_wardrobe_preferred.sql",
  import.meta.url,
);

function normalizeSourceMode(
  value: RegenerateSelectedSqlParams["sourceMode"],
): RegenerateSelectedSourceMode {
  if (value === "wardrobe_preferred" || value === "wardrobe_only") {
    return value;
  }

  return "catalog_only";
}

function normalizeProfileEmail(
  value: RegenerateSelectedSqlParams["profileEmail"],
) {
  return typeof value === "string" ? value.trim() : "";
}

function buildRegenerateSelectedSqlValues({
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
}: RegenerateSelectedSqlParams): readonly unknown[] {
  return [
    categories,
    noiseFactor,
    embeddingVector,
    style,
    color,
    pattern,
    formalityLevel,
    occasions,
    season,
    audienceFilters,
    excludedUrls,
  ];
}

function buildRegenerateSelectedWardrobeOnlySqlValues(
  params: RegenerateSelectedSqlParams,
): readonly unknown[] {
  return [
    ...buildRegenerateSelectedSqlValues(params),
    normalizeProfileEmail(params.profileEmail),
  ];
}

function buildRegenerateSelectedWardrobePreferredSqlValues(
  params: RegenerateSelectedSqlParams,
): readonly unknown[] {
  return [
    ...buildRegenerateSelectedSqlValues(params),
    normalizeProfileEmail(params.profileEmail),
    WARDROBE_RELEVANCE_BOOST,
    CATALOG_POOL_LIMIT,
    WARDROBE_POOL_LIMIT,
  ];
}

function queryRegenerationCandidateItems(
  sql: RegenerateSelectedSqlClient,
  params: RegenerateSelectedSqlParams,
) {
  const sourceMode = normalizeSourceMode(params.sourceMode);

  if (sourceMode === "wardrobe_only") {
    return executeSqlFile<SqlWardrobeRow>(
      sql,
      REGENERATE_SELECTED_WARDROBE_ONLY_SQL_FILE,
      buildRegenerateSelectedWardrobeOnlySqlValues(params),
    );
  }

  if (sourceMode === "wardrobe_preferred") {
    return executeSqlFile<SqlWardrobeRow>(
      sql,
      REGENERATE_SELECTED_WARDROBE_PREFERRED_SQL_FILE,
      buildRegenerateSelectedWardrobePreferredSqlValues(params),
    );
  }

  return executeSqlFile<SqlWardrobeRow>(
    sql,
    REGENERATE_SELECTED_CANDIDATES_SQL_FILE,
    buildRegenerateSelectedSqlValues(params),
  );
}

export { queryRegenerationCandidateItems };
export type { RegenerateSelectedSqlClient, RegenerateSelectedSqlParams };
