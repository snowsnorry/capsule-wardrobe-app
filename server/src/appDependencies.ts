import { OAuth2Client } from "google-auth-library";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  createPendingCode,
  verifyCode,
  createSession,
  getSession,
  revokeSession,
} from "./authStore.js";
import { sendLoginCodeEmail } from "./email.js";
import {
  createProfile,
  deleteProfile,
  getFormalityLevels,
  getStyles,
  getOccasions,
  getSeasons,
  getAudienceOptions,
  getPatternOptions,
  getProfile,
  updateProfile,
  updateProfileLocale,
} from "./profileStore.js";
import {
  createCapsule,
  createCapsuleShare,
  deleteCapsule,
  duplicateCapsule,
  getCapsule,
  getSharedCapsule,
  importSharedCapsule,
  listRecentCapsules,
  countCapsules,
  renameCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  setCapsulePin,
  updateCapsuleReport,
  updateCapsuleSnapshot,
} from "./capsuleStore.js";
import {
  countOutfits,
  createOutfit,
  deleteOutfit,
  duplicateOutfit,
  getOutfit,
  listRecentOutfits,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  setOutfitPin,
  updateOutfitReport,
  updateOutfitSnapshot,
} from "./outfitStore.js";
import {
  getSearchOptions,
  getSavedSearch,
  getSearchStats,
  runSavedSearch,
} from "./searchStore.js";
import { runMcpProductSearch } from "./mcp/productSearch.js";
import {
  clearWardrobeJobsForEmail,
  getWardrobeJob,
  regenerateCapsuleWardrobe,
} from "./ai/ai.js";
import { clearPartialRegenerationJobsForEmail } from "./ai/partialRegenerationJobs.js";
import { clearOutfitSetImageJobsForEmail } from "./ai/outfitSetImageJobs.js";
import { clearOutfitImageJobsForEmail } from "./ai/outfitImageJobs.js";
import { getOutfitImageJob } from "./ai/outfitImageJobs.js";
import {
  getPartialRegenerationJob,
  regenerateSelectedWardrobeItems,
} from "./ai/regenerateSelected.js";
import {
  deleteOutfitSetImage,
  generateOutfitSetImage,
  getOutfitSetImageJob,
} from "./ai/outfitSetImages.js";
import { deleteOutfitImage, generateOutfitImage } from "./ai/outfitImages.js";
import { generateOutfitReport } from "./ai/outfitReportService.js";
import { generateCapsuleReport } from "./ai/capsuleReportService.js";
import { capsuleEventHub } from "./ai/capsuleEvents.js";
import { outfitEventHub } from "./ai/outfitEvents.js";
import { buildWardrobePdfInChild } from "./wardrobePdf.js";
import { deleteWardrobePdfJob } from "./wardrobePdfJobRegistry.js";
import {
  checkDatabaseConnection,
  consumeMcpAuthorizationCode,
  consumePasskeyChallenge,
  deletePasskeyByIdForEmail,
  deleteLikedItemByUrl,
  deleteUploadedWardrobeItemById,
  deleteWardrobeItemFromCatalogByUrl,
  getPasskeyByCredentialId,
  getMcpRefreshToken,
  getMcpRegisteredClient,
  getProductByIdForEmail,
  getProductByUrlForEmail,
  getProductsByUrlsForEmailInOrder,
  getProductsByUrlsInOrder,
  getUploadedWardrobeItemById,
  hasActiveMcpGrant,
  insertMcpAuthorizationCode,
  insertMcpRefreshToken,
  insertMcpRegisteredClient,
  insertPasskey,
  insertPasskeyChallenge,
  listWardrobeItemsByIdsForEmail,
  listWardrobeItemsByUrlsForEmail,
  listWardrobeItemsByEmail,
  listLikedItemUrlsByEmail,
  saveUploadedWardrobeItemsByEmail,
  saveWardrobeItemFromCatalogByUrl,
  updateUploadedWardrobeItemDetailsById,
  updateUploadedWardrobeItemMetadataById,
  listPasskeysByEmail,
  pruneExpiredPasskeyChallenges,
  updatePasskeyAuthentication,
  upsertMcpGrant,
  upsertLikedItemByUrl,
  revokeMcpRefreshToken,
  rotateMcpRefreshToken,
} from "./db.js";
import { configureSharp } from "./ai/sharpConfig.js";
import {
  AUTH_TEST_MODE,
  CLIENT_ORIGIN,
  GOOGLE_CLIENT_ID,
  NODE_ENV,
  PASSKEY_ORIGIN,
  PASSKEY_RP_ID,
  PASSKEY_RP_NAME,
} from "./appConfig.js";
import {
  copyImageObjectToR2,
  uploadWardrobeDerivativeImageToR2,
  uploadWardrobeImageToR2,
} from "./r2Storage.js";
import { deleteObjectsFromR2 } from "./r2Delete.js";
import { normalizeWardrobeUploadImagesInChild } from "./wardrobeUploadImagesRunner.js";
import {
  processWardrobeUploadFilesInChild,
  processWardrobeUploadUrlsInChild,
} from "./wardrobeUploadProcessingRunner.js";
import {
  analyzeWardrobeImageUrl,
  analyzeWardrobeProductPageImage,
} from "./wardrobeImageAnalysis.js";
import { cleanupUploadedWardrobeItemImage } from "./wardrobeImageCleanup.js";
import {
  buildRemoteWardrobeImageSourceKey,
  downloadWardrobeProductPageImage,
  fetchProductPageHtmlWithImpers,
} from "./wardrobeProductPageImport.js";
import { createUploadedWardrobeItemEmbedding } from "./wardrobeSemanticEmbedding.js";
import { validateCapsuleAnchorItems } from "./capsuleAnchors.js";
import { createMcpOAuthConfig } from "./mcp/oauthConfig.js";
import { logInfo } from "./logger.js";

