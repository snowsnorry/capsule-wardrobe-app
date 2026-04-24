import { getSqlClient, hashCapsuleContent } from "../db.js";
import { decodeLegacyBase64Image, uploadImageToR2 } from "../r2Storage.js";

type JsonRecord = Record<string, unknown>;
type CapsuleImageRow = {
  id: string;
  draft: JsonRecord | null;
  saved: JsonRecord | null;
};
type SharedCapsuleImageRow = {
  id: string;
  content: JsonRecord;
};
type MigrationStats = {
  capsulesScanned: number;
  capsulesUpdated: number;
  sharedCapsulesScanned: number;
  sharedCapsulesUpdated: number;
  imagesUploaded: number;
  imagesSkipped: number;
  imagesFailed: number;
};
type UploadImageToR2Like = typeof uploadImageToR2;

function cloneJson<T>(value: T): T {
  return value === null || value === undefined
    ? value
    : JSON.parse(JSON.stringify(value));
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function listCapsuleImageRows(): Promise<CapsuleImageRow[]> {
  const sql = getSqlClient();
  const rows = await sql<CapsuleImageRow>`
    select id, draft, saved
    from capsules
    where draft is not null or saved is not null
    order by updated_at asc
  `;
  return Array.isArray(rows) ? rows : [];
}

async function listSharedCapsuleImageRows(): Promise<SharedCapsuleImageRow[]> {
  const sql = getSqlClient();
  const rows = await sql<SharedCapsuleImageRow>`
    select id, content
    from shared_capsules
    where content is not null
    order by updated_at asc
  `;
  return Array.isArray(rows) ? rows : [];
}

async function updateCapsuleImageRow(id: string, draft: JsonRecord | null, saved: JsonRecord | null): Promise<void> {
  const sql = getSqlClient();
  await sql`
    update capsules
    set
      draft = ${draft === null ? null : JSON.stringify(draft)},
      saved = ${saved === null ? null : JSON.stringify(saved)},
      updated_at = now()
    where id = ${id}
  `;
}

async function updateSharedCapsuleImageRow(id: string, content: JsonRecord): Promise<void> {
  const sql = getSqlClient();
  await sql`
    update shared_capsules
    set
      content = ${JSON.stringify(content)},
      content_hash = ${hashCapsuleContent(content)},
      updated_at = now()
    where id = ${id}
  `;
}

async function migrateSnapshotImages({
  snapshot,
  capsuleId,
  namespace,
  uploadImageToR2Impl,
  onUploaded,
  onSkipped,
  onFailed
}: {
  snapshot: JsonRecord | null;
  capsuleId: string;
  namespace: string;
  uploadImageToR2Impl: UploadImageToR2Like;
  onUploaded: () => void;
  onSkipped: () => void;
  onFailed: () => void;
}): Promise<{ snapshot: JsonRecord | null; changed: boolean }> {
  if (!isRecord(snapshot)) {
    return { snapshot, changed: false };
  }

  const nextSnapshot = cloneJson(snapshot);
  const data = isRecord(nextSnapshot.data) ? nextSnapshot.data : null;
  const wardrobe = isRecord(data?.wardrobe) ? data?.wardrobe as JsonRecord : null;
  const outfitSets = Array.isArray(wardrobe?.outfitSets) ? wardrobe.outfitSets : [];
  let changed = false;

  for (let index = 0; index < outfitSets.length; index += 1) {
    const outfitSet = outfitSets[index];
    if (!isRecord(outfitSet)) {
      continue;
    }

    const buffer = decodeLegacyBase64Image(outfitSet.image);
    if (!buffer) {
      onSkipped();
      continue;
    }

    try {
      const uploaded = await uploadImageToR2Impl({
        buffer,
        mimeType: "image/png",
        capsuleId,
        setIndex: index,
        namespace
      });
      outfitSet.image = uploaded.url;
      changed = true;
      onUploaded();
    } catch (error) {
      onFailed();
      console.error("[migrate-capsule-images-to-r2][upload-failed]", {
        capsuleId,
        namespace,
        setIndex: index,
        message: error instanceof Error ? error.message : "unknown_error"
      });
    }
  }

  return { snapshot: changed ? nextSnapshot : snapshot, changed };
}

async function migrateCapsuleImagesToR2({
  listCapsuleImageRowsImpl = listCapsuleImageRows,
  listSharedCapsuleImageRowsImpl = listSharedCapsuleImageRows,
  updateCapsuleImageRowImpl = updateCapsuleImageRow,
  updateSharedCapsuleImageRowImpl = updateSharedCapsuleImageRow,
  uploadImageToR2Impl = uploadImageToR2
}: {
  listCapsuleImageRowsImpl?: () => Promise<CapsuleImageRow[]>;
  listSharedCapsuleImageRowsImpl?: () => Promise<SharedCapsuleImageRow[]>;
  updateCapsuleImageRowImpl?: (id: string, draft: JsonRecord | null, saved: JsonRecord | null) => Promise<void>;
  updateSharedCapsuleImageRowImpl?: (id: string, content: JsonRecord) => Promise<void>;
  uploadImageToR2Impl?: UploadImageToR2Like;
} = {}): Promise<MigrationStats> {
  const stats: MigrationStats = {
    capsulesScanned: 0,
    capsulesUpdated: 0,
    sharedCapsulesScanned: 0,
    sharedCapsulesUpdated: 0,
    imagesUploaded: 0,
    imagesSkipped: 0,
    imagesFailed: 0
  };

  const onUploaded = () => { stats.imagesUploaded += 1; };
  const onSkipped = () => { stats.imagesSkipped += 1; };
  const onFailed = () => { stats.imagesFailed += 1; };

  for (const row of await listCapsuleImageRowsImpl()) {
    stats.capsulesScanned += 1;
    const draft = await migrateSnapshotImages({
      snapshot: row.draft,
      capsuleId: row.id,
      namespace: "capsules-draft",
      uploadImageToR2Impl,
      onUploaded,
      onSkipped,
      onFailed
    });
    const saved = await migrateSnapshotImages({
      snapshot: row.saved,
      capsuleId: row.id,
      namespace: "capsules-saved",
      uploadImageToR2Impl,
      onUploaded,
      onSkipped,
      onFailed
    });

    if (draft.changed || saved.changed) {
      await updateCapsuleImageRowImpl(row.id, draft.snapshot, saved.snapshot);
      stats.capsulesUpdated += 1;
    }
  }

  for (const row of await listSharedCapsuleImageRowsImpl()) {
    stats.sharedCapsulesScanned += 1;
    const content = await migrateSnapshotImages({
      snapshot: row.content,
      capsuleId: row.id,
      namespace: "shared-capsules",
      uploadImageToR2Impl,
      onUploaded,
      onSkipped,
      onFailed
    });

    if (content.changed && content.snapshot) {
      await updateSharedCapsuleImageRowImpl(row.id, content.snapshot);
      stats.sharedCapsulesUpdated += 1;
    }
  }

  console.info("[migrate-capsule-images-to-r2][completed]", JSON.stringify(stats));
  return stats;
}

export {
  migrateCapsuleImagesToR2,
  migrateSnapshotImages
};
export type { CapsuleImageRow, MigrationStats, SharedCapsuleImageRow };
