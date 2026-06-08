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
const MULTIPLE_ACCENT_CATALOG_ONLY_WITH_ANCHORS_SQL_FILE = new URL(
  "./sql/capsule_multiple_accent_catalog_only_with_anchors.sql",
  import.meta.url,
);
const MULTIPLE_ACCENT_WARDROBE_PREFERRED_SQL_FILE = new URL(
  "./sql/capsule_multiple_accent_wardrobe_preferred.sql",
  import.meta.url,
);
const MULTIPLE_ACCENT_WARDROBE_PREFERRED_WITH_ANCHORS_SQL_FILE = new URL(
  "./sql/capsule_multiple_accent_wardrobe_preferred_with_anchors.sql",
  import.meta.url,
);
const MULTIPLE_ACCENT_WARDROBE_ONLY_SQL_FILE = new URL(
  "./sql/capsule_multiple_accent_wardrobe_only.sql",
  import.meta.url,
);
const MULTIPLE_ACCENT_WARDROBE_ONLY_WITH_ANCHORS_SQL_FILE = new URL(
  "./sql/capsule_multiple_accent_wardrobe_only_with_anchors.sql",
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

function hasAnchorParams(params: CapsuleWardrobeSqlParams): boolean {
  return (
    params.anchorWardrobeNumericIds.length > 0 ||
    params.anchorCatalogUrls.length > 0
  );
}

function buildMultipleAccentCatalogOnlyAnchorSqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    ...buildMultipleAccentCapsuleSqlValues(params).slice(0, 11),
    params.profileEmail,
    params.anchorWardrobeNumericIds,
    params.anchorCatalogUrls,
    params.anchorSimilarityBonusWeight,
  ];
}

function buildMultipleAccentWardrobePreferredAnchorSqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    ...buildMultipleAccentCapsuleSqlValues(params),
    params.anchorWardrobeNumericIds,
    params.anchorCatalogUrls,
    params.anchorSimilarityBonusWeight,
  ];
}

function buildMultipleAccentWardrobeOnlySqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    ...buildMultipleAccentCapsuleSqlValues(params).slice(0, 11),
    params.profileEmail,
  ];
}

function buildMultipleAccentWardrobeOnlyAnchorSqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    ...buildMultipleAccentWardrobeOnlySqlValues(params),
    params.anchorWardrobeNumericIds,
    params.anchorCatalogUrls,
    params.anchorSimilarityBonusWeight,
  ];
}

async function queryCapsuleWardrobeItemsForMultipleAccentColors(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  if (params.sourceMode === "wardrobe_only") {
    return queryCapsuleWardrobeOnlyItemsForMultipleAccentColors(sql, params);
  }

  if (params.sourceMode === "wardrobe_preferred") {
    return queryCapsuleWardrobePreferredItemsForMultipleAccentColors(
      sql,
      params,
    );
  }

  if (hasAnchorParams(params)) {
    return executeSqlFile<CapsuleWardrobeSqlRow>(
      sql,
      MULTIPLE_ACCENT_CATALOG_ONLY_WITH_ANCHORS_SQL_FILE,
      buildMultipleAccentCatalogOnlyAnchorSqlValues(params),
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
  if (hasAnchorParams(params)) {
    return executeSqlFile<CapsuleWardrobeSqlRow>(
      sql,
      MULTIPLE_ACCENT_WARDROBE_PREFERRED_WITH_ANCHORS_SQL_FILE,
      buildMultipleAccentWardrobePreferredAnchorSqlValues(params),
    );
  }

  return executeSqlFile<CapsuleWardrobeSqlRow>(
    sql,
    MULTIPLE_ACCENT_WARDROBE_PREFERRED_SQL_FILE,
    buildMultipleAccentCapsuleSqlValues(params),
  );
}

async function queryCapsuleWardrobeOnlyItemsForMultipleAccentColors(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  if (hasAnchorParams(params)) {
    return executeSqlFile<CapsuleWardrobeSqlRow>(
      sql,
      MULTIPLE_ACCENT_WARDROBE_ONLY_WITH_ANCHORS_SQL_FILE,
      buildMultipleAccentWardrobeOnlyAnchorSqlValues(params),
    );
  }

  return executeSqlFile<CapsuleWardrobeSqlRow>(
    sql,
    MULTIPLE_ACCENT_WARDROBE_ONLY_SQL_FILE,
    buildMultipleAccentWardrobeOnlySqlValues(params),
  );
}

export { queryCapsuleWardrobeItemsForMultipleAccentColors };
