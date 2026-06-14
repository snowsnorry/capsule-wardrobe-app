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
  DEFAULT_CAPSULE_NAME,
  buildCapsuleSnapshotWithRegeneration,
  getCapsuleSnapshotRegeneration,
  getEffectiveCapsuleSnapshot,
  normalizeCapsuleFilters,
  normalizeCapsuleRecord,
  normalizeCapsuleSnapshot,
  type NormalizedCapsuleRecord,
  type SharedCapsuleMetadata,
  type SharedCapsuleOgMetadata,
  type SharedCapsuleResult,
} from "./capsuleStoreModel.js";
import { buildSharedCapsuleOgMetadata } from "./capsuleShareMetadata.js";
import {
  createCapsuleShareForStore,
  getSharedCapsuleForStore,
  getSharedCapsuleOgMetadataForStore,
  importSharedCapsuleForStore,
} from "./capsuleStoreSharing.js";
import { deleteCapsuleForStore } from "./capsuleStoreDelete.js";
import { buildUniqueCapsuleNameForStore } from "./capsuleStoreNaming.js";
import {
  buildProfileCapsuleContext,
  buildSnapshotFromProfile,
} from "./capsuleStoreContext.js";
import type { CapsuleStoreDeps } from "./capsuleStoreDeps.js";

