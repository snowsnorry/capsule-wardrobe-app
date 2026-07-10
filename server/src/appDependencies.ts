import crypto from "node:crypto";
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
  markSearchProductOptionsStale,
  runSavedSearch,
} from "./searchStore.js";
import { createSearchCacheInvalidationService } from "./searchCacheInvalidation.js";
import { runMcpProductSearch } from "./mcp/productSearch.js";
import { generateCapsuleWardrobe } from "./ai/aiGeneration.js";
import { runPersistedWardrobeGenerationJobForService } from "./ai/wardrobeJobService.js";
import { runPersistedPartialRegenerationJobForService } from "./ai/regenerateSelectedServiceJobs.js";
import {
  deleteOutfitSetImage,
  runOutfitSetImageGenerationJob,
} from "./ai/outfitSetImages.js";
import {
  deleteOutfitImage,
  runOutfitImageGenerationJob,
} from "./ai/outfitImages.js";
import {
  generateSwimwearAddition,
  shouldCompleteSelectedSwimwear,
  shouldGenerateSwimwear,
} from "./ai/swimwear.js";
import { buildCapsuleEventSnapshot } from "./ai/capsuleEvents.js";
import { regenerateCapsuleWardrobe } from "./ai/regenerateSelectedGeneration.js";
import { buildWardrobePdfInChild } from "./wardrobePdf.js";
import {
  checkDatabaseConnection,
  consumeMcpAuthorizationCode,
  consumePasskeyChallenge,
  countWardrobeItemsByEmail,
  deletePasskeyByIdForEmail,
  deleteLikedItemByUrl,
  deletePersonalItemsReportByEmail,
  deleteUploadedWardrobeItemById,
  deleteWardrobeItemFromCatalogByUrl,
  getPasskeyByCredentialId,
  getMcpRefreshToken,
  getMcpRegisteredClient,
  getProductByIdForEmail,
  getProductByUrlForEmail,
  getPersonalItemsReportByEmail,
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
  listWardrobeItemsPageByEmail,
  listUploadedWardrobeR2KeysByEmail,
  listLikedItemUrlsForUrlsByEmail,
  listLikedItemUrlsByEmail,
  saveUploadedWardrobeItemsByEmail,
  saveWardrobeItemFromCatalogByUrl,
  updateUploadedWardrobeItemDetailsById,
  updateUploadedWardrobeItemMetadataById,
  listPasskeysByEmail,
  updatePasskeyAuthentication,
  upsertLikedItemByUrl,
  upsertMcpGrant,
  revokeMcpRefreshToken,
  rotateMcpRefreshToken,
} from "./db.js";
import { configureSharp } from "./ai/sharpConfig.js";
import {
  AUTH_TEST_MODE,
  CLIENT_ORIGIN,
  E2E_SERVER,
  GOOGLE_CLIENT_ID,
  NODE_ENV,
  PASSKEY_ORIGIN,
  PASSKEY_RP_ID,
  PASSKEY_RP_NAME,
  RELEASE_METADATA,
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
import { processQueuedWardrobeFileUploadImpl } from "./routes/wardrobeFileUploadRoute.js";
import { processQueuedWardrobeUrlUpload } from "./routes/wardrobeUrlUploadRoute.js";
import { analyzeWardrobeImageUrl } from "./wardrobeImageAnalysis.js";
import { cleanupUploadedWardrobeItemImage } from "./wardrobeImageCleanup.js";
import { createUploadedWardrobeItemEmbedding } from "./wardrobeSemanticEmbedding.js";
import { validateCapsuleAnchorItems } from "./capsuleAnchors.js";
import { createMcpOAuthConfig } from "./mcp/oauthConfig.js";
import { logInfo } from "./logger.js";
import { buildInternalMetricsSnapshot } from "./observabilityMetrics.js";
import { annotateLikedItems } from "./routes/likedItemsRoutes.js";
import {
  createAccountCleanupDependencies,
  generateCapsuleReportWithStoreLookups,
  generateOutfitReportWithStoreLookups,
  generatePersonalItemsReportWithStoreLookups,
} from "./appDependencyReports.js";
import { createJobDependencies } from "./appDependencyJobs.js";

const sharpConfig = configureSharp();
logInfo("image.sharp.configured", {
  cache: sharpConfig.cache,
  concurrency: sharpConfig.concurrency,
});

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
    annotateLikedItems,
    cleanupUploadedWardrobeItemImageImpl: cleanupUploadedWardrobeItemImage,
    createUploadedWardrobeItemEmbeddingImpl:
      createUploadedWardrobeItemEmbedding,
    deleteR2ObjectsImpl: deleteObjectsFromR2,
    deleteUploadedWardrobeItemImpl: deleteUploadedWardrobeItemById,
    uploadWardrobeDerivativeImageToR2Impl: uploadWardrobeDerivativeImageToR2,
    uploadWardrobeImageToR2Impl: uploadWardrobeImageToR2,
  };
}

