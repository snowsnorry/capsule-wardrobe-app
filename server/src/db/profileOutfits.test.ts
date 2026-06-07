import { afterEach, describe, expect, test } from "vitest";
import {
  setSqlClientOverride,
  type OutfitRow,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
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
} from "./profileOutfits.js";

function useQueuedSql(results: SqlResultLike[]) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async (
    strings: TemplateStringsArray,
    ...queryValues: readonly unknown[]
  ) => {
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

const outfitRow: OutfitRow = {
  id: "outfit-1",
  email: "person@example.com",
  name: "Weekend",
  draft: { items: [] },
  saved: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("profile outfit persistence helpers", () => {
  test("creates, reads, lists, counts, and searches profile-owned outfits", async () => {
    const { statements, values } = useQueuedSql([
      [outfitRow],
      [],
      [outfitRow],
      [outfitRow],
      [{ total: "3" }],
      [outfitRow],
      [{ name: "Weekend" }, { name: " " }, { name: null }],
    ]);

    await expect(
      createOutfitRecord({
        email: "person@example.com",
        name: "Weekend",
        draft: { items: [] },
        saved: null,
      }),
    ).resolves.toEqual(outfitRow);
    await expect(
      createOutfitRecord({
        email: "person@example.com",
        name: "Missing",
        draft: null,
        saved: { items: [] },
      }),
    ).resolves.toBeNull();
    await expect(
      getOutfitByIdForEmail({
        email: "person@example.com",
        outfitId: "outfit-1",
      }),
    ).resolves.toEqual(outfitRow);
    await expect(
      listRecentOutfitsByEmail({
        email: "person@example.com",
        limit: 5,
        offset: 10,
      }),
    ).resolves.toEqual([outfitRow]);
    await expect(countOutfitsByEmail("person@example.com")).resolves.toBe(3);
    await expect(
      searchOutfitsByEmail({
        email: "person@example.com",
        query: " Weekend ",
        limit: 4,
      }),
    ).resolves.toEqual([outfitRow]);
    await expect(listOutfitNamesByEmail("person@example.com")).resolves.toEqual(
      ["Weekend"],
    );

    expect(statements[0]).toContain("insert into outfits");
    expect(values[0]).toEqual([
      "person@example.com",
      "Weekend",
      JSON.stringify({ items: [] }),
      null,
    ]);
    expect(values[1]).toEqual([
      "person@example.com",
      "Missing",
      null,
      JSON.stringify({ items: [] }),
    ]);
    expect(values[2]).toEqual(["person@example.com", "outfit-1"]);
    expect(values[3]).toEqual(["person@example.com", 5, 10]);
    expect(values[4]).toEqual(["person@example.com"]);
    expect(values[5]).toEqual(["person@example.com", "%weekend%", 4]);
  });

  test("updates mutable outfit state and reports deletion by affected rows", async () => {
    const { values } = useQueuedSql([
      [outfitRow],
      [],
      [outfitRow],
      [outfitRow],
      [outfitRow],
      [{ id: "outfit-1" }],
      [],
    ]);

    await expect(
      updateOutfitSnapshotByIdForEmail({
        email: "person@example.com",
        outfitId: "outfit-1",
        draft: { items: [] },
      }),
    ).resolves.toEqual(outfitRow);
    await expect(
      updateOutfitSnapshotByIdForEmail({
        email: "person@example.com",
        outfitId: "missing",
        draft: null,
      }),
    ).resolves.toBeNull();
    await expect(
      renameOutfitByIdForEmail({
        email: "person@example.com",
        outfitId: "outfit-1",
        name: "Travel",
      }),
    ).resolves.toEqual(outfitRow);
    await expect(
      saveOutfitByIdForEmail({
        email: "person@example.com",
        outfitId: "outfit-1",
      }),
    ).resolves.toEqual(outfitRow);
    await expect(
      revertOutfitDraftByIdForEmail({
        email: "person@example.com",
        outfitId: "outfit-1",
      }),
    ).resolves.toEqual(outfitRow);
    await expect(
      deleteOutfitByIdForEmail({
        email: "person@example.com",
        outfitId: "outfit-1",
      }),
    ).resolves.toBe(true);
    await expect(
      deleteOutfitByIdForEmail({
        email: "person@example.com",
        outfitId: "missing",
      }),
    ).resolves.toBe(false);

    expect(values[0]).toEqual([
      JSON.stringify({ items: [] }),
      "person@example.com",
      "outfit-1",
    ]);
    expect(values[1]).toEqual([null, "person@example.com", "missing"]);
    expect(values[2]).toEqual(["Travel", "person@example.com", "outfit-1"]);
    expect(values.at(-1)).toEqual(["person@example.com", "missing"]);
  });
});
