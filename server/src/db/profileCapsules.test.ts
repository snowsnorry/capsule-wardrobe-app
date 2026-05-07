import { test, expect, afterEach } from "vitest";
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

  expect(await createCapsuleRecord({
    email: "person@example.com",
    name: "Work",
    draft: { selected: ["a"] },
    saved: null
  })).toEqual(capsule);
  expect(await getCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "capsule-1" })).toEqual(capsule);
  expect(await listRecentCapsulesByEmail({ email: "person@example.com", limit: 3 })).toEqual([capsule]);
  expect(await searchCapsulesByEmail({ email: "person@example.com", query: " Work ", limit: 2 })).toEqual([capsule]);
  expect(await listCapsuleNamesByEmail("person@example.com")).toEqual(["Work"]);
  expect(await updateCapsuleSnapshotByIdForEmail({
    email: "person@example.com",
    capsuleId: "capsule-1",
    draft: { selected: ["b"] }
  })).toEqual(capsule);
  expect(await renameCapsuleByIdForEmail({
    email: "person@example.com",
    capsuleId: "capsule-1",
    name: "Travel"
  })).toEqual(capsule);
  expect(await saveCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "capsule-1" })).toEqual(capsule);
  expect(await revertCapsuleDraftByIdForEmail({ email: "person@example.com", capsuleId: "capsule-1" })).toEqual(capsule);
  expect(values[0][2]).toBe(JSON.stringify({ selected: ["a"] }));
  expect(values[3][1]).toBe("%work%");
  expect(values[5][0]).toBe(JSON.stringify({ selected: ["b"] }));
});

test("capsule helpers return null or booleans for empty mutation results", async () => {
  useQueuedSql([[], [], [], [{ id: "capsule-1" }], []]);

  expect(await createCapsuleRecord({ email: "person@example.com", name: "Work" })).toBe(null);
  expect(await getCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "missing" })).toBe(null);
  expect(await updateCapsuleSnapshotByIdForEmail({
    email: "person@example.com",
    capsuleId: "missing",
    draft: null
  })).toBe(null);
  expect(await deleteCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "capsule-1" })).toBe(true);
  expect(await deleteCapsuleByIdForEmail({ email: "person@example.com", capsuleId: "missing" })).toBe(false);
});

test("shared capsule helpers upsert, read, and prune shared records", async () => {
  const { statements, values } = useQueuedSql([[sharedCapsule], [sharedCapsule], []]);

  expect(await upsertSharedCapsule({
    profileEmail: "person@example.com",
    name: "Work",
    content: { items: [] },
    contentHash: "hash",
    expiresAt: "expires"
  })).toEqual(sharedCapsule);
  expect(await getValidSharedCapsuleById("share-1")).toEqual(sharedCapsule);
  await pruneExpiredSharedCapsules();
  expect(values[0][2]).toBe(JSON.stringify({ items: [] }));
  expect(statements.at(-1)?.includes("delete from shared_capsules where expires_at < now()")).toBeTruthy();
});