const sharpConfig = configureSharp();
logInfo(
  "[sharp][configured]",
  JSON.stringify({
    cache: sharpConfig.cache,
    concurrency: sharpConfig.concurrency,
  }),
);

function resolveGoogleAuthClient({
  googleAuthClient,
  googleClientId,
}: {
  googleAuthClient?: unknown;
  googleClientId?: string | null;
}) {
  if (googleAuthClient !== undefined) {
    return googleAuthClient;
  }

  return googleClientId ? new OAuth2Client(googleClientId) : null;
}

function createWardrobeImageStorageDependencies() {
  return {
    analyzeWardrobeImageUrlImpl: analyzeWardrobeImageUrl,
    analyzeWardrobeProductPageImageImpl: analyzeWardrobeProductPageImage,
    buildRemoteWardrobeImageSourceKeyImpl: buildRemoteWardrobeImageSourceKey,
    cleanupUploadedWardrobeItemImageImpl: cleanupUploadedWardrobeItemImage,
    createUploadedWardrobeItemEmbeddingImpl:
      createUploadedWardrobeItemEmbedding,
    deleteR2ObjectsImpl: deleteObjectsFromR2,
    deleteUploadedWardrobeItemImpl: deleteUploadedWardrobeItemById,
    downloadWardrobeProductPageImageImpl: downloadWardrobeProductPageImage,
    fetchProductPageHtmlWithImpersImpl: fetchProductPageHtmlWithImpers,
    uploadWardrobeDerivativeImageToR2Impl: uploadWardrobeDerivativeImageToR2,
    uploadWardrobeImageToR2Impl: uploadWardrobeImageToR2,
  };
}

function clearAccountTransientState(email: string) {
  clearWardrobeJobsForEmail(email);
  clearPartialRegenerationJobsForEmail(email);
  clearOutfitSetImageJobsForEmail(email);
  clearOutfitImageJobsForEmail(email);
  deleteWardrobePdfJob(email);
}

function generateOutfitReportWithStoreLookups(email: string, outfitId: string) {
  return generateOutfitReport(email, outfitId, {
    getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
    listWardrobeItemsByUrlsImpl: listWardrobeItemsByUrlsForEmail,
    updateOutfitReportImpl: updateOutfitReport,
  });
}

function generateCapsuleReportWithStoreLookups(
  email: string,
  capsuleId: string,
) {
  return generateCapsuleReport(email, capsuleId, {
    updateCapsuleReportImpl: updateCapsuleReport,
  });
}