// eslint-disable-next-line max-lines-per-function, complexity
function createCapsuleStore(deps: CapsuleStoreDeps = {}) {
  const {
    createCapsuleRecordImpl = createCapsuleRecord,
    countCapsulesByEmailImpl = countCapsulesByEmail,
    deleteCapsuleByIdForEmailImpl = deleteCapsuleByIdForEmail,
    getCapsuleByIdForEmailImpl = getCapsuleByIdForEmail,
    getProfileImpl = getProfile,
    getValidSharedCapsuleByIdImpl = getValidSharedCapsuleById,
    hashCapsuleContentImpl = hashCapsuleContent,
    listCapsuleNamesByEmailImpl = listCapsuleNamesByEmail,
    listRecentCapsulesByEmailImpl = listRecentCapsulesByEmail,
    pruneExpiredSharedCapsulesImpl = pruneExpiredSharedCapsules,
    renameCapsuleByIdForEmailImpl = renameCapsuleByIdForEmail,
    revertCapsuleDraftByIdForEmailImpl = revertCapsuleDraftByIdForEmail,
    saveCapsuleByIdForEmailImpl = saveCapsuleByIdForEmail,
    searchCapsulesByEmailImpl = searchCapsulesByEmail,
    updateCapsuleReportByIdForEmailImpl = updateCapsuleReportByIdForEmail,
    updateCapsuleSnapshotByIdForEmailImpl = updateCapsuleSnapshotByIdForEmail,
    upsertSharedCapsuleImpl = upsertSharedCapsule,
    nowImpl = Date.now,
  } = deps;

  async function getCapsule(
    email: string,
    capsuleId: string,
  ): Promise<NormalizedCapsuleRecord | null> {
    return normalizeCapsuleRecord(
      await getCapsuleByIdForEmailImpl({ email, capsuleId }),
    );
  }

  async function listRecentCapsules(
    email: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<NormalizedCapsuleRecord[]> {
    const rows = await listRecentCapsulesByEmailImpl({ email, limit, offset });
    return rows.map(normalizeCapsuleRecord);
  }

  async function countCapsules(email: string): Promise<number> {
    return countCapsulesByEmailImpl(email);
  }

  async function searchCapsules(
    email: string,
    query: string,
    limit: number = 25,
  ): Promise<NormalizedCapsuleRecord[]> {
    const rows = await searchCapsulesByEmailImpl({ email, query, limit });
    return rows.map(normalizeCapsuleRecord);
  }

  async function createCapsule(
    email: string,
    {
      name,
      draft = null,
      saved = null,
    }: {
      name?: string;
      draft?: Record<string, unknown> | null;
      saved?: Record<string, unknown> | null;
    } = {},
  ): Promise<NormalizedCapsuleRecord | null> {
    const resolvedName = await buildUniqueCapsuleNameForStore(
      email,
      name || DEFAULT_CAPSULE_NAME,
      listCapsuleNamesByEmailImpl,
    );
    const capsule = normalizeCapsuleRecord(
      await createCapsuleRecordImpl({
        email,
        name: resolvedName,
        draft: normalizeCapsuleSnapshot(draft),
        saved: normalizeCapsuleSnapshot(saved),
      }),
    );
    return capsule;
  }

  async function createBootstrapCapsule(
    email: string,
  ): Promise<NormalizedCapsuleRecord | null> {
    const profile = await getProfileImpl(email);
    return createCapsule(email, {
      draft: buildSnapshotFromProfile(profile),
    });
  }

  async function resolveActiveCapsule(): Promise<NormalizedCapsuleRecord | null> {
    return null;
  }

  async function updateCapsuleSnapshot(
    email: string,
    capsuleId: string,
    draft: Record<string, unknown> | null,
  ): Promise<NormalizedCapsuleRecord | null> {
    return normalizeCapsuleRecord(
      await updateCapsuleSnapshotByIdForEmailImpl({
        email,
        capsuleId,
        draft: normalizeCapsuleSnapshot(draft),
      }),
    );
  }

  async function updateCapsuleReport(
    email: string,
    capsuleId: string,
    report: Record<string, unknown> | null,
  ): Promise<NormalizedCapsuleRecord | null> {
    return normalizeCapsuleRecord(
      await updateCapsuleReportByIdForEmailImpl({
        email,
        capsuleId,
        report,
      }),
    );
  }

  async function renameCapsule(
    email: string,
    capsuleId: string,
    name: string,
  ): Promise<NormalizedCapsuleRecord | null> {
    const resolvedName = await buildUniqueCapsuleNameForStore(
      email,
      name,
      listCapsuleNamesByEmailImpl,
    );
    return normalizeCapsuleRecord(
      await renameCapsuleByIdForEmailImpl({
        email,
        capsuleId,
        name: resolvedName,
      }),
    );
  }

  async function saveCapsule(
    email: string,
    capsuleId: string,
  ): Promise<NormalizedCapsuleRecord | null> {
    return normalizeCapsuleRecord(
      await saveCapsuleByIdForEmailImpl({ email, capsuleId }),
    );
  }

  async function revertCapsule(
    email: string,
    capsuleId: string,
  ): Promise<NormalizedCapsuleRecord | null> {
    return normalizeCapsuleRecord(
      await revertCapsuleDraftByIdForEmailImpl({ email, capsuleId }),
    );
  }

  async function duplicateCapsule(
    email: string,
    capsuleId: string,
    name: string = DEFAULT_CAPSULE_NAME,
  ): Promise<NormalizedCapsuleRecord | null> {
    const capsule = await getCapsule(email, capsuleId);
    if (!capsule) {
      return null;
    }

    const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
    return createCapsule(email, {
      name,
      draft: null,
      saved: effectiveSnapshot,
    });
  }

  async function createCapsuleShare(
    email: string,
    capsuleId: string,
    clientOrigin: string,
  ): Promise<SharedCapsuleResult | null> {
    return createCapsuleShareForStore({
      email,
      capsuleId,
      clientOrigin,
      getCapsuleImpl: getCapsule,
      pruneExpiredSharedCapsulesImpl,
      nowImpl,
      upsertSharedCapsuleImpl,
      hashCapsuleContentImpl,
    });
  }

  async function getSharedCapsule(
    id: string,
  ): Promise<SharedCapsuleMetadata | null> {
    return getSharedCapsuleForStore({
      id,
      getValidSharedCapsuleByIdImpl,
      pruneExpiredSharedCapsulesImpl,
    });
  }

  async function getSharedCapsuleOgMetadata(
    id: string,
  ): Promise<SharedCapsuleOgMetadata | null> {
    return getSharedCapsuleOgMetadataForStore({
      id,
      getValidSharedCapsuleByIdImpl,
      pruneExpiredSharedCapsulesImpl,
    });
  }

  async function importSharedCapsule(
    email: string,
    id: string,
  ): Promise<NormalizedCapsuleRecord | null> {
    return importSharedCapsuleForStore({
      email,
      id,
      getValidSharedCapsuleByIdImpl,
      pruneExpiredSharedCapsulesImpl,
      createCapsuleImpl: createCapsule,
    });
  }

  async function deleteCapsule(
    email: string,
    capsuleId: string,
  ): Promise<boolean> {
    return deleteCapsuleForStore({
      email,
      capsuleId,
      deleteCapsuleByIdForEmailImpl,
    });
  }

  return {
    createBootstrapCapsule,
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
    resolveActiveCapsule,
    revertCapsule,
    saveCapsule,
    searchCapsules,
    updateCapsuleReport,
    updateCapsuleSnapshot,
    renameCapsule,
  };
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
