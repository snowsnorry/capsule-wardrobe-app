/* eslint-disable complexity */
import {
  countOutfitsByEmail,
  createOutfitRecord,
  deleteOutfitByIdForEmail,
  getOutfitByIdForEmail,
  listOutfitNamesByEmail,
  listRecentOutfitsByEmail,
  renameOutfitByIdForEmail,
  revertOutfitDraftByIdForEmail,
  saveOutfitByIdForEmail,
  searchOutfitsByEmail,
  updateOutfitReportByIdForEmail,
  updateOutfitSnapshotByIdForEmail,
} from "./db.js";
import {
  DEFAULT_OUTFIT_NAME,
  getEffectiveOutfitSnapshot,
  normalizeOutfitRecord,
  normalizeOutfitSnapshot,
  type NormalizedOutfitRecord,
} from "./outfitStoreModel.js";
import { buildUniqueOutfitNameForStore } from "./outfitStoreNaming.js";

type StoreSnapshot = Record<string, unknown> | null;
type OutfitStoreRecord = Record<string, unknown> | null;

type OutfitStoreDeps = {
  countOutfitsByEmailImpl?: (email: string) => Promise<number>;
  createOutfitRecordImpl?: (payload: {
    email: string;
    name: string;
    draft?: StoreSnapshot;
    saved?: StoreSnapshot;
  }) => Promise<OutfitStoreRecord>;
  deleteOutfitByIdForEmailImpl?: (payload: {
    email: string;
    outfitId: string;
  }) => Promise<boolean>;
  getOutfitByIdForEmailImpl?: (payload: {
    email: string;
    outfitId: string;
  }) => Promise<OutfitStoreRecord>;
  listOutfitNamesByEmailImpl?: (email: string) => Promise<string[]>;
  listRecentOutfitsByEmailImpl?: (payload: {
    email: string;
    limit?: number;
    offset?: number;
  }) => Promise<OutfitStoreRecord[]>;
  renameOutfitByIdForEmailImpl?: (payload: {
    email: string;
    outfitId: string;
    name: string;
  }) => Promise<OutfitStoreRecord>;
  revertOutfitDraftByIdForEmailImpl?: (payload: {
    email: string;
    outfitId: string;
  }) => Promise<OutfitStoreRecord>;
  saveOutfitByIdForEmailImpl?: (payload: {
    email: string;
    outfitId: string;
  }) => Promise<OutfitStoreRecord>;
  searchOutfitsByEmailImpl?: (payload: {
    email: string;
    query: string;
    limit?: number;
  }) => Promise<OutfitStoreRecord[]>;
  updateOutfitReportByIdForEmailImpl?: (payload: {
    email: string;
    outfitId: string;
    report: StoreSnapshot;
  }) => Promise<OutfitStoreRecord>;
  updateOutfitSnapshotByIdForEmailImpl?: (payload: {
    email: string;
    outfitId: string;
    draft: StoreSnapshot;
  }) => Promise<OutfitStoreRecord>;
};