function createRuntimeDependencies(googleClientId: string | null) {
  return {
    authTestMode: AUTH_TEST_MODE,
    checkDatabaseConnectionImpl: checkDatabaseConnection,
    clientOrigin: CLIENT_ORIGIN,
    googleClientId,
    mcpOAuthConfig: createMcpOAuthConfig(),
    nodeEnv: NODE_ENV,
    releaseMetadata: RELEASE_METADATA,
  };
}

function createAuthSessionDependencies() {
  return {
    createPendingCodeImpl: createPendingCode,
    createSessionImpl: createSession,
    getSessionImpl: getSession,
    revokeSessionImpl: revokeSession,
    sendLoginCodeEmailImpl: sendLoginCodeEmail,
    verifyCodeImpl: verifyCode,
  };
}

function createProfileOptionDependencies() {
  return {
    createProfileImpl: createProfile,
    deleteProfileImpl: deleteProfile,
    getAudienceOptionsImpl: getAudienceOptions,
    getFormalityLevelsImpl: getFormalityLevels,
    getOccasionsImpl: getOccasions,
    getPatternOptionsImpl: getPatternOptions,
    getProfileImpl: getProfile,
    getSeasonsImpl: getSeasons,
    getStylesImpl: getStyles,
    updateProfileImpl: updateProfile,
    updateProfileLocaleImpl: updateProfileLocale,
  };
}

function createCapsuleDependencies() {
  return {
    countCapsulesImpl: countCapsules,
    createCapsuleImpl: createCapsule,
    createCapsuleShareImpl: createCapsuleShare,
    deleteCapsuleImpl: deleteCapsule,
    duplicateCapsuleImpl: duplicateCapsule,
    generateCapsuleReportImpl: generateCapsuleReportWithStoreLookups,
    getCapsuleImpl: getCapsule,
    getSharedCapsuleImpl: getSharedCapsule,
    importSharedCapsuleImpl: importSharedCapsule,
    listRecentCapsulesImpl: listRecentCapsules,
    renameCapsuleImpl: renameCapsule,
    revertCapsuleImpl: revertCapsule,
    saveCapsuleImpl: saveCapsule,
    searchCapsulesImpl: searchCapsules,
    setCapsulePinImpl: setCapsulePin,
    updateCapsuleReportImpl: updateCapsuleReport,
    updateCapsuleSnapshotImpl: updateCapsuleSnapshot,
    validateCapsuleAnchorItemsImpl: (email, anchorItemRefs) =>
      validateCapsuleAnchorItems({
        email,
        anchorItemRefs,
        deps: {
          getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
          listWardrobeItemsByIdsImpl: listWardrobeItemsByIdsForEmail,
        },
      }),
  };
}

function createOutfitDependencies() {
  return {
    countOutfitsImpl: countOutfits,
    createOutfitImpl: createOutfit,
    deleteOutfitImpl: deleteOutfit,
    deleteOutfitImageHandler: deleteOutfitImage,
    deleteOutfitSetImageHandler: deleteOutfitSetImage,
    duplicateOutfitImpl: duplicateOutfit,
    generateOutfitReportImpl: generateOutfitReportWithStoreLookups,
    getOutfitImpl: getOutfit,
    listRecentOutfitsImpl: listRecentOutfits,
    renameOutfitImpl: renameOutfit,
    revertOutfitImpl: revertOutfit,
    saveOutfitImpl: saveOutfit,
    searchOutfitsImpl: searchOutfits,
    setOutfitPinImpl: setOutfitPin,
    updateOutfitReportImpl: updateOutfitReport,
    updateOutfitSnapshotImpl: updateOutfitSnapshot,
  };
}

