import { afterEach, expect, test, vi } from "vitest";
import { setSqlClientOverride, type SqlClientLike } from "./core.js";
import {
  clearSearchProductStatsCache,
  searchProductStats,
} from "./searchStats.js";

afterEach(() => {
  clearSearchProductStatsCache();
  setSqlClientOverride(null);
  vi.useRealTimers();
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

test("searchProductStats caches identical stats requests", async () => {
  let calls = 0;
  const sql = (async <TRow = unknown>(
    _query: TemplateStringsArray,
    ..._queryValues: readonly unknown[]
  ) => {
    calls += 1;
    return calls === 1 ? ([{ total: 3 }] as TRow[]) : ([] as TRow[]);
  }) as SqlClientLike;
  setSqlClientOverride(sql);

  await searchProductStats({ category: ["top"], profileEmail: "a@test" });
  await searchProductStats({ category: ["top"], profileEmail: "a@test" });

  expect(calls).toBe(14);
});

test("searchProductStats does not extend stale cache ttl when refresh fails", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  let calls = 0;
  let fail = false;
  let total = 3;
  const sql = (async <TRow = unknown>(
    query: TemplateStringsArray,
    ..._queryValues: readonly unknown[]
  ) => {
    calls += 1;
    if (fail) {
      throw new Error("db_down");
    }
    const text = query.join(" ");
    return /count\(\*\)/i.test(text) && /\btotal\b/i.test(text)
      ? ([{ total }] as TRow[])
      : ([] as TRow[]);
  }) as SqlClientLike;
  setSqlClientOverride(sql);

  const first = await searchProductStats({
    category: ["top"],
    profileEmail: "a@test",
  });
  expect(first.total).toBe(3);
  expect(calls).toBe(14);

  vi.setSystemTime(new Date("2026-01-01T00:00:31.000Z"));
  fail = true;
  await expect(
    searchProductStats({ category: ["top"], profileEmail: "a@test" }),
  ).rejects.toThrow("db_down");
  const callsAfterFailure = calls;

  fail = false;
  total = 9;
  const second = await searchProductStats({
    category: ["top"],
    profileEmail: "a@test",
  });

  expect(second.total).toBe(9);
  expect(calls).toBeGreaterThan(callsAfterFailure);
});

test("searchProductStats dedupes in-flight identical stats requests", async () => {
  let calls = 0;
  const sql = (async <TRow = unknown>(
    _query: TemplateStringsArray,
    ..._queryValues: readonly unknown[]
  ) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 1));
    return calls === 1 ? ([{ total: 3 }] as TRow[]) : ([] as TRow[]);
  }) as SqlClientLike;
  setSqlClientOverride(sql);

  await Promise.all([
    searchProductStats({ category: ["top"], profileEmail: "a@test" }),
    searchProductStats({ category: ["top"], profileEmail: "a@test" }),
  ]);

  expect(calls).toBe(14);
});

test("searchProductStats cache keys include filters and profile email", async () => {
  let calls = 0;
  const sql = (async <TRow = unknown>(
    _query: TemplateStringsArray,
    ..._queryValues: readonly unknown[]
  ) => {
    calls += 1;
    return calls % 14 === 1 ? ([{ total: 3 }] as TRow[]) : ([] as TRow[]);
  }) as SqlClientLike;
  setSqlClientOverride(sql);

  await searchProductStats({ category: ["top"], profileEmail: "a@test" });
  await searchProductStats({ category: ["dress"], profileEmail: "a@test" });
  await searchProductStats({ category: ["top"], profileEmail: "b@test" });

  expect(calls).toBe(42);
});

test("searchProductStats cache keys canonicalize array filter order", async () => {
  let calls = 0;
  const sql = (async <TRow = unknown>(
    _query: TemplateStringsArray,
    ..._queryValues: readonly unknown[]
  ) => {
    calls += 1;
    return calls === 1 ? ([{ total: 3 }] as TRow[]) : ([] as TRow[]);
  }) as SqlClientLike;
  setSqlClientOverride(sql);

  await searchProductStats({
    category: ["top", "dress"],
    profileEmail: "a@test",
  });
  await searchProductStats({
    category: ["dress", "top"],
    profileEmail: "a@test",
  });

  expect(calls).toBe(14);
});

test("searchProductStats limits parallel database queries", async () => {
  let active = 0;
  let maxActive = 0;
  const sql = (async <TRow = unknown>(
    _query: TemplateStringsArray,
    ..._queryValues: readonly unknown[]
  ) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return maxActive === 1 ? ([{ total: 3 }] as TRow[]) : ([] as TRow[]);
  }) as SqlClientLike;
  setSqlClientOverride(sql);

  await searchProductStats({ category: ["top"], profileEmail: "a@test" });

  expect(maxActive).toBeLessThanOrEqual(4);
});
