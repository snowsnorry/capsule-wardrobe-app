import "dotenv/config";
import express from "express";
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
  updateProfileActiveCapsuleId,
} from "./profileStore.js";
import {
  createCapsule,
  createCapsuleShare,
  deleteCapsule,
  duplicateCapsule,
  getCapsule,
  getEffectiveCapsuleSnapshot,
  getSharedCapsule,
  importSharedCapsule,
  listRecentCapsules,
  normalizeCapsuleSnapshot,
  renameCapsule,
  resolveActiveCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  setActiveCapsuleId,
  updateCapsuleSnapshot,
} from "./capsuleStore.js";
import {
  getSearchOptions,
  getSavedSearch,
  getSearchStats,
  runSavedSearch,
} from "./searchStore.js";
import { getWardrobeJob, regenerateCapsuleWardrobe } from "./ai/ai.js";
import {
  getPartialRegenerationJob,
  regenerateSelectedWardrobeItems,
} from "./ai/regenerateSelected.js";
import {
  deleteOutfitSetImage,
  generateOutfitSetImage,
  getOutfitSetImageJob,
} from "./ai/outfitSetImages.js";
import {
  buildCapsuleEventSnapshot,
  capsuleEventHub,
} from "./ai/capsuleEvents.js";
import { buildWardrobePdfInChild } from "./wardrobePdf.js";
import {
  checkDatabaseConnection,
  consumePasskeyChallenge,
  deletePasskeyByIdForEmail,
  deleteUploadedWardrobeItemById,
  deleteWardrobeItemFromCatalogByUrl,
  getPasskeyByCredentialId,
  getProductsByUrlsInOrder,
  listWardrobeItemsByEmail,
  saveUploadedWardrobeItemsByEmail,
  saveWardrobeItemFromCatalogByUrl,
  updateUploadedWardrobeItemDetailsById,
  updateUploadedWardrobeItemMetadataById,
  insertPasskey,
  insertPasskeyChallenge,
  listPasskeysByEmail,
  pruneExpiredPasskeyChallenges,
  updatePasskeyAuthentication,
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
  normalizeProfileSettingsPayload,
  toProfileResponse,
} from "./profileHttp.js";
import {
  buildCapsuleDraftFromFilters,
  buildPdfDownloadFilename,
  getCapsuleItems,
  getValidatedRejectedUrls,
  hasOwnProperty,
  hasUnexpectedCapsuleCreateFields,
  hasUnexpectedCapsuleFiltersFields,
  hasUnexpectedRejectedUrlsFields,
  annotateWardrobeSavedItems,
  isTruthyQueryFlag,
  toCapsuleResponse,
  toCapsuleSummary,
} from "./capsuleHttp.js";
import { createStartServer } from "./serverStartup.js";
import { uploadWardrobeImageToR2 } from "./r2Storage.js";
import { deleteObjectsFromR2 } from "./r2Delete.js";
import { normalizeWardrobeUploadImagesInChild } from "./wardrobeUploadImagesRunner.js";
import { analyzeWardrobeImageUrl } from "./wardrobeImageAnalysis.js";
import { cleanupUploadedWardrobeItemImage } from "./wardrobeImageCleanup.js";
import { createUploadedWardrobeItemEmbedding } from "./wardrobeSemanticEmbedding.js";
import {
  applyCorsMiddleware,
  applySecurityMiddleware,
  createRateLimiters,
  createRequestGuards,
} from "./appMiddleware.js";
import { createCapsuleEventHandlers } from "./capsuleEventHttp.js";
import { registerPasskeyRoutes } from "./routes/passkeyRoutes.js";
import { registerProfileReadRoutes } from "./routes/profileReadRoutes.js";
import { registerCapsuleReadRoutes } from "./routes/capsuleReadRoutes.js";
import { registerCapsuleMutationRoutes } from "./routes/capsuleMutationRoutes.js";
import { registerSearchRoutes } from "./routes/searchRoutes.js";
import { registerProfileMutationRoutes } from "./routes/profileMutationRoutes.js";
import { registerHealthImageRoutes } from "./routes/healthImageRoutes.js";
import { registerSessionAuthRoutes } from "./routes/sessionAuthRoutes.js";
import { registerWardrobeRoutes } from "./routes/wardrobeRoutes.js";
import { logError, logInfo } from "./logger.js";

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
    cleanupUploadedWardrobeItemImageImpl: cleanupUploadedWardrobeItemImage,
    createUploadedWardrobeItemEmbeddingImpl:
      createUploadedWardrobeItemEmbedding,
    deleteR2ObjectsImpl: deleteObjectsFromR2,
    deleteUploadedWardrobeItemImpl: deleteUploadedWardrobeItemById,
    uploadWardrobeImageToR2Impl: uploadWardrobeImageToR2,
  };
}

