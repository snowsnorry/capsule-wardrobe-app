export {
  getSqlClient,
  setSqlClientOverride,
  stableStringify,
  hashCapsuleContent,
  hasAffectedRows,
} from "./db/core.js";
export { checkDatabaseConnection, ensureTables } from "./db/schema.js";
export {
  upsertLoginCode,
  getLoginCodeByEmail,
  verifyAndConsumeLoginCode,
  insertSession,
  getSessionById,
  deleteSessionById,
  listPasskeysByEmail,
  insertPasskey,
  getPasskeyByCredentialId,
  updatePasskeyAuthentication,
  deletePasskeyByIdForEmail,
  insertPasskeyChallenge,
  consumePasskeyChallenge,
} from "./db/auth.js";
export {
  hasProfileByEmail,
  getDistinctProductFormalityLevels,
  getDistinctProductOccasions,
  getDistinctProductSeasons,
  getDistinctProductPatterns,
  getDistinctProductBrands,
  getDistinctProductCategories,
  getDistinctProductSilhouettes,
  getDistinctProductFits,
  getDistinctProductClosureTypes,
  getDistinctProductColors,
  getProductPriceRange,
  getProductsByUrlsInOrder,
  getProductsWithEmbeddingsByUrlsInOrder,
} from "./db/productOptions.js";
export {
  getProductByIdForEmail,
  getProductByUrlForEmail,
  getProductsByUrlsForEmailInOrder,
} from "./db/productLookup.js";
export {
  buildPriceBuckets,
  getSearchByEmail,
  upsertSearchByEmail,
  searchProducts,
} from "./db/searchPersistence.js";
export { searchProductStats } from "./db/searchStats.js";
export {
  countWardrobeItemsByEmail,
  decodeWardrobePageCursor,
  deleteWardrobeItemFromCatalogByUrl,
  encodeWardrobePageCursor,
  getUploadedWardrobeItemById,
  listWardrobeItemsByIdsForEmail,
  listWardrobeItemsByUrlsForEmail,
  listWardrobeItemsByEmail,
  listWardrobeItemsPageByEmail,
  saveUploadedWardrobeItemsByEmail,
  saveWardrobeItemFromCatalogByUrl,
} from "./db/wardrobe.js";
export {
  deletePersonalItemsReportByEmail,
  getPersonalItemsReportByEmail,
  upsertPersonalItemsReportByEmail,
} from "./db/personalItemsReports.js";
export {
  deleteLikedItemByUrl,
  listLikedItemUrlsForUrlsByEmail,
  listLikedItemUrlsByEmail,
  upsertLikedItemByUrl,
} from "./db/likedItems.js";
export {
  deleteUploadedWardrobeItemById,
  listUploadedWardrobeR2KeysByEmail,
} from "./db/wardrobeDelete.js";
export {
  updateUploadedWardrobeItemDetailsById,
  updateUploadedWardrobeItemMetadataById,
} from "./db/wardrobeMetadata.js";
export {
  getProfileByEmail,
  createProfileRecord,
  updateProfileByEmail,
  updateProfileLocaleByEmail,
  updateProfileActiveCapsuleIdByEmail,
  createCapsuleRecord,
  countCapsulesByEmail,
  getCapsuleByIdForEmail,
  listRecentCapsulesByEmail,
  searchCapsulesByEmail,
  listCapsuleNamesByEmail,
  updateCapsuleSavedSnapshotByIdForEmail,
  updateCapsuleSnapshotByIdForEmail,
  updateCapsuleReportByIdForEmail,
  updateCapsulePinByIdForEmail,
  renameCapsuleByIdForEmail,
  saveCapsuleByIdForEmail,
  revertCapsuleDraftByIdForEmail,
  deleteCapsuleByIdForEmail,
  upsertSharedCapsule,
  getValidSharedCapsuleById,
  deleteProfileByEmail,
} from "./db/profileCapsules.js";
export {
  countOutfitsByEmail,
  createOutfitRecord,
  deleteOutfitByIdForEmail,
  getOutfitByIdForEmail,
  listOutfitNamesByEmail,
  listRecentOutfitsByEmail,
  renameOutfitByIdForEmail,
  revertOutfitDraftByIdForEmail,
  saveOutfitByIdForEmail,
  searchOutfitsByEmail,
  updateOutfitPinByIdForEmail,
  updateOutfitReportByIdForEmail,
  updateOutfitSnapshotByIdForEmail,
} from "./db/profileOutfits.js";
export {
  consumeMcpAuthorizationCode,
  getMcpRegisteredClient,
  hasActiveMcpGrant,
  insertMcpAuthorizationCode,
  insertMcpRegisteredClient,
  upsertMcpGrant,
} from "./db/mcpOAuth.js";
export {
  getMcpRefreshToken,
  insertMcpRefreshToken,
  revokeMcpRefreshToken,
  rotateMcpRefreshToken,
} from "./db/mcpOAuthRefreshTokens.js";
export {
  claimQueuedJobRunsWithoutProviderId,
  clearJobRunsForEmail,
  createJobRun,
  getJobRunById,
  getJobRunByIdForEmail,
  getJobRunMetrics,
  getLatestOwnedJobEventId,
  listJobEventsAfter,
  listOwnedJobEventsAfter,
  listActiveJobRunsForEntity,
  listJobRunsForEmail,
  markJobRunCompleted,
  markJobRunFailed,
  markJobRunStarted,
  markStaleRunningJobRunsFailed,
  setJobRunProviderJobId,
  updateJobRunProgress,
} from "./db/jobs.js";
