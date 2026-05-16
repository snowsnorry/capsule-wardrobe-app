import { test, expect, afterEach } from "vitest";
import {
  setSqlClientOverride,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
import {
  checkDatabaseConnection,
  ensureAuthTables,
  ensureCapsulesTable,
  ensurePasskeysTables,
  ensureProfilesTable,
  ensureSearchTable,
  ensureSharedCapsulesTable,
  ensureWardrobeTable,
  ensureTables,
} from "./schema.js";

function createSqlRecorder(results: SqlResultLike[] = []) {
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

test("checkDatabaseConnection returns the first database probe row", async () => {
  createSqlRecorder([[{ database: "capsule", now: "2026-05-07T00:00:00Z" }]]);

  expect(await checkDatabaseConnection()).toEqual({
    database: "capsule",
    now: "2026-05-07T00:00:00Z",
  });
});

test("ensure auth, profile, passkey, capsule, shared capsule, and search schemas issue their DDL", async () => {
  const { statements } = createSqlRecorder();

  await ensureAuthTables();
  await ensureProfilesTable();
  await ensurePasskeysTables();
  await ensureCapsulesTable();
  await ensureSharedCapsulesTable();
  await ensureWardrobeTable();
  await ensureSearchTable();

  expect(
    statements.some((statement) =>
      statement.includes("create table if not exists login_codes"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("create table if not exists user_sessions"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("create table if not exists profiles"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) => statement.includes("profiles_theme_check")),
  ).toBeTruthy();
  expect(
    statements.some((statement) => statement.includes("profiles_llm_check")),
  ).toBeTruthy();
  expect(
    statements.some((statement) => statement.includes("profile_passkeys")),
  ).toBeTruthy();
  expect(
    statements.some((statement) => statement.includes("passkey_challenges")),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("create table if not exists capsules"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("create table if not exists shared_capsules"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("create table if not exists wardrobe"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("id bigserial primary key"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("user_wardrobe_items_raw_image_url_http_check"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("wardrobe_url_scheme_check"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("^(https?://|wardrobe://)"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("wardrobe_profile_email_from_catalog_url_idx"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("create table if not exists search"),
    ),
  ).toBeTruthy();
});

test("ensureTables runs every schema group in dependency order", async () => {
  const { statements } = createSqlRecorder();

  await ensureTables();

  const joined = statements.join("\n");
  expect(joined).toMatch(/create table if not exists login_codes/);
  expect(joined).toMatch(/create table if not exists profiles/);
  expect(joined).toMatch(/create table if not exists profile_passkeys/);
  expect(joined).toMatch(/create table if not exists capsules/);
  expect(joined).toMatch(/create table if not exists shared_capsules/);
  expect(joined).toMatch(/create table if not exists wardrobe/);
  expect(joined).toMatch(/create table if not exists search/);
  expect(
    joined.indexOf("create table if not exists profiles") <
      joined.indexOf("create table if not exists profile_passkeys"),
  ).toBeTruthy();
});
