import { executeSqlFile } from "../db/sqlFiles.js";
import type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
  CapsuleWardrobeSqlRow,
} from "./aiSqlTypes.js";

const MULTIPLE_ACCENT_CATALOG_ONLY_SQL_FILE = new URL(
  "./sql/capsule_multiple_accent_catalog_only.sql",
  import.meta.url,
);
const MULTIPLE_ACCENT_WARDROBE_PREFERRED_SQL_FILE = new URL(
  "./sql/capsule_multiple_accent_wardrobe_preferred.sql",
  import.meta.url,
);

function buildMultipleAccentCapsuleSqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    params.categories,
    params.noiseFactor,
    params.embeddingVector,
    params.style,
    params.pattern,
    params.formalityLevel,
    params.occasions,
    params.season,
    params.audienceFilters,
    params.rejectedUrls,
    params.finalCandidateLimit,
    params.profileEmail,
    params.wardrobeBoost,
    params.catalogPoolLimit,
    params.wardrobePoolLimit,
  ];
}

async function queryCapsuleWardrobeItemsForMultipleAccentColors(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  if (params.sourceMode === "wardrobe_preferred") {
    return queryCapsuleWardrobePreferredItemsForMultipleAccentColors(
      sql,
      params,
    );
  }

  return executeSqlFile<CapsuleWardrobeSqlRow>(
    sql,
    MULTIPLE_ACCENT_CATALOG_ONLY_SQL_FILE,
    buildMultipleAccentCapsuleSqlValues(params).slice(0, 11),
  );
}

async function queryCapsuleWardrobePreferredItemsForMultipleAccentColors(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  return executeSqlFile<CapsuleWardrobeSqlRow>(
    sql,
    MULTIPLE_ACCENT_WARDROBE_PREFERRED_SQL_FILE,
    buildMultipleAccentCapsuleSqlValues(params),
  );
}

export { queryCapsuleWardrobeItemsForMultipleAccentColors };
