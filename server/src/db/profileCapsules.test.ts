import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { setSqlClientOverride, type CapsuleRow, type SharedCapsuleRow, type SqlClientLike, type SqlResultLike } from "./core.js";
import {
  createCapsuleRecord,
  deleteCapsuleByIdForEmail,
  getCapsuleByIdForEmail,
  getValidSharedCapsuleById,
  listCapsuleNamesByEmail,
  listRecentCapsulesByEmail,
  pruneExpiredSharedCapsules,
  renameCapsuleByIdForEmail,
  revertCapsuleDraftByIdForEmail,
  saveCapsuleByIdForEmail,
  searchCapsulesByEmail,
  updateCapsuleSnapshotByIdForEmail,
  upsertSharedCapsule
} from "./profileCapsules.js";

function useQueuedSql(results: SqlResultLike[]) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async (strings: TemplateStringsArray, ...queryValues: readonly unknown[]) => {
    statements.push(strings.join("?").replace(/\s+/g, " ").trim());
    values.push([...queryValues]);
    return results.shift() ?? [];
  }) as SqlClientLike;

  setSqlClientOverride(sql);
  return { statements, values };
}

afterEach(() => {
  setSqlClientOverride(null);
});

const capsule: CapsuleRow = {
  id: "capsule-1",
  email: "person@example.com",
  name: "Work",
  draft: { items: [] },
  saved: null,
  createdAt: "created",
  updatedAt: "updated"
};

const sharedCapsule: SharedCapsuleRow = {
  id: "share-1",
  profileEmail: "person@example.com",
  name: "Work",
  content: { items: [] },
  contentHash: "hash",
  expiresAt: "expires",
  createdAt: "created",
  updatedAt: "updated"
};

test("capsule record helpers map rows, json payloads, and query values", async () => {
  const { values } = useQueuedSql([
    [capsule],
    [capsule],
    [capsule],
    [capsule],
    [{ name: " Work " }, { name: "" }, { name: null }],
    [capsule],
    [capsule],
    [capsule],
    [capsule]
  ]);

  assert.deepEqual(await createCapsuleRecord({
    email: "person@example.com",
    name: "Work",
    draft: { selected: ["a"] },
    saved: null
  }), capsule);
  assert.deepEqual(await getCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "capsule-1" }), capsule);
  assert.deepEqual(await listRecentCapsulesByEmail({ email: "person@example.com", limit: 3 }), [capsule]);
  assert.deepEqual(await searchCapsulesByEmail({ email: "person@example.com", query: " Work ", limit: 2 }), [capsule]);
  assert.deepEqual(await listCapsuleNamesByEmail("person@example.com"), ["Work"]);
  assert.deepEqual(await updateCapsuleSnapshotByIdForEmail({
    email: "person@example.com",
    capsuleId: "capsule-1",
    draft: { selected: ["b"] }
  }), capsule);
  assert.deepEqual(await renameCapsuleByIdForEmail({
    email: "person@example.com",
    capsuleId: "capsule-1",
    name: "Travel"
  }), capsule);
  assert.deepEqual(await saveCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "capsule-1" }), capsule);
  assert.deepEqual(await revertCapsuleDraftByIdForEmail({ email: "person@example.com", capsuleId: "capsule-1" }), capsule);
  assert.equal(values[0][2], JSON.stringify({ selected: ["a"] }));
  assert.equal(values[3][1], "%work%");
  assert.equal(values[5][0], JSON.stringify({ selected: ["b"] }));
});

test("capsule helpers return null or booleans for empty mutation results", async () => {
  useQueuedSql([[], [], [], [{ id: "capsule-1" }], []]);

  assert.equal(await createCapsuleRecord({ email: "person@example.com", name: "Work" }), null);
  assert.equal(await getCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "missing" }), null);
  assert.equal(await updateCapsuleSnapshotByIdForEmail({
    email: "person@example.com",
    capsuleId: "missing",
    draft: null
  }), null);
  assert.equal(await deleteCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "capsule-1" }), true);
  assert.equal(await deleteCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "missing" }), false);
});

test("shared capsule helpers upsert, read, and prune shared records", async () => {
  const { statements, values } = useQueuedSql([[sharedCapsule], [sharedCapsule], []]);

  assert.deepEqual(await upsertSharedCapsule({
    profileEmail: "person@example.com",
    name: "Work",
    content: { items: [] },
    contentHash: "hash",
    expiresAt: "expires"
  }), sharedCapsule);
  assert.deepEqual(await getValidSharedCapsuleById("share-1"), sharedCapsule);
  await pruneExpiredSharedCapsules();
  assert.equal(values[0][2], JSON.stringify({ items: [] }));
  assert.ok(statements.at(-1)?.includes("delete from shared_capsules where expires_at < now()"));
});
