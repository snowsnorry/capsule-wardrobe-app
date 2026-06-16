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
  updateOutfitPinByIdForEmail,
  updateOutfitReportByIdForEmail,
  updateOutfitSnapshotByIdForEmail,
} from "./db.js";

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
  updateOutfitPinByIdForEmailImpl?: (payload: {
    email: string;
    outfitId: string;
    pin: boolean;
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
type ResolvedOutfitStoreDeps = Required<OutfitStoreDeps>;

const defaultOutfitStoreDeps: ResolvedOutfitStoreDeps = {
  countOutfitsByEmailImpl: countOutfitsByEmail,
  createOutfitRecordImpl: createOutfitRecord,
  deleteOutfitByIdForEmailImpl: deleteOutfitByIdForEmail,
  getOutfitByIdForEmailImpl: getOutfitByIdForEmail,
  listOutfitNamesByEmailImpl: listOutfitNamesByEmail,
  listRecentOutfitsByEmailImpl: listRecentOutfitsByEmail,
  renameOutfitByIdForEmailImpl: renameOutfitByIdForEmail,
  revertOutfitDraftByIdForEmailImpl: revertOutfitDraftByIdForEmail,
  saveOutfitByIdForEmailImpl: saveOutfitByIdForEmail,
  searchOutfitsByEmailImpl: searchOutfitsByEmail,
  updateOutfitPinByIdForEmailImpl: updateOutfitPinByIdForEmail,
  updateOutfitReportByIdForEmailImpl: updateOutfitReportByIdForEmail,
  updateOutfitSnapshotByIdForEmailImpl: updateOutfitSnapshotByIdForEmail,
};

function resolveOutfitStoreDeps(
  deps: OutfitStoreDeps,
): ResolvedOutfitStoreDeps {
  return {
    ...defaultOutfitStoreDeps,
    ...Object.fromEntries(
      Object.entries(deps).filter(([, value]) => value !== undefined),
    ),
  } as ResolvedOutfitStoreDeps;
}

export type { OutfitStoreDeps, ResolvedOutfitStoreDeps };
export { resolveOutfitStoreDeps };
