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

test("searchProductStats keeps array filters aligned with products GIN indexes", async () => {
  const statements: string[] = [];
  const sql = (async <TRow = unknown>(
    query: TemplateStringsArray,
    ..._queryValues: readonly unknown[]
  ) => {
    statements.push(query.join("?").replace(/\s+/g, " ").trim());
    return statements.length === 1
      ? ([{ total: 0 }] as TRow[])
      : ([] as TRow[]);
  }) as SqlClientLike;
  setSqlClientOverride(sql);

  await searchProductStats({
    color: ["black"],
    closureType: ["zip"],
    formalityLevel: ["casual"],
    occasions: ["office"],
    season: ["winter"],
    style: ["minimalistic"],
  });

  const joinedStatements = statements.join("\n");

  expect(joinedStatements).toContain("season &&");
  expect(joinedStatements).toContain("formality_level &&");
  expect(joinedStatements).toContain("style &&");
  expect(joinedStatements).toContain("occasions &&");
  expect(joinedStatements).toContain("color_base &&");
  expect(joinedStatements).toContain("closure_type &&");
  expect(joinedStatements).not.toMatch(
    /coalesce\((season|formality_level|style|occasions|color_base|closure_type), array\[\]::text\[\]\) &&/i,
  );
});