function createAppDependencies(options: Record<string, unknown> = {}) {
  const googleClientId =
    options.googleClientId === undefined
      ? GOOGLE_CLIENT_ID
      : (options.googleClientId as string | null);
  return {
    authTestMode: AUTH_TEST_MODE,
    buildWardrobePdfInChildImpl: buildWardrobePdfInChild,
    checkDatabaseConnectionImpl: checkDatabaseConnection,
    clientOrigin: CLIENT_ORIGIN,
    consumePasskeyChallengeImpl: consumePasskeyChallenge,
    createCapsuleImpl: createCapsule,
    createCapsuleShareImpl: createCapsuleShare,
    createPendingCodeImpl: createPendingCode,
    createProfileImpl: createProfile,
    createSessionImpl: createSession,
    deleteCapsuleImpl: deleteCapsule,
    deleteOutfitSetImageHandler: deleteOutfitSetImage,
    deletePasskeyByIdForEmailImpl: deletePasskeyByIdForEmail,
    deleteProfileImpl: deleteProfile,
    duplicateCapsuleImpl: duplicateCapsule,
    generateAuthenticationOptionsImpl: generateAuthenticationOptions,
    generateOutfitSetImageHandler: generateOutfitSetImage,
    generateRegistrationOptionsImpl: generateRegistrationOptions,
    getAudienceOptionsImpl: getAudienceOptions,
    getCapsuleImpl: getCapsule,
    getFormalityLevelsImpl: getFormalityLevels,
    getOccasionsImpl: getOccasions,
    getOutfitSetImageJobImpl: getOutfitSetImageJob,
    getPartialRegenerationJobImpl: getPartialRegenerationJob,
    getPasskeyByCredentialIdImpl: getPasskeyByCredentialId,
    getPatternOptionsImpl: getPatternOptions,
    getProductsByUrlsInOrderImpl: getProductsByUrlsInOrder,
    getProfileImpl: getProfile,
    getSavedSearchImpl: getSavedSearch,
    getSearchOptionsImpl: getSearchOptions,
    getSearchStatsImpl: getSearchStats,
    getSeasonsImpl: getSeasons,
    getSessionImpl: getSession,
    getSharedCapsuleImpl: getSharedCapsule,
    getStylesImpl: getStyles,
    getWardrobeJobImpl: getWardrobeJob,
    googleClientId,
    importSharedCapsuleImpl: importSharedCapsule,
    insertPasskeyChallengeImpl: insertPasskeyChallenge,
    insertPasskeyImpl: insertPasskey,
    deleteWardrobeItemFromCatalogImpl: deleteWardrobeItemFromCatalogByUrl,
    listPasskeysImpl: listPasskeysByEmail,
    listWardrobeItemsImpl: listWardrobeItemsByEmail,
    listRecentCapsulesImpl: listRecentCapsules,
    nodeEnv: NODE_ENV,
    passkeyOrigin: PASSKEY_ORIGIN,
    passkeyRpId: PASSKEY_RP_ID,
    passkeyRpName: PASSKEY_RP_NAME,
    pruneExpiredPasskeyChallengesImpl: pruneExpiredPasskeyChallenges,
    regenerateCapsuleWardrobeHandler: regenerateCapsuleWardrobe,
    regenerateSelectedCapsuleItemsHandler: regenerateSelectedWardrobeItems,
    renameCapsuleImpl: renameCapsule,
    resolveActiveCapsuleImpl: resolveActiveCapsule,
    revertCapsuleImpl: revertCapsule,
    revokeSessionImpl: revokeSession,
    runSavedSearchImpl: runSavedSearch,
    saveCapsuleImpl: saveCapsule,
    saveUploadedWardrobeItemsImpl: saveUploadedWardrobeItemsByEmail,
    saveWardrobeItemFromCatalogImpl: saveWardrobeItemFromCatalogByUrl,
    searchCapsulesImpl: searchCapsules,
    sendLoginCodeEmailImpl: sendLoginCodeEmail,
    setActiveCapsuleIdImpl: setActiveCapsuleId,
    streamCapsuleEventsImpl: capsuleEventHub.subscribe,
    updateCapsuleSnapshotImpl: updateCapsuleSnapshot,
    updatePasskeyAuthenticationImpl: updatePasskeyAuthentication,
    updateProfileActiveCapsuleIdImpl: updateProfileActiveCapsuleId,
    updateProfileImpl: updateProfile,
    updateProfileLocaleImpl: updateProfileLocale,
    updateUploadedWardrobeItemDetailsImpl:
      updateUploadedWardrobeItemDetailsById,
    updateUploadedWardrobeItemMetadataImpl:
      updateUploadedWardrobeItemMetadataById,
    ...createWardrobeImageStorageDependencies(),
    normalizeWardrobeUploadImagesInChildImpl:
      normalizeWardrobeUploadImagesInChild,
    verifyAuthenticationResponseImpl: verifyAuthenticationResponse,
    verifyCodeImpl: verifyCode,
    verifyRegistrationResponseImpl: verifyRegistrationResponse,
    ...options,
    googleAuthClient: resolveGoogleAuthClient({ ...options, googleClientId }),
  };
}

