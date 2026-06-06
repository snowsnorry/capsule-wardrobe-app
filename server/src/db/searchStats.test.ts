import { afterEach, expect, test } from "vitest";
import { setSqlClientOverride, type SqlClientLike } from "./core.js";
import { searchProductStats } from "./searchStats.js";

afterEach(() => {
  setSqlClientOverride(null);
});

test("searchProductStats applies liked-only filters with the profile email", async () => {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async <TRow = unknown>(
    query: TemplateStringsArray,
    ...queryValues: readonly unknown[]
  ) => {
    statements.push(query.join("?").replace(/\s+/g, " ").trim());
    values.push([...queryValues]);
    return statements.length === 1
      ? ([{ total: 0 }] as TRow[])
      : ([] as TRow[]);
  }) as SqlClientLike;
  setSqlClientOverride(sql);

  await searchProductStats({
    likedOnly: true,
    profileEmail: "person@example.com",
  });

  expect(statements.join("\n")).toMatch(/from user_liked_items/i);
  expect(values.flat()).toContain(true);
  expect(values.flat()).toContain("person@example.com");
});
