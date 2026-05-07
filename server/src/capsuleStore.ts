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
  upsertSharedCapsule
} from "./db.js";
import { getProfile } from "./profileStore.js";
import {
  DEFAULT_CAPSULE_NAME,
  SHARE_TTL_MS,
  buildCapsuleSnapshotWithRegeneration,
  buildSharedCapsuleOgMetadata,
  getCapsuleIdValue,
  getCapsuleSnapshotRegeneration,
  getEffectiveCapsuleSnapshot,
  isShareableCapsuleSnapshot,
  normalizeCapsuleFilters,
  normalizeCapsuleRecord,
  normalizeCapsuleSnapshot,
  type NormalizedCapsuleRecord,
  type SharedCapsuleMetadata,
  type SharedCapsuleOgMetadata,
  type SharedCapsuleResult
} from "./capsuleStoreModel.js";
import { buildProfileCapsuleContext, buildSnapshotFromProfile } from "./capsuleStoreContext.js";

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
    nowImpl = Date.now
  } = deps;

  async function buildUniqueCapsuleName(email: string, preferredName: string = DEFAULT_CAPSULE_NAME): Promise<string> {
    const baseName = String(preferredName || DEFAULT_CAPSULE_NAME).trim() || DEFAULT_CAPSULE_NAME;
    const existingNames = await listCapsuleNamesByEmailImpl(email);
    if (!existingNames.includes(baseName)) {
      return baseName;
    }

    let index = 1;
    while (existingNames.includes(`${baseName} (${index})`)) {
      index += 1;
    }
    return `${baseName} (${index})`;
  }

  async function setActiveCapsuleId(email: string, activeCapsuleId: string | null) {
    return updateProfileActiveCapsuleIdByEmailImpl({ email, activeCapsuleId });
  }

  async function getCapsule(email: string, capsuleId: string): Promise<NormalizedCapsuleRecord | null> {
    return normalizeCapsuleRecord(await getCapsuleByIdForEmailImpl({ email, capsuleId }));
  }

  async function listRecentCapsules(email: string, limit: number = 10): Promise<NormalizedCapsuleRecord[]> {
    const rows = await listRecentCapsulesByEmailImpl({ email, limit });
    return rows.map(normalizeCapsuleRecord);
  }

  async function searchCapsules(email: string, query: string, limit: number = 25): Promise<NormalizedCapsuleRecord[]> {
    const rows = await searchCapsulesByEmailImpl({ email, query, limit });
    return rows.map(normalizeCapsuleRecord);
  }

  async function createCapsule(email: string, {
    name,
    draft = null,
    saved = null,
    setActive = true
  }: {
    name?: string;
    draft?: Record<string, unknown> | null;
    saved?: Record<string, unknown> | null;
    setActive?: boolean;
  } = {}): Promise<NormalizedCapsuleRecord | null> {
    const resolvedName = await buildUniqueCapsuleName(email, name || DEFAULT_CAPSULE_NAME);
    const capsule = normalizeCapsuleRecord(await createCapsuleRecordImpl({
      email,
      name: resolvedName,
      draft: normalizeCapsuleSnapshot(draft),
      saved: normalizeCapsuleSnapshot(saved)
    }));
    if (capsule && setActive) {
      await setActiveCapsuleId(email, getCapsuleIdValue(capsule));
    }
    return capsule;
  }

  async function createBootstrapCapsule(email: string): Promise<NormalizedCapsuleRecord | null> {
    const profile = await getProfileImpl(email);
    return createCapsule(email, {
      draft: buildSnapshotFromProfile(profile),
      setActive: true
    });
  }

  async function resolveActiveCapsule(email: string): Promise<NormalizedCapsuleRecord | null> {
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
    draft: Record<string, unknown> | null
  ): Promise<NormalizedCapsuleRecord | null> {
    return normalizeCapsuleRecord(await updateCapsuleSnapshotByIdForEmailImpl({
      email,
      capsuleId,
      draft: normalizeCapsuleSnapshot(draft)
    }));
  }

  async function renameCapsule(email: string, capsuleId: string, name: string): Promise<NormalizedCapsuleRecord | null> {
    const resolvedName = await buildUniqueCapsuleName(email, name);
    return normalizeCapsuleRecord(await renameCapsuleByIdForEmailImpl({ email, capsuleId, name: resolvedName }));
  }

  async function saveCapsule(email: string, capsuleId: string): Promise<NormalizedCapsuleRecord | null> {
    return normalizeCapsuleRecord(await saveCapsuleByIdForEmailImpl({ email, capsuleId }));
  }

  async function revertCapsule(email: string, capsuleId: string): Promise<NormalizedCapsuleRecord | null> {
    return normalizeCapsuleRecord(await revertCapsuleDraftByIdForEmailImpl({ email, capsuleId }));
  }

  async function duplicateCapsule(
    email: string,
    capsuleId: string,
    name: string = DEFAULT_CAPSULE_NAME
  ): Promise<NormalizedCapsuleRecord | null> {
    const capsule = await getCapsule(email, capsuleId);
    if (!capsule) {
      return null;
    }

    const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
    return createCapsule(email, {
      name,
      draft: null,
      saved: effectiveSnapshot
    });
  }

  function buildShareUrl(clientOrigin: string, shareId: string): string {
    const origin = String(clientOrigin || "").replace(/\/+$/, "") || "http://localhost:5173";
    return `${origin}/share/${encodeURIComponent(shareId)}`;
  }

  async function createCapsuleShare(
    email: string,
    capsuleId: string,
    clientOrigin: string
  ): Promise<SharedCapsuleResult | null> {
    const capsule = await getCapsule(email, capsuleId);
    if (!capsule) {
      return null;
    }

    const snapshot = capsule.draft || capsule.saved || null;
    if (!isShareableCapsuleSnapshot(snapshot)) {
      const error = new Error("capsule_not_shareable");
      (error as Error & { code?: string }).code = "capsule_not_shareable";
      throw error;
    }

    await pruneExpiredSharedCapsulesImpl();
    const expiresAt = new Date(nowImpl() + SHARE_TTL_MS);
    const shared = await upsertSharedCapsuleImpl({
      profileEmail: email,
      name: String(capsule.name || DEFAULT_CAPSULE_NAME),
      content: snapshot as unknown as Record<string, unknown>,
      contentHash: hashCapsuleContentImpl(snapshot),
      expiresAt
    });

    if (!shared) {
      return null;
    }

    return {
      id: shared.id,
      url: buildShareUrl(clientOrigin, shared.id),
      expiresAt: shared.expiresAt
    };
  }

  async function getSharedCapsule(id: string): Promise<SharedCapsuleMetadata | null> {
    const shared = await getValidSharedCapsuleByIdImpl(String(id || "").trim());
    if (!shared) {
      await pruneExpiredSharedCapsulesImpl();
      return null;
    }

    return {
      id: shared.id,
      name: shared.name,
      expiresAt: shared.expiresAt
    };
  }

  async function getSharedCapsuleOgMetadata(id: string): Promise<SharedCapsuleOgMetadata | null> {
    const shared = await getValidSharedCapsuleByIdImpl(String(id || "").trim());
    if (!shared) {
      await pruneExpiredSharedCapsulesImpl();
      return null;
    }

    return buildSharedCapsuleOgMetadata({
      name: shared.name,
      content: shared.content
    });
  }

  async function importSharedCapsule(email: string, id: string): Promise<NormalizedCapsuleRecord | null> {
    const shared = await getValidSharedCapsuleByIdImpl(String(id || "").trim());
    if (!shared) {
      await pruneExpiredSharedCapsulesImpl();
      return null;
    }

    const content = normalizeCapsuleSnapshot(shared.content);
    if (!isShareableCapsuleSnapshot(content)) {
      const error = new Error("capsule_not_shareable");
      (error as Error & { code?: string }).code = "capsule_not_shareable";
      throw error;
    }

    return createCapsule(email, {
      name: shared.name,
      draft: null,
      saved: content,
      setActive: true
    });
  }

  async function deleteCapsule(email: string, capsuleId: string): Promise<boolean> {
    const deleted = await deleteCapsuleByIdForEmailImpl({ email, capsuleId });
    if (!deleted) {
      return false;
    }

    const profile = await getProfileImpl(email);
    if (profile?.activeCapsuleId === capsuleId) {
      const [recentCapsule] = await listRecentCapsules(email, 1);
      if (recentCapsule) {
        await setActiveCapsuleId(email, getCapsuleIdValue(recentCapsule));
      } else {
        const capsule = await createBootstrapCapsule(email);
        await setActiveCapsuleId(email, getCapsuleIdValue(capsule));
      }
    }

    return true;
  }

  return {
    buildUniqueCapsuleName,
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
    renameCapsule
  };
}

const defaultCapsuleStore = createCapsuleStore();

const {
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
  renameCapsule
} = defaultCapsuleStore;

export {
  DEFAULT_CAPSULE_NAME,
  buildCapsuleSnapshotWithRegeneration,
  buildSharedCapsuleOgMetadata,
  buildSnapshotFromProfile,
  buildProfileCapsuleContext,
  createBootstrapCapsule,
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
  isShareableCapsuleSnapshot,
  listRecentCapsules,
  normalizeCapsuleFilters,
  normalizeCapsuleRecord,
  normalizeCapsuleSnapshot,
  resolveActiveCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  setActiveCapsuleId,
  updateCapsuleSnapshot,
  renameCapsule
};
