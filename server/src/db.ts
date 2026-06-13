export {
  getSqlClient,
  setSqlClientOverride,
  stableStringify,
  hashCapsuleContent,
  hasAffectedRows,
} from "./db/core.js";
export { checkDatabaseConnection, ensureTables } from "./db/schema.js";
export {
  pruneLoginCodes,
  upsertLoginCode,
  getLoginCodeByEmail,
  verifyAndConsumeLoginCode,
  insertSession,
  getSessionById,
  deleteSessionById,
  pruneExpiredSessions,
  listPasskeysByEmail,
  insertPasskey,
  getPasskeyByCredentialId,
  updatePasskeyAuthentication,
  deletePasskeyByIdForEmail,
  insertPasskeyChallenge,
  consumePasskeyChallenge,
  pruneExpiredPasskeyChallenges,
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
  deleteWardrobeItemFromCatalogByUrl,
  getUploadedWardrobeItemById,
  listWardrobeItemsByIdsForEmail,
  listWardrobeItemsByUrlsForEmail,
  listWardrobeItemsByEmail,
  saveUploadedWardrobeItemsByEmail,
  saveWardrobeItemFromCatalogByUrl,
} from "./db/wardrobe.js";
export {
  deleteLikedItemByUrl,
  listLikedItemUrlsByEmail,
  upsertLikedItemByUrl,
} from "./db/likedItems.js";
export { deleteUploadedWardrobeItemById } from "./db/wardrobeDelete.js";
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
  updateCapsuleSnapshotByIdForEmail,
  updateCapsuleReportByIdForEmail,
  renameCapsuleByIdForEmail,
  saveCapsuleByIdForEmail,
  revertCapsuleDraftByIdForEmail,
  deleteCapsuleByIdForEmail,
  upsertSharedCapsule,
  getValidSharedCapsuleById,
  pruneExpiredSharedCapsules,
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