// eslint-disable-next-line max-lines-per-function
export function createAppDependencies(options: Record<string, unknown> = {}) {
  const googleClientId =
    options.googleClientId === undefined
      ? GOOGLE_CLIENT_ID
      : (options.googleClientId as string | null);
  return {
    authTestMode: AUTH_TEST_MODE,
    buildWardrobePdfInChildImpl: buildWardrobePdfInChild,
    checkDatabaseConnectionImpl: checkDatabaseConnection,
    clearAccountTransientStateImpl: clearAccountTransientState,
    clientOrigin: CLIENT_ORIGIN,
    consumePasskeyChallengeImpl: consumePasskeyChallenge,
    createCapsuleImpl: createCapsule,
    createCapsuleShareImpl: createCapsuleShare,
    createOutfitImpl: createOutfit,
    createPendingCodeImpl: createPendingCode,
    createProfileImpl: createProfile,
    createSessionImpl: createSession,
    deleteCapsuleImpl: deleteCapsule,
    deleteLikedItemImpl: deleteLikedItemByUrl,
    deleteOutfitImpl: deleteOutfit,
    deleteOutfitImageHandler: deleteOutfitImage,
    deleteOutfitSetImageHandler: deleteOutfitSetImage,
    deletePasskeyByIdForEmailImpl: deletePasskeyByIdForEmail,
    deleteProfileImpl: deleteProfile,
    duplicateCapsuleImpl: duplicateCapsule,
    duplicateOutfitImpl: duplicateOutfit,
    generateAuthenticationOptionsImpl: generateAuthenticationOptions,
    generateCapsuleReportImpl: generateCapsuleReportWithStoreLookups,
    generateOutfitImageHandler: generateOutfitImage,
    generateOutfitReportImpl: generateOutfitReportWithStoreLookups,
    generateOutfitSetImageHandler: generateOutfitSetImage,
    generateRegistrationOptionsImpl: generateRegistrationOptions,
    getAudienceOptionsImpl: getAudienceOptions,
    getCapsuleImpl: getCapsule,
    getFormalityLevelsImpl: getFormalityLevels,
    getOccasionsImpl: getOccasions,
    getOutfitImpl: getOutfit,
    getOutfitImageJobImpl: getOutfitImageJob,
    getOutfitSetImageJobImpl: getOutfitSetImageJob,
    getPartialRegenerationJobImpl: getPartialRegenerationJob,
    getPasskeyByCredentialIdImpl: getPasskeyByCredentialId,
    getPatternOptionsImpl: getPatternOptions,
    getProductByIdForEmailImpl: getProductByIdForEmail,
    getProductByUrlForEmailImpl: getProductByUrlForEmail,
    getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
    getProductsByUrlsInOrderImpl: getProductsByUrlsInOrder,
    getProfileImpl: getProfile,
    getSavedSearchImpl: getSavedSearch,
    getSearchOptionsImpl: getSearchOptions,
    getSearchStatsImpl: getSearchStats,
    getSeasonsImpl: getSeasons,
    getSessionImpl: getSession,
    getSharedCapsuleImpl: getSharedCapsule,
    getMcpRegisteredClientImpl: getMcpRegisteredClient,
    getMcpRefreshTokenImpl: getMcpRefreshToken,
    getStylesImpl: getStyles,
    getUploadedWardrobeItemImpl: getUploadedWardrobeItemById,
    getWardrobeJobImpl: getWardrobeJob,
    googleClientId,
    importSharedCapsuleImpl: importSharedCapsule,
    insertMcpAuthorizationCodeImpl: insertMcpAuthorizationCode,
    insertMcpRefreshTokenImpl: insertMcpRefreshToken,
    insertMcpRegisteredClientImpl: insertMcpRegisteredClient,
    insertPasskeyChallengeImpl: insertPasskeyChallenge,
    insertPasskeyImpl: insertPasskey,
    consumeMcpAuthorizationCodeImpl: consumeMcpAuthorizationCode,
    deleteWardrobeItemFromCatalogImpl: deleteWardrobeItemFromCatalogByUrl,
    hasActiveMcpGrantImpl: hasActiveMcpGrant,
    listPasskeysImpl: listPasskeysByEmail,
    listLikedItemUrlsImpl: listLikedItemUrlsByEmail,
    listWardrobeItemsByIdsImpl: listWardrobeItemsByIdsForEmail,
    listWardrobeItemsByUrlsImpl: listWardrobeItemsByUrlsForEmail,
    listWardrobeItemsImpl: listWardrobeItemsByEmail,
    listRecentCapsulesImpl: listRecentCapsules,
    countCapsulesImpl: countCapsules,
    listRecentOutfitsImpl: listRecentOutfits,
    countOutfitsImpl: countOutfits,
    nodeEnv: NODE_ENV,
    passkeyOrigin: PASSKEY_ORIGIN,
    passkeyRpId: PASSKEY_RP_ID,
    passkeyRpName: PASSKEY_RP_NAME,
    mcpOAuthConfig: createMcpOAuthConfig(),
    pruneExpiredPasskeyChallengesImpl: pruneExpiredPasskeyChallenges,
    regenerateCapsuleWardrobeHandler: regenerateCapsuleWardrobe,
    regenerateSelectedCapsuleItemsHandler: regenerateSelectedWardrobeItems,
    renameCapsuleImpl: renameCapsule,
    renameOutfitImpl: renameOutfit,
    revertCapsuleImpl: revertCapsule,
    revertOutfitImpl: revertOutfit,
    revokeMcpRefreshTokenImpl: revokeMcpRefreshToken,
    revokeSessionImpl: revokeSession,
    rotateMcpRefreshTokenImpl: rotateMcpRefreshToken,
    runMcpProductSearchImpl: runMcpProductSearch,
    runSavedSearchImpl: runSavedSearch,
    saveCapsuleImpl: saveCapsule,
    saveOutfitImpl: saveOutfit,
    setCapsulePinImpl: setCapsulePin,
    setOutfitPinImpl: setOutfitPin,
    saveUploadedWardrobeItemsImpl: saveUploadedWardrobeItemsByEmail,
    saveWardrobeItemFromCatalogImpl: saveWardrobeItemFromCatalogByUrl,
    searchCapsulesImpl: searchCapsules,
    searchOutfitsImpl: searchOutfits,
    sendLoginCodeEmailImpl: sendLoginCodeEmail,
    streamCapsuleEventsImpl: capsuleEventHub.subscribe,
    streamOutfitEventsImpl: outfitEventHub.subscribe,
    updateCapsuleSnapshotImpl: updateCapsuleSnapshot,
    updateCapsuleReportImpl: updateCapsuleReport,
    updateOutfitReportImpl: updateOutfitReport,
    updateOutfitSnapshotImpl: updateOutfitSnapshot,
    copyImageObjectToR2Impl: copyImageObjectToR2,
    validateCapsuleAnchorItemsImpl: (email, anchorItemRefs) =>
      validateCapsuleAnchorItems({
        email,
        anchorItemRefs,
        deps: {
          listWardrobeItemsByIdsImpl: listWardrobeItemsByIdsForEmail,
          getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
        },
      }),
    updatePasskeyAuthenticationImpl: updatePasskeyAuthentication,
    upsertLikedItemImpl: upsertLikedItemByUrl,
    updateProfileImpl: updateProfile,
    updateProfileLocaleImpl: updateProfileLocale,
    upsertMcpGrantImpl: upsertMcpGrant,
    updateUploadedWardrobeItemDetailsImpl:
      updateUploadedWardrobeItemDetailsById,
    updateUploadedWardrobeItemMetadataImpl:
      updateUploadedWardrobeItemMetadataById,
    ...createWardrobeImageStorageDependencies(),
    normalizeWardrobeUploadImagesInChildImpl:
      normalizeWardrobeUploadImagesInChild,
    processWardrobeUploadFilesInChildImpl: processWardrobeUploadFilesInChild,
    processWardrobeUploadUrlsInChildImpl: processWardrobeUploadUrlsInChild,
    verifyAuthenticationResponseImpl: verifyAuthenticationResponse,
    verifyCodeImpl: verifyCode,
    verifyRegistrationResponseImpl: verifyRegistrationResponse,
    ...options,
    googleAuthClient: resolveGoogleAuthClient({ ...options, googleClientId }),
  };
}
