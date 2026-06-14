type StoreSnapshot = Record<string, unknown> | null;
type CapsuleStoreRecord = Record<string, unknown> | null;
type CapsuleProfileLike = Record<string, unknown> | null;
type SharedCapsuleRowLike = Record<string, unknown> | null;

type CapsuleStoreDeps = {
  createCapsuleRecordImpl?: (payload: {
    email: string;
    name: string;
    draft?: StoreSnapshot;
    saved?: StoreSnapshot;
  }) => Promise<CapsuleStoreRecord>;
  countCapsulesByEmailImpl?: (email: string) => Promise<number>;
  deleteCapsuleByIdForEmailImpl?: (payload: {
    email: string;
    capsuleId: string;
  }) => Promise<boolean>;
  getCapsuleByIdForEmailImpl?: (payload: {
    email: string;
    capsuleId: string;
  }) => Promise<CapsuleStoreRecord>;
  getProfileImpl?: (email: string) => Promise<CapsuleProfileLike>;
  getValidSharedCapsuleByIdImpl?: (id: string) => Promise<SharedCapsuleRowLike>;
  hashCapsuleContentImpl?: (content: Record<string, unknown>) => string;
  listCapsuleNamesByEmailImpl?: (email: string) => Promise<string[]>;
  listRecentCapsulesByEmailImpl?: (payload: {
    email: string;
    limit?: number;
    offset?: number;
  }) => Promise<CapsuleStoreRecord[]>;
  pruneExpiredSharedCapsulesImpl?: () => Promise<void>;
  renameCapsuleByIdForEmailImpl?: (payload: {
    email: string;
    capsuleId: string;
    name: string;
  }) => Promise<CapsuleStoreRecord>;
  revertCapsuleDraftByIdForEmailImpl?: (payload: {
    email: string;
    capsuleId: string;
  }) => Promise<CapsuleStoreRecord>;
  saveCapsuleByIdForEmailImpl?: (payload: {
    email: string;
    capsuleId: string;
  }) => Promise<CapsuleStoreRecord>;
  searchCapsulesByEmailImpl?: (payload: {
    email: string;
    query: string;
    limit?: number;
  }) => Promise<CapsuleStoreRecord[]>;
  updateCapsuleReportByIdForEmailImpl?: (payload: {
    email: string;
    capsuleId: string;
    report: StoreSnapshot;
  }) => Promise<CapsuleStoreRecord>;
  updateCapsuleSnapshotByIdForEmailImpl?: (payload: {
    email: string;
    capsuleId: string;
    draft: StoreSnapshot;
  }) => Promise<CapsuleStoreRecord>;
  upsertSharedCapsuleImpl?: (payload: {
    profileEmail: string;
    name: string;
    content: Record<string, unknown>;
    contentHash: string;
    expiresAt: Date;
  }) => Promise<SharedCapsuleRowLike>;
  nowImpl?: () => number;
};

export type { CapsuleStoreDeps };
