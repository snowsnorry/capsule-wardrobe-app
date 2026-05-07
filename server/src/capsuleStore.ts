import {
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
  updateCapsuleSnapshotByIdForEmail,
  updateProfileActiveCapsuleIdByEmail,
  upsertSharedCapsule,
} from "./db.js";
import { getProfile } from "./profileStore.js";
import {
  DEFAULT_CAPSULE_NAME,
  buildCapsuleSnapshotWithRegeneration,
  getCapsuleIdValue,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CapsuleStoreDeps = Record<string, any>;

// eslint-disable-next-line max-lines-per-function, complexity
function createCapsuleStore(deps: CapsuleStoreDeps = {}) {
  const {
    createCapsuleRecordImpl = createCapsuleRecord,
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
    updateCapsuleSnapshotByIdForEmailImpl = updateCapsuleSnapshotByIdForEmail,
    updateProfileActiveCapsuleIdByEmailImpl = updateProfileActiveCapsuleIdByEmail,
    upsertSharedCapsuleImpl = upsertSharedCapsule,
    nowImpl = Date.now,
  } = deps;

  async function setActiveCapsuleId(
    email: string,
    activeCapsuleId: string | null,
  ) {
    return updateProfileActiveCapsuleIdByEmailImpl({ email, activeCapsuleId });
  }

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
  ): Promise<NormalizedCapsuleRecord[]> {
    const rows = await listRecentCapsulesByEmailImpl({ email, limit });
    return rows.map(normalizeCapsuleRecord);
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
      setActive = true,
    }: {
      name?: string;
      draft?: Record<string, unknown> | null;
      saved?: Record<string, unknown> | null;
      setActive?: boolean;
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
    if (capsule && setActive) {
      await setActiveCapsuleId(email, getCapsuleIdValue(capsule));
    }
    return capsule;
  }

  async function createBootstrapCapsule(
    email: string,
  ): Promise<NormalizedCapsuleRecord | null> {
    const profile = await getProfileImpl(email);
    return createCapsule(email, {
      draft: buildSnapshotFromProfile(profile),
      setActive: true,
    });
  }

  async function resolveActiveCapsule(
    email: string,
  ): Promise<NormalizedCapsuleRecord | null> {
    const profile = await getProfileImpl(email);
    if (profile?.activeCapsuleId) {
      const activeCapsule = await getCapsule(email, profile.activeCapsuleId);
      if (activeCapsule) {
        return activeCapsule;
      }
    }

    const [recentCapsule] = await listRecentCapsules(email, 1);
    if (recentCapsule) {
      await setActiveCapsuleId(email, getCapsuleIdValue(recentCapsule));
      return recentCapsule;
    }

    return createBootstrapCapsule(email);
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
      getProfileImpl,
      listRecentCapsulesImpl: listRecentCapsules,
      setActiveCapsuleIdImpl: setActiveCapsuleId,
      createBootstrapCapsuleImpl: createBootstrapCapsule,
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
    resolveActiveCapsule,
    revertCapsule,
    saveCapsule,
    searchCapsules,
    setActiveCapsuleId,
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
  resolveActiveCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  setActiveCapsuleId,
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
  normalizeCapsuleFilters,
  normalizeCapsuleSnapshot,
  resolveActiveCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  setActiveCapsuleId,
  updateCapsuleSnapshot,
  renameCapsule,
};
