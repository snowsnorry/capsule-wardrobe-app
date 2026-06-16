import {
  DEFAULT_CAPSULE_NAME,
  getEffectiveCapsuleSnapshot,
  normalizeCapsuleRecord,
  normalizeCapsuleSnapshot,
  type NormalizedCapsuleRecord,
  type SharedCapsuleMetadata,
  type SharedCapsuleOgMetadata,
  type SharedCapsuleResult,
} from "./capsuleStoreModel.js";
import {
  createCapsuleShareForStore,
  getSharedCapsuleForStore,
  getSharedCapsuleOgMetadataForStore,
  importSharedCapsuleForStore,
} from "./capsuleStoreSharing.js";
import { deleteCapsuleForStore } from "./capsuleStoreDelete.js";
import { buildUniqueCapsuleNameForStore } from "./capsuleStoreNaming.js";
import { buildSnapshotFromProfile } from "./capsuleStoreContext.js";
import type { CapsuleStoreDeps } from "./capsuleStoreDeps.js";

type ResolvedCapsuleStoreDeps = Required<CapsuleStoreDeps>;

async function getCapsuleForStore(
  email: string,
  capsuleId: string,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord | null> {
  return normalizeCapsuleRecord(
    await deps.getCapsuleByIdForEmailImpl({ email, capsuleId }),
  );
}

async function listRecentCapsulesForStore(
  email: string,
  limit: number,
  offset: number,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord[]> {
  const rows = await deps.listRecentCapsulesByEmailImpl({
    email,
    limit,
    offset,
  });
  return rows.map(normalizeCapsuleRecord);
}

async function searchCapsulesForStore(
  email: string,
  query: string,
  limit: number,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord[]> {
  const rows = await deps.searchCapsulesByEmailImpl({ email, query, limit });
  return rows.map(normalizeCapsuleRecord);
}

async function createCapsuleForStore(
  email: string,
  {
    name,
    draft = null,
    saved = null,
  }: {
    name?: string;
    draft?: Record<string, unknown> | null;
    saved?: Record<string, unknown> | null;
  },
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord | null> {
  const resolvedName = await buildUniqueCapsuleNameForStore(
    email,
    name || DEFAULT_CAPSULE_NAME,
    deps.listCapsuleNamesByEmailImpl,
  );
  return normalizeCapsuleRecord(
    await deps.createCapsuleRecordImpl({
      email,
      name: resolvedName,
      draft: normalizeCapsuleSnapshot(draft),
      saved: normalizeCapsuleSnapshot(saved),
    }),
  );
}

async function createBootstrapCapsuleForStore(
  email: string,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord | null> {
  const profile = await deps.getProfileImpl(email);
  return createCapsuleForStore(
    email,
    {
      draft: buildSnapshotFromProfile(profile),
    },
    deps,
  );
}

async function updateCapsuleSnapshotForStore(
  email: string,
  capsuleId: string,
  draft: Record<string, unknown> | null,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord | null> {
  return normalizeCapsuleRecord(
    await deps.updateCapsuleSnapshotByIdForEmailImpl({
      email,
      capsuleId,
      draft: normalizeCapsuleSnapshot(draft),
    }),
  );
}

async function updateCapsuleSavedSnapshotForStore(
  email: string,
  capsuleId: string,
  saved: Record<string, unknown> | null,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord | null> {
  return normalizeCapsuleRecord(
    await deps.updateCapsuleSavedSnapshotByIdForEmailImpl({
      email,
      capsuleId,
      saved: normalizeCapsuleSnapshot(saved),
    }),
  );
}

async function updateCapsuleReportForStore(
  email: string,
  capsuleId: string,
  report: Record<string, unknown> | null,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord | null> {
  return normalizeCapsuleRecord(
    await deps.updateCapsuleReportByIdForEmailImpl({
      email,
      capsuleId,
      report,
    }),
  );
}

async function renameCapsuleForStore(
  email: string,
  capsuleId: string,
  name: string,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord | null> {
  const resolvedName = await buildUniqueCapsuleNameForStore(
    email,
    name,
    deps.listCapsuleNamesByEmailImpl,
  );
  return normalizeCapsuleRecord(
    await deps.renameCapsuleByIdForEmailImpl({
      email,
      capsuleId,
      name: resolvedName,
    }),
  );
}

async function setCapsulePinForStore(
  email: string,
  capsuleId: string,
  pin: boolean,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord | null> {
  return normalizeCapsuleRecord(
    await deps.updateCapsulePinByIdForEmailImpl({
      email,
      capsuleId,
      pin,
    }),
  );
}

async function duplicateCapsuleForStore(
  email: string,
  capsuleId: string,
  name: string,
  deps: ResolvedCapsuleStoreDeps,
): Promise<NormalizedCapsuleRecord | null> {
  const capsule = await getCapsuleForStore(email, capsuleId, deps);
  if (!capsule) {
    return null;
  }

  return createCapsuleForStore(
    email,
    {
      name,
      draft: null,
      saved: getEffectiveCapsuleSnapshot(capsule),
    },
    deps,
  );
}

function buildCapsuleShareOperations(deps: ResolvedCapsuleStoreDeps) {
  const getCapsuleImpl = (email: string, capsuleId: string) =>
    getCapsuleForStore(email, capsuleId, deps);
  const createCapsuleImpl = (
    email: string,
    options: {
      name?: string;
      draft?: Record<string, unknown> | null;
      saved?: Record<string, unknown> | null;
    } = {},
  ) => createCapsuleForStore(email, options, deps);

  return {
    createCapsuleShare: (
      email: string,
      capsuleId: string,
      clientOrigin: string,
    ): Promise<SharedCapsuleResult | null> =>
      createCapsuleShareForStore({
        email,
        capsuleId,
        clientOrigin,
        getCapsuleImpl,
        pruneExpiredSharedCapsulesImpl: deps.pruneExpiredSharedCapsulesImpl,
        nowImpl: deps.nowImpl,
        upsertSharedCapsuleImpl: deps.upsertSharedCapsuleImpl,
        hashCapsuleContentImpl: deps.hashCapsuleContentImpl,
      }),
    getSharedCapsule: (id: string): Promise<SharedCapsuleMetadata | null> =>
      getSharedCapsuleForStore({
        id,
        getValidSharedCapsuleByIdImpl: deps.getValidSharedCapsuleByIdImpl,
        pruneExpiredSharedCapsulesImpl: deps.pruneExpiredSharedCapsulesImpl,
      }),
    getSharedCapsuleOgMetadata: (
      id: string,
    ): Promise<SharedCapsuleOgMetadata | null> =>
      getSharedCapsuleOgMetadataForStore({
        id,
        getValidSharedCapsuleByIdImpl: deps.getValidSharedCapsuleByIdImpl,
        pruneExpiredSharedCapsulesImpl: deps.pruneExpiredSharedCapsulesImpl,
      }),
    importSharedCapsule: (
      email: string,
      id: string,
    ): Promise<NormalizedCapsuleRecord | null> =>
      importSharedCapsuleForStore({
        email,
        id,
        getValidSharedCapsuleByIdImpl: deps.getValidSharedCapsuleByIdImpl,
        pruneExpiredSharedCapsulesImpl: deps.pruneExpiredSharedCapsulesImpl,
        createCapsuleImpl,
      }),
  };
}

function createCapsuleStoreOperations(deps: ResolvedCapsuleStoreDeps) {
  return {
    createBootstrapCapsule: (email: string) =>
      createBootstrapCapsuleForStore(email, deps),
    createCapsule: (
      email: string,
      options: {
        name?: string;
        draft?: Record<string, unknown> | null;
        saved?: Record<string, unknown> | null;
      } = {},
    ) => createCapsuleForStore(email, options, deps),
    deleteCapsule: (email: string, capsuleId: string) =>
      deleteCapsuleForStore({
        email,
        capsuleId,
        deleteCapsuleByIdForEmailImpl: deps.deleteCapsuleByIdForEmailImpl,
      }),
    duplicateCapsule: (
      email: string,
      capsuleId: string,
      name: string = DEFAULT_CAPSULE_NAME,
    ) => duplicateCapsuleForStore(email, capsuleId, name, deps),
    getCapsule: (email: string, capsuleId: string) =>
      getCapsuleForStore(email, capsuleId, deps),
    listRecentCapsules: (
      email: string,
      limit: number = 10,
      offset: number = 0,
    ) => listRecentCapsulesForStore(email, limit, offset, deps),
    countCapsules: (email: string) => deps.countCapsulesByEmailImpl(email),
    setCapsulePin: (email: string, capsuleId: string, pin: boolean) =>
      setCapsulePinForStore(email, capsuleId, pin, deps),
    resolveActiveCapsule: async () => null,
    revertCapsule: async (email: string, capsuleId: string) =>
      normalizeCapsuleRecord(
        await deps.revertCapsuleDraftByIdForEmailImpl({ email, capsuleId }),
      ),
    saveCapsule: async (email: string, capsuleId: string) =>
      normalizeCapsuleRecord(
        await deps.saveCapsuleByIdForEmailImpl({ email, capsuleId }),
      ),
    searchCapsules: (email: string, query: string, limit: number = 25) =>
      searchCapsulesForStore(email, query, limit, deps),
    updateCapsuleReport: (
      email: string,
      capsuleId: string,
      report: Record<string, unknown> | null,
    ) => updateCapsuleReportForStore(email, capsuleId, report, deps),
    updateCapsuleSavedSnapshot: (
      email: string,
      capsuleId: string,
      saved: Record<string, unknown> | null,
    ) => updateCapsuleSavedSnapshotForStore(email, capsuleId, saved, deps),
    updateCapsuleSnapshot: (
      email: string,
      capsuleId: string,
      draft: Record<string, unknown> | null,
    ) => updateCapsuleSnapshotForStore(email, capsuleId, draft, deps),
    renameCapsule: (email: string, capsuleId: string, name: string) =>
      renameCapsuleForStore(email, capsuleId, name, deps),
    ...buildCapsuleShareOperations(deps),
  };
}

export { createCapsuleStoreOperations };
