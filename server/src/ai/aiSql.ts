import { executeSqlFile } from "../db/sqlFiles.js";
import type { CountByKey, UserProfileLike } from "./types.js";
import { queryCapsuleWardrobeItemsForMultipleAccentColors } from "./aiSqlMultipleAccent.js";
import type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
  CapsuleWardrobeSqlRow,
} from "./aiSqlTypes.js";

const MULTIPLE_ACCENT_COLORS = "multiple_accent_colors";
const WARDROBE_RELEVANCE_BOOST = 25;
const CATALOG_POOL_LIMIT = 10;
const WARDROBE_POOL_LIMIT = 5;
const FINAL_CANDIDATE_LIMIT = 10;
const ANCHOR_SIMILARITY_BONUS_WEIGHT = 18;
const CATALOG_ONLY_SQL_FILE = new URL(
  "./sql/capsule_catalog_only.sql",
  import.meta.url,
);
const CATALOG_ONLY_WITH_ANCHORS_SQL_FILE = new URL(
  "./sql/capsule_catalog_only_with_anchors.sql",
  import.meta.url,
);
const WARDROBE_PREFERRED_SQL_FILE = new URL(
  "./sql/capsule_wardrobe_preferred.sql",
  import.meta.url,
);
const WARDROBE_PREFERRED_WITH_ANCHORS_SQL_FILE = new URL(
  "./sql/capsule_wardrobe_preferred_with_anchors.sql",
  import.meta.url,
);
const WARDROBE_ONLY_SQL_FILE = new URL(
  "./sql/capsule_wardrobe_only.sql",
  import.meta.url,
);
const WARDROBE_ONLY_WITH_ANCHORS_SQL_FILE = new URL(
  "./sql/capsule_wardrobe_only_with_anchors.sql",
  import.meta.url,
);

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
  if (
    userProfile?.sourceMode === "wardrobe_preferred" ||
    userProfile?.sourceMode === "wardrobe_only"
  ) {
    return userProfile.sourceMode;
  }

  return "catalog_only";
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
    anchorWardrobeItemIds: Array.isArray(userProfile?.anchorWardrobeItemIds)
      ? userProfile.anchorWardrobeItemIds
      : [],
    anchorWardrobeNumericIds: Array.isArray(
      userProfile?.anchorWardrobeNumericIds,
    )
      ? userProfile.anchorWardrobeNumericIds
      : [],
    anchorSimilarityBonusWeight: ANCHOR_SIMILARITY_BONUS_WEIGHT,
    ...getProfileSqlFilters(userProfile),
    embeddingVector: `[${promptEmbeddings.join(",")}]`,
  };
}

function buildRegularCapsuleSqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    params.categories,
    params.noiseFactor,
    params.embeddingVector,
    params.style,
    params.color,
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
  return params.anchorWardrobeNumericIds.length > 0;
}

function buildCatalogOnlyAnchorSqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    ...buildRegularCapsuleSqlValues(params).slice(0, 12),
    params.profileEmail,
    params.anchorWardrobeNumericIds,
    params.anchorSimilarityBonusWeight,
  ];
}

function buildWardrobePreferredAnchorSqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    ...buildRegularCapsuleSqlValues(params),
    params.anchorWardrobeNumericIds,
    params.anchorSimilarityBonusWeight,
  ];
}

function buildWardrobeOnlySqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    ...buildRegularCapsuleSqlValues(params).slice(0, 12),
    params.profileEmail,
  ];
}

function buildWardrobeOnlyAnchorSqlValues(
  params: CapsuleWardrobeSqlParams,
): readonly unknown[] {
  return [
    ...buildWardrobeOnlySqlValues(params),
    params.anchorWardrobeNumericIds,
    params.anchorSimilarityBonusWeight,
  ];
}

async function queryCatalogOnlyCapsuleWardrobeItems(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  if (hasAnchorParams(params)) {
    return executeSqlFile<CapsuleWardrobeSqlRow>(
      sql,
      CATALOG_ONLY_WITH_ANCHORS_SQL_FILE,
      buildCatalogOnlyAnchorSqlValues(params),
    );
  }

  return executeSqlFile<CapsuleWardrobeSqlRow>(
    sql,
    CATALOG_ONLY_SQL_FILE,
    buildRegularCapsuleSqlValues(params).slice(0, 12),
  );
}

async function queryCapsuleWardrobePreferredItems(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  if (hasAnchorParams(params)) {
    return executeSqlFile<CapsuleWardrobeSqlRow>(
      sql,
      WARDROBE_PREFERRED_WITH_ANCHORS_SQL_FILE,
      buildWardrobePreferredAnchorSqlValues(params),
    );
  }

  return executeSqlFile<CapsuleWardrobeSqlRow>(
    sql,
    WARDROBE_PREFERRED_SQL_FILE,
    buildRegularCapsuleSqlValues(params),
  );
}

async function queryCapsuleWardrobeOnlyItems(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  if (hasAnchorParams(params)) {
    return executeSqlFile<CapsuleWardrobeSqlRow>(
      sql,
      WARDROBE_ONLY_WITH_ANCHORS_SQL_FILE,
      buildWardrobeOnlyAnchorSqlValues(params),
    );
  }

  return executeSqlFile<CapsuleWardrobeSqlRow>(
    sql,
    WARDROBE_ONLY_SQL_FILE,
    buildWardrobeOnlySqlValues(params),
  );
}

async function queryCapsuleWardrobeItems(
  sql: CapsuleWardrobeSqlClient,
  params: CapsuleWardrobeSqlParams,
) {
  if (params.sourceMode === "wardrobe_only") {
    return queryCapsuleWardrobeOnlyItems(sql, params);
  }

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
  queryCapsuleWardrobeOnlyItems,
  queryCapsuleWardrobePreferredItems,
  queryCapsuleWardrobeItemsForMultipleAccentColors,
  queryCapsuleWardrobeItemsForProfile,
};
export type {
  CapsuleWardrobeSqlClient,
  CapsuleWardrobeSqlParams,
} from "./aiSqlTypes.js";
