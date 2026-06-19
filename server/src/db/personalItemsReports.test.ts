import { afterEach, expect, test } from "vitest";
import {
  setSqlClientOverride,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
import {
  deletePersonalItemsReportByEmail,
  getPersonalItemsReportByEmail,
  upsertPersonalItemsReportByEmail,
} from "./personalItemsReports.js";

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

test("getPersonalItemsReportByEmail returns the stored row", async () => {
  const { statements, values } = createSqlRecorder([
    [
      {
        email: "person@example.com",
        generatedAt: "2026-06-19T10:00:00.000Z",
        personalItemUrls: ["wardrobe://1"],
        report: { schemaVersion: 1 },
      },
    ],
  ]);

  await expect(
    getPersonalItemsReportByEmail("person@example.com"),
  ).resolves.toMatchObject({
    email: "person@example.com",
    personalItemUrls: ["wardrobe://1"],
    report: { schemaVersion: 1 },
  });
  expect(statements[0]).toContain("from personal_items_reports");
  expect(values[0]).toEqual(["person@example.com"]);
});

test("upsertPersonalItemsReportByEmail stores sorted unique URLs", async () => {
  const { statements, values } = createSqlRecorder([
    [
      {
        email: "person@example.com",
        generatedAt: "2026-06-19T10:00:00.000Z",
        personalItemUrls: ["https://example.com/2", "wardrobe://1"],
        report: { schemaVersion: 1 },
      },
    ],
  ]);

  await expect(
    upsertPersonalItemsReportByEmail({
      email: "person@example.com",
      personalItemUrls: [
        "wardrobe://1",
        "https://example.com/2",
        "wardrobe://1",
      ],
      report: { schemaVersion: 1 },
    }),
  ).resolves.toMatchObject({
    personalItemUrls: ["https://example.com/2", "wardrobe://1"],
  });
  expect(statements[0]).toContain("on conflict (email) do update");
  expect(values[0]).toEqual([
    "person@example.com",
    JSON.stringify({ schemaVersion: 1 }),
    ["https://example.com/2", "wardrobe://1"],
  ]);
});

test("deletePersonalItemsReportByEmail reports whether a row was removed", async () => {
  createSqlRecorder([[{ email: "person@example.com" }]]);
  await expect(
    deletePersonalItemsReportByEmail("person@example.com"),
  ).resolves.toBe(true);

  setSqlClientOverride(null);
  createSqlRecorder([[]]);
  await expect(
    deletePersonalItemsReportByEmail("person@example.com"),
  ).resolves.toBe(false);
});
