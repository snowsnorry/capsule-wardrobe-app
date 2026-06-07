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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OutfitStoreDeps = Record<string, any>;

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
  updateOutfitSnapshot,
};
