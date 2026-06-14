import { countItemsByKey, getSqlRows, logWardrobeInfo } from "./aiCommon.js";
import type { CountByKey, LogContextLike, UserProfileLike } from "./types.js";
import type { ResolvedCapsuleGenerationDeps } from "./aiGenerationDeps.js";

async function getNormalizedWardrobeItems(
  userProfile: UserProfileLike | null,
  promptEmbeddings: number[],
  capsuleCategories: CountByKey,
  logContext: LogContextLike | null,
  deps: ResolvedCapsuleGenerationDeps,
) {
  const sqlParams = deps.buildCapsuleWardrobeSqlParamsImpl(
    userProfile,
    promptEmbeddings,
    capsuleCategories,
  );
  const sqlStartedAt = Date.now();
  const itemsResult = await deps.queryCapsuleWardrobeItemsForProfileImpl(
    deps.getSqlClientImpl(),
    sqlParams,
  );
  const items = getSqlRows(itemsResult);
  const normalizedItems = items.map((item) => {
    const normalized = { ...(item as Record<string, unknown>) };
    delete normalized.embedding;
    return normalized;
  });

  logWardrobeInfo(
    "capsule-sql-completed",
    {
      sqlDurationMs: Date.now() - sqlStartedAt,
      sqlItemsTotal: normalizedItems.length,
      sqlItemsByCategory: countItemsByKey(normalizedItems),
    },
    logContext,
  );

  return normalizedItems;
}

async function getValidatedAnchorContext(
  userProfile: UserProfileLike | null,
  deps: ResolvedCapsuleGenerationDeps,
) {
  const anchorItemRefs = Array.isArray(userProfile?.anchorItemRefs)
    ? userProfile.anchorItemRefs
    : [];
  const email = typeof userProfile?.email === "string" ? userProfile.email : "";
  return deps.validateCapsuleAnchorItemsImpl(email, anchorItemRefs);
}

export { getNormalizedWardrobeItems, getValidatedAnchorContext };