function createSearchMcpDependencies() {
  return {
    consumeMcpAuthorizationCodeImpl: consumeMcpAuthorizationCode,
    getMcpRefreshTokenImpl: getMcpRefreshToken,
    getMcpRegisteredClientImpl: getMcpRegisteredClient,
    getSavedSearchImpl: getSavedSearch,
    getSearchOptionsImpl: getSearchOptions,
    getSearchStatsImpl: getSearchStats,
    hasActiveMcpGrantImpl: hasActiveMcpGrant,
    insertMcpAuthorizationCodeImpl: insertMcpAuthorizationCode,
    insertMcpRefreshTokenImpl: insertMcpRefreshToken,
    insertMcpRegisteredClientImpl: insertMcpRegisteredClient,
    markSearchProductOptionsStaleImpl: markSearchProductOptionsStale,
    revokeMcpRefreshTokenImpl: revokeMcpRefreshToken,
    rotateMcpRefreshTokenImpl: rotateMcpRefreshToken,
    runMcpProductSearchImpl: runMcpProductSearch,
    runSavedSearchImpl: runSavedSearch,
    upsertMcpGrantImpl: upsertMcpGrant,
  };
}

function createSearchCacheInvalidationDependencies(deps: {
  markSearchProductOptionsStaleImpl: () => void;
  nodeEnv: string;
}) {
  if (deps.nodeEnv === "test" || E2E_SERVER) {
    return {
      startSearchCacheInvalidationImpl: async () => undefined,
      stopSearchCacheInvalidationImpl: async () => undefined,
    };
  }

  const service = createSearchCacheInvalidationService({
    markStale: deps.markSearchProductOptionsStaleImpl,
  });
  return {
    startSearchCacheInvalidationImpl: service.start,
    stopSearchCacheInvalidationImpl: service.stop,
  };
}

function createPasskeyOAuthDependencies() {
  return {
    consumePasskeyChallengeImpl: consumePasskeyChallenge,
    deletePasskeyByIdForEmailImpl: deletePasskeyByIdForEmail,
    generateAuthenticationOptionsImpl: generateAuthenticationOptions,
    generateRegistrationOptionsImpl: generateRegistrationOptions,
    getPasskeyByCredentialIdImpl: getPasskeyByCredentialId,
    insertPasskeyChallengeImpl: insertPasskeyChallenge,
    insertPasskeyImpl: insertPasskey,
    listPasskeysImpl: listPasskeysByEmail,
    passkeyOrigin: PASSKEY_ORIGIN,
    passkeyRpId: PASSKEY_RP_ID,
    passkeyRpName: PASSKEY_RP_NAME,
    updatePasskeyAuthenticationImpl: updatePasskeyAuthentication,
    verifyAuthenticationResponseImpl: verifyAuthenticationResponse,
    verifyRegistrationResponseImpl: verifyRegistrationResponse,
  };
}

