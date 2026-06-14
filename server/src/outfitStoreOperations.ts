import {
  DEFAULT_OUTFIT_NAME,
  getEffectiveOutfitSnapshot,
  normalizeOutfitRecord,
  normalizeOutfitSnapshot,
  type NormalizedOutfitRecord,
} from "./outfitStoreModel.js";
import { buildUniqueOutfitNameForStore } from "./outfitStoreNaming.js";
import type { ResolvedOutfitStoreDeps } from "./outfitStoreDeps.js";

function filterNormalizedOutfits(
  outfits: Array<NormalizedOutfitRecord | null>,
): NormalizedOutfitRecord[] {
  return outfits.filter((outfit): outfit is NormalizedOutfitRecord =>
    Boolean(outfit),
  );
}

async function getOutfitForStore(
  email: string,
  outfitId: string,
  deps: ResolvedOutfitStoreDeps,
): Promise<NormalizedOutfitRecord | null> {
  return normalizeOutfitRecord(
    await deps.getOutfitByIdForEmailImpl({ email, outfitId }),
  );
}

async function listRecentOutfitsForStore(
  email: string,
  limit: number,
  offset: number,
  deps: ResolvedOutfitStoreDeps,
): Promise<NormalizedOutfitRecord[]> {
  const rows = await deps.listRecentOutfitsByEmailImpl({
    email,
    limit,
    offset,
  });
  return filterNormalizedOutfits(rows.map(normalizeOutfitRecord));
}

async function searchOutfitsForStore(
  email: string,
  query: string,
  limit: number,
  deps: ResolvedOutfitStoreDeps,
): Promise<NormalizedOutfitRecord[]> {
  const rows = await deps.searchOutfitsByEmailImpl({ email, query, limit });
  return filterNormalizedOutfits(rows.map(normalizeOutfitRecord));
}

async function createOutfitForStore(
  email: string,
  {
    name,
    draft = { items: [] },
    saved = null,
  }: {
    name?: string;
    draft?: Record<string, unknown> | null;
    saved?: Record<string, unknown> | null;
  },
  deps: ResolvedOutfitStoreDeps,
): Promise<NormalizedOutfitRecord | null> {
  const resolvedName = await buildUniqueOutfitNameForStore(
    email,
    name || DEFAULT_OUTFIT_NAME,
    deps.listOutfitNamesByEmailImpl,
  );
  return normalizeOutfitRecord(
    await deps.createOutfitRecordImpl({
      email,
      name: resolvedName,
      draft: normalizeOutfitSnapshot(draft),
      saved: normalizeOutfitSnapshot(saved),
    }),
  );
}

async function updateOutfitSnapshotForStore(
  email: string,
  outfitId: string,
  draft: Record<string, unknown> | null,
  deps: ResolvedOutfitStoreDeps,
): Promise<NormalizedOutfitRecord | null> {
  return normalizeOutfitRecord(
    await deps.updateOutfitSnapshotByIdForEmailImpl({
      email,
      outfitId,
      draft: normalizeOutfitSnapshot(draft),
    }),
  );
}

async function updateOutfitReportForStore(
  email: string,
  outfitId: string,
  report: Record<string, unknown> | null,
  deps: ResolvedOutfitStoreDeps,
): Promise<NormalizedOutfitRecord | null> {
  return normalizeOutfitRecord(
    await deps.updateOutfitReportByIdForEmailImpl({
      email,
      outfitId,
      report,
    }),
  );
}

async function renameOutfitForStore(
  email: string,
  outfitId: string,
  name: string,
  deps: ResolvedOutfitStoreDeps,
): Promise<NormalizedOutfitRecord | null> {
  const resolvedName = await buildUniqueOutfitNameForStore(
    email,
    name,
    deps.listOutfitNamesByEmailImpl,
  );
  return normalizeOutfitRecord(
    await deps.renameOutfitByIdForEmailImpl({
      email,
      outfitId,
      name: resolvedName,
    }),
  );
}

async function duplicateOutfitForStore(
  email: string,
  outfitId: string,
  name: string,
  deps: ResolvedOutfitStoreDeps,
): Promise<NormalizedOutfitRecord | null> {
  const outfit = await getOutfitForStore(email, outfitId, deps);
  if (!outfit) {
    return null;
  }

  return createOutfitForStore(
    email,
    {
      name,
      draft: null,
      saved: getEffectiveOutfitSnapshot(outfit),
    },
    deps,
  );
}

function createOutfitStoreOperations(deps: ResolvedOutfitStoreDeps) {
  return {
    countOutfits: (email: string) => deps.countOutfitsByEmailImpl(email),
    createOutfit: (
      email: string,
      options: {
        name?: string;
        draft?: Record<string, unknown> | null;
        saved?: Record<string, unknown> | null;
      } = {},
    ) => createOutfitForStore(email, options, deps),
    deleteOutfit: (email: string, outfitId: string) =>
      deps.deleteOutfitByIdForEmailImpl({ email, outfitId }),
    duplicateOutfit: (
      email: string,
      outfitId: string,
      name: string = DEFAULT_OUTFIT_NAME,
    ) => duplicateOutfitForStore(email, outfitId, name, deps),
    getOutfit: (email: string, outfitId: string) =>
      getOutfitForStore(email, outfitId, deps),
    listRecentOutfits: (
      email: string,
      limit: number = 10,
      offset: number = 0,
    ) => listRecentOutfitsForStore(email, limit, offset, deps),
    renameOutfit: (email: string, outfitId: string, name: string) =>
      renameOutfitForStore(email, outfitId, name, deps),
    revertOutfit: async (email: string, outfitId: string) =>
      normalizeOutfitRecord(
        await deps.revertOutfitDraftByIdForEmailImpl({ email, outfitId }),
      ),
    saveOutfit: async (email: string, outfitId: string) =>
      normalizeOutfitRecord(
        await deps.saveOutfitByIdForEmailImpl({ email, outfitId }),
      ),
    searchOutfits: (email: string, query: string, limit: number = 25) =>
      searchOutfitsForStore(email, query, limit, deps),
    updateOutfitReport: (
      email: string,
      outfitId: string,
      report: Record<string, unknown> | null,
    ) => updateOutfitReportForStore(email, outfitId, report, deps),
    updateOutfitSnapshot: (
      email: string,
      outfitId: string,
      draft: Record<string, unknown> | null,
    ) => updateOutfitSnapshotForStore(email, outfitId, draft, deps),
  };
}

export { createOutfitStoreOperations };
