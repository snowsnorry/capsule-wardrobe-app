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

function createGetPersistedCapsuleJob(listActiveJobSnapshotsForEntityImpl) {
  return async (email, capsuleId, kinds) => {
    const jobs = await listActiveJobSnapshotsForEntityImpl({
      email,
      entityType: "capsule",
      entityId: capsuleId,
      kinds,
    });
    return jobs[0] || null;
  };
}

function createGetPersistedOutfitJob(listActiveJobSnapshotsForEntityImpl) {
  return async (email, outfitId, kinds) => {
    const jobs = await listActiveJobSnapshotsForEntityImpl({
      email,
      entityType: "outfit",
      entityId: outfitId,
      kinds,
    });
    return jobs[0] || null;
  };
}

function createGetPersistedOutfitSetImageJob(listActiveJobsForEntityImpl) {
  return async (email, capsuleId) => {
    const jobs = await listActiveJobsForEntityImpl({
      email,
      entityType: "capsule",
      entityId: capsuleId,
      kinds: ["outfitSetImageGenerate"],
    });
    const pendingSetIndexes = jobs
      .map((job) => Number.parseInt(String(job.payload?.setIndex), 10))
      .filter((value) => Number.isInteger(value) && value >= 0);
    return pendingSetIndexes.length > 0
      ? { status: "pending", pendingSetIndexes }
      : null;
  };
}

export function createAppRouteContext(deps) {
  const limiters = createRateLimiters();
  const guards = createRequestGuards({
    nodeEnv: deps.nodeEnv,
    clientOrigin: deps.clientOrigin,
    getSessionImpl: deps.getSessionImpl,
  });
  const listActiveJobSnapshotsForEntityImpl =
    deps.listActiveJobSnapshotsForEntityImpl || (async () => []);
  const listActiveJobsForEntityImpl =
    deps.listActiveJobsForEntityImpl || (async () => []);
  const getPersistedCapsuleJob = createGetPersistedCapsuleJob(
    listActiveJobSnapshotsForEntityImpl,
  );
  const getPersistedOutfitJob = createGetPersistedOutfitJob(
    listActiveJobSnapshotsForEntityImpl,
  );
  const eventHandlers = createCapsuleEventHandlers({
    getOutfitSetImageJobImpl:
      deps.getOutfitSetImageJobImpl ||
      createGetPersistedOutfitSetImageJob(listActiveJobsForEntityImpl),
    getPartialRegenerationJobImpl:
      deps.getPartialRegenerationJobImpl ||
      ((email, capsuleId) =>
        getPersistedCapsuleJob(email, capsuleId, [
          "capsuleRegenerateSelected",
        ])),
    getWardrobeJobImpl:
      deps.getWardrobeJobImpl ||
      ((email, capsuleId) =>
        getPersistedCapsuleJob(email, capsuleId, ["capsuleGenerate"])),
    updateCapsuleSnapshotImpl: deps.updateCapsuleSnapshotImpl,
  });

  return {
    ...deps,
    getOutfitImageJobImpl:
      deps.getOutfitImageJobImpl ||
      ((email, outfitId) =>
        getPersistedOutfitJob(email, outfitId, ["outfitImageGenerate"])),
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