function createWardrobeMediaDependencies() {
  const deps = {
    buildWardrobePdfInChildImpl: buildWardrobePdfInChild,
    countWardrobeItemsImpl: countWardrobeItemsByEmail,
    copyImageObjectToR2Impl: copyImageObjectToR2,
    deleteLikedItemImpl: deleteLikedItemByUrl,
    deletePersonalItemsReportImpl: deletePersonalItemsReportByEmail,
    deleteWardrobeItemFromCatalogImpl: deleteWardrobeItemFromCatalogByUrl,
    generatePersonalItemsReportImpl:
      generatePersonalItemsReportWithStoreLookups,
    generateCapsuleWardrobeImpl: generateCapsuleWardrobe,
    generateSwimwearAdditionImpl: generateSwimwearAddition,
    getPersonalItemsReportImpl: getPersonalItemsReportByEmail,
    getProductByIdForEmailImpl: getProductByIdForEmail,
    getProductByUrlForEmailImpl: getProductByUrlForEmail,
    getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
    getProductsByUrlsInOrderImpl: getProductsByUrlsInOrder,
    getUploadedWardrobeItemImpl: getUploadedWardrobeItemById,
    listLikedItemUrlsForUrlsImpl: listLikedItemUrlsForUrlsByEmail,
    listLikedItemUrlsImpl: listLikedItemUrlsByEmail,
    listWardrobeItemsByIdsImpl: listWardrobeItemsByIdsForEmail,
    listWardrobeItemsByUrlsImpl: listWardrobeItemsByUrlsForEmail,
    listWardrobeItemsImpl: listWardrobeItemsByEmail,
    listWardrobeItemsPageImpl: listWardrobeItemsPageByEmail,
    listUploadedWardrobeR2KeysImpl: listUploadedWardrobeR2KeysByEmail,
    normalizeWardrobeUploadImagesInChildImpl:
      normalizeWardrobeUploadImagesInChild,
    processWardrobeUploadFilesInChildImpl: processWardrobeUploadFilesInChild,
    processWardrobeUploadUrlsInChildImpl: processWardrobeUploadUrlsInChild,
    saveUploadedWardrobeItemsImpl: saveUploadedWardrobeItemsByEmail,
    saveWardrobeItemFromCatalogImpl: saveWardrobeItemFromCatalogByUrl,
    shouldCompleteSelectedSwimwearImpl: shouldCompleteSelectedSwimwear,
    shouldGenerateSwimwearImpl: shouldGenerateSwimwear,
    buildCapsuleEventSnapshotImpl: buildCapsuleEventSnapshot,
    publishSnapshotImpl: () => undefined,
    randomUuidImpl: () => crypto.randomUUID(),
    regenerateCapsuleWardrobeImpl: regenerateCapsuleWardrobe,
    setTimeoutImpl: setTimeout,
    nowMsImpl: () => Date.now(),
    updateUploadedWardrobeItemDetailsImpl:
      updateUploadedWardrobeItemDetailsById,
    updateUploadedWardrobeItemMetadataImpl:
      updateUploadedWardrobeItemMetadataById,
    upsertLikedItemImpl: upsertLikedItemByUrl,
    ...createWardrobeImageStorageDependencies(),
  };
  return {
    ...deps,
    processQueuedWardrobeFileUploadImpl: (input) =>
      processQueuedWardrobeFileUploadImpl({ context: deps, ...input }),
    processQueuedWardrobeUrlUploadImpl: (input) =>
      processQueuedWardrobeUrlUpload({ context: deps, ...input }),
    runCapsuleGenerationJobImpl: (input) =>
      runPersistedWardrobeGenerationJobForService(input.deps, input),
    runOutfitImageGenerationJobImpl: runOutfitImageGenerationJob,
    runOutfitSetImageGenerationJobImpl: runOutfitSetImageGenerationJob,
    runSelectedRegenerationJobImpl: (input) =>
      runPersistedPartialRegenerationJobForService(input.deps, input),
  };
}

function createDefaultAppDependencies(googleClientId: string | null) {
  const baseDeps = {
    ...createRuntimeDependencies(googleClientId),
    ...createAuthSessionDependencies(),
    ...createProfileOptionDependencies(),
    ...createCapsuleDependencies(),
    ...createOutfitDependencies(),
    ...createSearchMcpDependencies(),
    ...createPasskeyOAuthDependencies(),
    ...createWardrobeMediaDependencies(),
    ...createAccountCleanupDependencies(),
  };
  const deps = {
    ...baseDeps,
    ...createSearchCacheInvalidationDependencies(baseDeps),
    ...createJobDependencies(baseDeps),
  };
  return {
    ...deps,
    buildInternalMetricsSnapshotImpl: () =>
      buildInternalMetricsSnapshot({
        getJobMetricsImpl: deps.getJobMetricsImpl,
        releaseMetadata: deps.releaseMetadata,
      }),
  };
}

export function createAppDependencies(options: Record<string, unknown> = {}) {
  const googleClientId =
    options.googleClientId === undefined
      ? GOOGLE_CLIENT_ID
      : (options.googleClientId as string | null);
  return {
    ...createDefaultAppDependencies(googleClientId),
    ...options,
    googleAuthClient: resolveGoogleAuthClient({ ...options, googleClientId }),
  };
}