function createExpressApp(deps) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "100kb" }));
  applySecurityMiddleware(app, deps.nodeEnv);
  applyCorsMiddleware(app, {
    nodeEnv: deps.nodeEnv,
    clientOrigin: deps.clientOrigin,
  });
  return app;
}

function createAppRouteContext(deps) {
  const limiters = createRateLimiters();
  const guards = createRequestGuards({
    nodeEnv: deps.nodeEnv,
    clientOrigin: deps.clientOrigin,
    getSessionImpl: deps.getSessionImpl,
  });
  const eventHandlers = createCapsuleEventHandlers({
    getCapsuleImpl: deps.getCapsuleImpl,
    getOutfitSetImageJobImpl: deps.getOutfitSetImageJobImpl,
    getPartialRegenerationJobImpl: deps.getPartialRegenerationJobImpl,
    getWardrobeJobImpl: deps.getWardrobeJobImpl,
    streamCapsuleEventsImpl: deps.streamCapsuleEventsImpl,
    updateCapsuleSnapshotImpl: deps.updateCapsuleSnapshotImpl,
  });

  return {
    ...deps,
    ...limiters,
    ...guards,
    ...eventHandlers,
    buildCapsuleDraftFromFilters,
    buildCapsuleEventSnapshot,
    buildPdfDownloadFilename,
    getCapsuleItems,
    getEffectiveCapsuleSnapshot,
    getValidatedRejectedUrls,
    hasOwnProperty,
    hasUnexpectedCapsuleCreateFields,
    hasUnexpectedCapsuleFiltersFields,
    hasUnexpectedRejectedUrlsFields,
    annotateWardrobeSavedItems,
    isTruthyQueryFlag,
    normalizeCapsuleSnapshot,
    normalizeProfileSettingsPayload,
    toCapsuleResponse,
    toCapsuleSummary,
    toProfileResponse,
  };
}

function registerAuthenticationRoutes(app, routeContext) {
  registerSessionAuthRoutes(app, routeContext);
  registerPasskeyRoutes(app, routeContext);
}

function registerDomainRoutes(app, routeContext) {
  registerProfileReadRoutes(app, routeContext);
  registerWardrobeRoutes(app, routeContext);
  registerCapsuleReadRoutes(app, routeContext);
  registerCapsuleMutationRoutes(app, routeContext);
  registerSearchRoutes(app, routeContext);
  registerProfileMutationRoutes(app, routeContext);
  registerHealthImageRoutes(app, routeContext);
}

function createApp(options = {}) {
  const deps = createAppDependencies(options);
  const app = createExpressApp(deps);
  const routeContext = createAppRouteContext(deps);
  registerAuthenticationRoutes(app, routeContext);
  registerDomainRoutes(app, routeContext);
  return app;
}

const app = createApp();
const startServer = createStartServer(app);

if (process.env.NODE_ENV !== "test" && process.env.E2E_SERVER !== "true") {
  startServer().catch((error) => {
    logError("[server/start]", error);
    process.exitCode = 1;
  });
}

export { app, createApp, startServer };