// eslint-disable-next-line max-lines-per-function
function createOutfitStore(deps: OutfitStoreDeps = {}) {
  const {
    countOutfitsByEmailImpl = countOutfitsByEmail,
    createOutfitRecordImpl = createOutfitRecord,
    deleteOutfitByIdForEmailImpl = deleteOutfitByIdForEmail,
    getOutfitByIdForEmailImpl = getOutfitByIdForEmail,
    listOutfitNamesByEmailImpl = listOutfitNamesByEmail,
    listRecentOutfitsByEmailImpl = listRecentOutfitsByEmail,
    renameOutfitByIdForEmailImpl = renameOutfitByIdForEmail,
    revertOutfitDraftByIdForEmailImpl = revertOutfitDraftByIdForEmail,
    saveOutfitByIdForEmailImpl = saveOutfitByIdForEmail,
    searchOutfitsByEmailImpl = searchOutfitsByEmail,
    updateOutfitReportByIdForEmailImpl = updateOutfitReportByIdForEmail,
    updateOutfitSnapshotByIdForEmailImpl = updateOutfitSnapshotByIdForEmail,
  } = deps;

  async function getOutfit(
    email: string,
    outfitId: string,
  ): Promise<NormalizedOutfitRecord | null> {
    return normalizeOutfitRecord(
      await getOutfitByIdForEmailImpl({ email, outfitId }),
    );
  }

  async function listRecentOutfits(
    email: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<NormalizedOutfitRecord[]> {
    const rows = await listRecentOutfitsByEmailImpl({ email, limit, offset });
    return rows
      .map(normalizeOutfitRecord)
      .filter((outfit): outfit is NormalizedOutfitRecord => Boolean(outfit));
  }

  async function countOutfits(email: string): Promise<number> {
    return countOutfitsByEmailImpl(email);
  }

  async function searchOutfits(
    email: string,
    query: string,
    limit: number = 25,
  ): Promise<NormalizedOutfitRecord[]> {
    const rows = await searchOutfitsByEmailImpl({ email, query, limit });
    return rows
      .map(normalizeOutfitRecord)
      .filter((outfit): outfit is NormalizedOutfitRecord => Boolean(outfit));
  }

  async function createOutfit(
    email: string,
    {
      name,
      draft = { items: [] },
      saved = null,
    }: {
      name?: string;
      draft?: Record<string, unknown> | null;
      saved?: Record<string, unknown> | null;
    } = {},
  ): Promise<NormalizedOutfitRecord | null> {
    const resolvedName = await buildUniqueOutfitNameForStore(
      email,
      name || DEFAULT_OUTFIT_NAME,
      listOutfitNamesByEmailImpl,
    );
    return normalizeOutfitRecord(
      await createOutfitRecordImpl({
        email,
        name: resolvedName,
        draft: normalizeOutfitSnapshot(draft),
        saved: normalizeOutfitSnapshot(saved),
      }),
    );
  }

  async function updateOutfitSnapshot(
    email: string,
    outfitId: string,
    draft: Record<string, unknown> | null,
  ): Promise<NormalizedOutfitRecord | null> {
    return normalizeOutfitRecord(
      await updateOutfitSnapshotByIdForEmailImpl({
        email,
        outfitId,
        draft: normalizeOutfitSnapshot(draft),
      }),
    );
  }

  async function updateOutfitReport(
    email: string,
    outfitId: string,
    report: Record<string, unknown> | null,
  ): Promise<NormalizedOutfitRecord | null> {
    return normalizeOutfitRecord(
      await updateOutfitReportByIdForEmailImpl({
        email,
        outfitId,
        report,
      }),
    );
  }

  async function renameOutfit(
    email: string,
    outfitId: string,
    name: string,
  ): Promise<NormalizedOutfitRecord | null> {
    const resolvedName = await buildUniqueOutfitNameForStore(
      email,
      name,
      listOutfitNamesByEmailImpl,
    );
    return normalizeOutfitRecord(
      await renameOutfitByIdForEmailImpl({
        email,
        outfitId,
        name: resolvedName,
      }),
    );
  }

  async function saveOutfit(
    email: string,
    outfitId: string,
  ): Promise<NormalizedOutfitRecord | null> {
    return normalizeOutfitRecord(
      await saveOutfitByIdForEmailImpl({ email, outfitId }),
    );
  }

  async function revertOutfit(
    email: string,
    outfitId: string,
  ): Promise<NormalizedOutfitRecord | null> {
    return normalizeOutfitRecord(
      await revertOutfitDraftByIdForEmailImpl({ email, outfitId }),
    );
  }

  async function duplicateOutfit(
    email: string,
    outfitId: string,
    name: string = DEFAULT_OUTFIT_NAME,
  ): Promise<NormalizedOutfitRecord | null> {
    const outfit = await getOutfit(email, outfitId);
    if (!outfit) {
      return null;
    }

    return createOutfit(email, {
      name,
      draft: null,
      saved: getEffectiveOutfitSnapshot(outfit),
    });
  }

  async function deleteOutfit(
    email: string,
    outfitId: string,
  ): Promise<boolean> {
    return deleteOutfitByIdForEmailImpl({ email, outfitId });
  }

  return {
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
    updateOutfitReport,
    updateOutfitSnapshot,
  };
}

const defaultOutfitStore = createOutfitStore();

const {
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
  updateOutfitReport,
  updateOutfitSnapshot,
} = defaultOutfitStore;

export {
  countOutfits,
  createOutfit,
  createOutfitStore,
  deleteOutfit,
  duplicateOutfit,
  getEffectiveOutfitSnapshot,
  getOutfit,
  listRecentOutfits,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  updateOutfitReport,
  updateOutfitSnapshot,
};
