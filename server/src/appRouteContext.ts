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
import {
  getOutfitItems,
  hasUnexpectedOutfitCreateFields,
  hasUnexpectedOutfitItemsFields,
  toOutfitResponse,
  toOutfitSummary,
} from "./outfitHttp.js";
import {
  normalizeProfileSettingsPayload,
  toProfileResponse,
} from "./profileHttp.js";
import {
  getEffectiveCapsuleSnapshot,
  normalizeCapsuleSnapshot,
} from "./capsuleStore.js";
import { buildCapsuleEventSnapshot } from "./ai/capsuleEvents.js";
import { createCapsuleEventHandlers } from "./capsuleEventHttp.js";
import { createRateLimiters, createRequestGuards } from "./appMiddleware.js";
import { annotateLikedItems } from "./routes/likedItemsRoutes.js";

export function createAppRouteContext(deps) {
  const limiters = createRateLimiters();
  const guards = createRequestGuards({
    nodeEnv: deps.nodeEnv,
    clientOrigin: deps.clientOrigin,
    getSessionImpl: deps.getSessionImpl,
  });
  const eventHandlers = createCapsuleEventHandlers({
    annotateLikedItems,
    getCapsuleImpl: deps.getCapsuleImpl,
    getOutfitSetImageJobImpl: deps.getOutfitSetImageJobImpl,
    getPartialRegenerationJobImpl: deps.getPartialRegenerationJobImpl,
    getWardrobeJobImpl: deps.getWardrobeJobImpl,
    listLikedItemUrlsImpl: deps.listLikedItemUrlsImpl,
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
    getOutfitItems,
    getEffectiveCapsuleSnapshot,
    getValidatedRejectedUrls,
    hasOwnProperty,
    hasUnexpectedCapsuleCreateFields,
    hasUnexpectedCapsuleFiltersFields,
    hasUnexpectedOutfitCreateFields,
    hasUnexpectedOutfitItemsFields,
    hasUnexpectedRejectedUrlsFields,
    annotateWardrobeSavedItems,
    annotateLikedItems,
    isTruthyQueryFlag,
    normalizeCapsuleSnapshot,
    normalizeProfileSettingsPayload,
    toCapsuleResponse,
    toCapsuleSummary,
    toOutfitResponse,
    toOutfitSummary,
    toProfileResponse,
  };
}
