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
import { generatePersonalItemsReport } from "./ai/personalItemsReportService.js";
import { capsuleEventHub } from "./ai/capsuleEvents.js";
import { outfitEventHub } from "./ai/outfitEvents.js";
import { buildWardrobePdfInChild } from "./wardrobePdf.js";
import { deleteWardrobePdfJob } from "./wardrobePdfJobRegistry.js";
import {
  checkDatabaseConnection,
  consumeMcpAuthorizationCode,
  clearJobRunsForEmail,
  consumePasskeyChallenge,
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
  listUploadedWardrobeR2KeysByEmail,
  listLikedItemUrlsByEmail,
  saveUploadedWardrobeItemsByEmail,
  saveWardrobeItemFromCatalogByUrl,
  upsertPersonalItemsReportByEmail,
  updateUploadedWardrobeItemDetailsById,
  updateUploadedWardrobeItemMetadataById,
  listPasskeysByEmail,
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
  E2E_SERVER,
  GOOGLE_CLIENT_ID,
  JOB_QUEUE_BACKEND,
  JOB_WORKER_ENABLED,
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
import { processQueuedWardrobeFileUploadImpl } from "./routes/wardrobeFileUploadRoute.js";
import { processQueuedWardrobeUrlUpload } from "./routes/wardrobeUrlUploadRoute.js";
import { analyzeWardrobeImageUrl } from "./wardrobeImageAnalysis.js";
import { cleanupUploadedWardrobeItemImage } from "./wardrobeImageCleanup.js";
import { createUploadedWardrobeItemEmbedding } from "./wardrobeSemanticEmbedding.js";
import { validateCapsuleAnchorItems } from "./capsuleAnchors.js";
import { createMcpOAuthConfig } from "./mcp/oauthConfig.js";
import { logInfo } from "./logger.js";
import { annotateLikedItems } from "./routes/likedItemsRoutes.js";
import { createJobQueue } from "./jobs/jobQueue.js";
import { createJobWorker } from "./jobs/jobWorker.js";
import {
  getOwnedJobSnapshot,
  listOwnedJobSnapshots,
  replayJobEvents,
} from "./jobs/jobStore.js";
import { createInMemoryJobService } from "./jobs/inMemoryJobService.js";

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
    regenerateCapsuleWardrobeHandler: regenerateCapsuleWardrobe,
    regenerateSelectedCapsuleItemsHandler: regenerateSelectedWardrobeItems,
    renameCapsuleImpl: renameCapsule,
    revertCapsuleImpl: revertCapsule,
    saveCapsuleImpl: saveCapsule,
    searchCapsulesImpl: searchCapsules,
    setCapsulePinImpl: setCapsulePin,
    streamCapsuleEventsImpl: capsuleEventHub.subscribe,
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
    generateOutfitImageHandler: generateOutfitImage,
    generateOutfitReportImpl: generateOutfitReportWithStoreLookups,
    generateOutfitSetImageHandler: generateOutfitSetImage,
    getOutfitImpl: getOutfit,
    getOutfitImageJobImpl: getOutfitImageJob,
    getOutfitSetImageJobImpl: getOutfitSetImageJob,
    listRecentOutfitsImpl: listRecentOutfits,
    renameOutfitImpl: renameOutfit,
    revertOutfitImpl: revertOutfit,
    saveOutfitImpl: saveOutfit,
    searchOutfitsImpl: searchOutfits,
    setOutfitPinImpl: setOutfitPin,
    streamOutfitEventsImpl: outfitEventHub.subscribe,
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
    copyImageObjectToR2Impl: copyImageObjectToR2,
    deleteLikedItemImpl: deleteLikedItemByUrl,
    deletePersonalItemsReportImpl: deletePersonalItemsReportByEmail,
    deleteWardrobeItemFromCatalogImpl: deleteWardrobeItemFromCatalogByUrl,
    generatePersonalItemsReportImpl:
      generatePersonalItemsReportWithStoreLookups,
    getPersonalItemsReportImpl: getPersonalItemsReportByEmail,
    getPartialRegenerationJobImpl: getPartialRegenerationJob,
    getProductByIdForEmailImpl: getProductByIdForEmail,
    getProductByUrlForEmailImpl: getProductByUrlForEmail,
    getProductsByUrlsForEmailImpl: getProductsByUrlsForEmailInOrder,
    getProductsByUrlsInOrderImpl: getProductsByUrlsInOrder,
    getUploadedWardrobeItemImpl: getUploadedWardrobeItemById,
    getWardrobeJobImpl: getWardrobeJob,
    listLikedItemUrlsImpl: listLikedItemUrlsByEmail,
    listWardrobeItemsByIdsImpl: listWardrobeItemsByIdsForEmail,
    listWardrobeItemsByUrlsImpl: listWardrobeItemsByUrlsForEmail,
    listWardrobeItemsImpl: listWardrobeItemsByEmail,
    listUploadedWardrobeR2KeysImpl: listUploadedWardrobeR2KeysByEmail,
    normalizeWardrobeUploadImagesInChildImpl:
      normalizeWardrobeUploadImagesInChild,
    processWardrobeUploadFilesInChildImpl: processWardrobeUploadFilesInChild,
    processWardrobeUploadUrlsInChildImpl: processWardrobeUploadUrlsInChild,
    saveUploadedWardrobeItemsImpl: saveUploadedWardrobeItemsByEmail,
    saveWardrobeItemFromCatalogImpl: saveWardrobeItemFromCatalogByUrl,
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
  };
}

async function clearAccountTransientState(email: string) {
  clearWardrobeJobsForEmail(email);
  clearPartialRegenerationJobsForEmail(email);
  clearOutfitSetImageJobsForEmail(email);
  clearOutfitImageJobsForEmail(email);
  deleteWardrobePdfJob(email);
  await clearJobRunsForEmail(email);
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

function generatePersonalItemsReportWithStoreLookups(
  email: string,
  personalItemsContext?: string | null,
) {
  return generatePersonalItemsReport(email, personalItemsContext, {
    listWardrobeItemsImpl: listWardrobeItemsByEmail,
    upsertPersonalItemsReportImpl: upsertPersonalItemsReportByEmail,
  });
}

function createAccountCleanupDependencies() {
  return {
    clearAccountTransientStateImpl: clearAccountTransientState,
  };
}

function createJobDependencies(deps: Record<string, unknown>) {
  if (NODE_ENV === "test" || E2E_SERVER) {
    return createInMemoryJobService();
  }
  if (JOB_QUEUE_BACKEND !== "pg_boss") {
    throw new Error(`unsupported_job_queue_backend:${JOB_QUEUE_BACKEND}`);
  }

  const queue = createJobQueue();
  const worker = createJobWorker({
    backend: queue.backend,
    deps,
    enabled: JOB_WORKER_ENABLED,
    reconcilePendingProviderJobs: queue.reconcilePendingProviderJobs,
  });
  return {
    enqueueJobImpl: queue.enqueue,
    getJobSnapshotImpl: getOwnedJobSnapshot,
    listJobEventsAfterImpl: replayJobEvents,
    listJobSnapshotsImpl: listOwnedJobSnapshots,
    startJobWorkersImpl: worker.start,
    stopJobWorkersImpl: worker.stop,
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
  return {
    ...baseDeps,
    ...createSearchCacheInvalidationDependencies(baseDeps),
    ...createJobDependencies(baseDeps),
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
