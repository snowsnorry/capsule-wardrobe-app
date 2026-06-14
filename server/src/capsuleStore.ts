import {
  countCapsulesByEmail,
  createCapsuleRecord,
  deleteCapsuleByIdForEmail,
  getCapsuleByIdForEmail,
  getValidSharedCapsuleById,
  hashCapsuleContent,
  listCapsuleNamesByEmail,
  listRecentCapsulesByEmail,
  pruneExpiredSharedCapsules,
  renameCapsuleByIdForEmail,
  revertCapsuleDraftByIdForEmail,
  saveCapsuleByIdForEmail,
  searchCapsulesByEmail,
  updateCapsuleReportByIdForEmail,
  updateCapsuleSnapshotByIdForEmail,
  upsertSharedCapsule,
} from "./db.js";
import { getProfile } from "./profileStore.js";
import {
  buildCapsuleSnapshotWithRegeneration,
  getCapsuleSnapshotRegeneration,
  getEffectiveCapsuleSnapshot,
  normalizeCapsuleFilters,
  normalizeCapsuleSnapshot,
} from "./capsuleStoreModel.js";
import { buildSharedCapsuleOgMetadata } from "./capsuleShareMetadata.js";
import {
  buildProfileCapsuleContext,
  buildSnapshotFromProfile,
} from "./capsuleStoreContext.js";
import { createCapsuleStoreOperations } from "./capsuleStoreOperations.js";
import type { CapsuleStoreDeps } from "./capsuleStoreDeps.js";

function createDefaultCapsuleStoreDeps(): Required<CapsuleStoreDeps> {
  return {
    createCapsuleRecordImpl: createCapsuleRecord,
    countCapsulesByEmailImpl: countCapsulesByEmail,
    deleteCapsuleByIdForEmailImpl: deleteCapsuleByIdForEmail,
    getCapsuleByIdForEmailImpl: getCapsuleByIdForEmail,
    getProfileImpl: getProfile,
    getValidSharedCapsuleByIdImpl: getValidSharedCapsuleById,
    hashCapsuleContentImpl: hashCapsuleContent,
    listCapsuleNamesByEmailImpl: listCapsuleNamesByEmail,
    listRecentCapsulesByEmailImpl: listRecentCapsulesByEmail,
    pruneExpiredSharedCapsulesImpl: pruneExpiredSharedCapsules,
    renameCapsuleByIdForEmailImpl: renameCapsuleByIdForEmail,
    revertCapsuleDraftByIdForEmailImpl: revertCapsuleDraftByIdForEmail,
    saveCapsuleByIdForEmailImpl: saveCapsuleByIdForEmail,
    searchCapsulesByEmailImpl: searchCapsulesByEmail,
    updateCapsuleReportByIdForEmailImpl: updateCapsuleReportByIdForEmail,
    updateCapsuleSnapshotByIdForEmailImpl: updateCapsuleSnapshotByIdForEmail,
    upsertSharedCapsuleImpl: upsertSharedCapsule,
    nowImpl: Date.now,
  };
}

function resolveCapsuleStoreDeps(
  deps: CapsuleStoreDeps,
): Required<CapsuleStoreDeps> {
  return {
    ...createDefaultCapsuleStoreDeps(),
    ...Object.fromEntries(
      Object.entries(deps).filter(([, value]) => value !== undefined),
    ),
  } as Required<CapsuleStoreDeps>;
}

function createCapsuleStore(deps: CapsuleStoreDeps = {}) {
  return createCapsuleStoreOperations(resolveCapsuleStoreDeps(deps));
}

const defaultCapsuleStore = createCapsuleStore();

const {
  createCapsule,
  createCapsuleShare,
  deleteCapsule,
  duplicateCapsule,
  getCapsule,
  getSharedCapsule,
  getSharedCapsuleOgMetadata,
  importSharedCapsule,
  listRecentCapsules,
  countCapsules,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  updateCapsuleReport,
  updateCapsuleSnapshot,
  renameCapsule,
} = defaultCapsuleStore;

export {
  buildCapsuleSnapshotWithRegeneration,
  buildSharedCapsuleOgMetadata,
  buildSnapshotFromProfile,
  buildProfileCapsuleContext,
  createCapsule,
  createCapsuleShare,
  createCapsuleStore,
  deleteCapsule,
  duplicateCapsule,
  getCapsule,
  getEffectiveCapsuleSnapshot,
  getCapsuleSnapshotRegeneration,
  getSharedCapsule,
  getSharedCapsuleOgMetadata,
  importSharedCapsule,
  listRecentCapsules,
  countCapsules,
  normalizeCapsuleFilters,
  normalizeCapsuleSnapshot,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  updateCapsuleReport,
  updateCapsuleSnapshot,
  renameCapsule,
};
