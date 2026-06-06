import { afterEach, expect, test } from "vitest";
import {
  setSqlClientOverride,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
import {
  deleteLikedItemByUrl,
  listLikedItemUrlsByEmail,
  upsertLikedItemByUrl,
} from "./likedItems.js";

function createSqlRecorder(results: SqlResultLike[] = []) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async <TRow = unknown>(
    query: TemplateStringsArray,
    ...queryValues: readonly unknown[]
  ): Promise<SqlResultLike<TRow>> => {
    statements.push(query.join("?").replace(/\s+/g, " ").trim());
    values.push([...queryValues]);
    return (results.shift() ?? []) as SqlResultLike<TRow>;
  }) as SqlClientLike;

  setSqlClientOverride(sql);
  return { statements, values };
}

afterEach(() => {
  setSqlClientOverride(null);
});

test("listLikedItemUrlsByEmail returns liked canonical URLs", async () => {
  const { statements, values } = createSqlRecorder([
    [
      { itemUrl: "https://example.com/products/1" },
      { itemUrl: "wardrobe://uploaded-1" },
      { itemUrl: "" },
    ],
  ]);

  await expect(listLikedItemUrlsByEmail("person@example.com")).resolves.toEqual(
    ["https://example.com/products/1", "wardrobe://uploaded-1"],
  );
  expect(statements[0]).toContain("from user_liked_items");
  expect(values[0]).toEqual(["person@example.com"]);
});

test("upsertLikedItemByUrl is idempotent and returns the URL", async () => {
  const { statements, values } = createSqlRecorder([
    [{ itemUrl: "https://example.com/products/1" }],
  ]);

  await expect(
    upsertLikedItemByUrl({
      email: "person@example.com",
      itemUrl: "https://example.com/products/1",
    }),
  ).resolves.toBe("https://example.com/products/1");
  expect(statements[0]).toContain("on conflict (user_email, item_url)");
  expect(values[0]).toEqual([
    "person@example.com",
    "https://example.com/products/1",
  ]);
});

test("deleteLikedItemByUrl reports whether a like row was removed", async () => {
  const first = createSqlRecorder([[{ itemUrl: "wardrobe://uploaded-1" }]]);
  await expect(
    deleteLikedItemByUrl({
      email: "person@example.com",
      itemUrl: "wardrobe://uploaded-1",
    }),
  ).resolves.toBe(true);
  expect(first.statements[0]).toContain("delete from user_liked_items");

  setSqlClientOverride(null);
  createSqlRecorder([[]]);
  await expect(
    deleteLikedItemByUrl({
      email: "person@example.com",
      itemUrl: "wardrobe://uploaded-1",
    }),
  ).resolves.toBe(false);
});
