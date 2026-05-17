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
  season: string[];
  style: string | null;
};

const REGENERATE_SELECTED_CANDIDATES_SQL_FILE = new URL(
  "./sql/regenerate_selected_candidates.sql",
  import.meta.url,
);

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

function queryRegenerationCandidateItems(
  sql: RegenerateSelectedSqlClient,
  params: RegenerateSelectedSqlParams,
) {
  return executeSqlFile<SqlWardrobeRow>(
    sql,
    REGENERATE_SELECTED_CANDIDATES_SQL_FILE,
    buildRegenerateSelectedSqlValues(params),
  );
}

export { queryRegenerationCandidateItems };
export type { RegenerateSelectedSqlClient };
