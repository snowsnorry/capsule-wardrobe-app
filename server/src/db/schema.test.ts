import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { setSqlClientOverride, type SqlClientLike, type SqlResultLike } from "./core.js";
import {
  checkDatabaseConnection,
  ensureAuthTables,
  ensureCapsulesTable,
  ensurePasskeysTables,
  ensureProfilesTable,
  ensureSearchTable,
  ensureSharedCapsulesTable,
  ensureTables
} from "./schema.js";

function createSqlRecorder(results: SqlResultLike[] = []) {
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

test("checkDatabaseConnection returns the first database probe row", async () => {
  createSqlRecorder([[{ database: "capsule", now: "2026-05-07T00:00:00Z" }]]);

  assert.deepEqual(await checkDatabaseConnection(), {
    database: "capsule",
    now: "2026-05-07T00:00:00Z"
  });
});

test("ensure auth, profile, passkey, capsule, shared capsule, and search schemas issue their DDL", async () => {
  const { statements } = createSqlRecorder();

  await ensureAuthTables();
  await ensureProfilesTable();
  await ensurePasskeysTables();
  await ensureCapsulesTable();
  await ensureSharedCapsulesTable();
  await ensureSearchTable();

  assert.ok(statements.some((statement) => statement.includes("create table if not exists login_codes")));
  assert.ok(statements.some((statement) => statement.includes("create table if not exists user_sessions")));
  assert.ok(statements.some((statement) => statement.includes("create table if not exists profiles")));
  assert.ok(statements.some((statement) => statement.includes("profiles_theme_check")));
  assert.ok(statements.some((statement) => statement.includes("profiles_llm_check")));
  assert.ok(statements.some((statement) => statement.includes("profile_passkeys")));
  assert.ok(statements.some((statement) => statement.includes("passkey_challenges")));
  assert.ok(statements.some((statement) => statement.includes("create table if not exists capsules")));
  assert.ok(statements.some((statement) => statement.includes("create table if not exists shared_capsules")));
  assert.ok(statements.some((statement) => statement.includes("create table if not exists search")));
});

test("ensureTables runs every schema group in dependency order", async () => {
  const { statements } = createSqlRecorder();

  await ensureTables();

  const joined = statements.join("\n");
  assert.match(joined, /create table if not exists login_codes/);
  assert.match(joined, /create table if not exists profiles/);
  assert.match(joined, /create table if not exists profile_passkeys/);
  assert.match(joined, /create table if not exists capsules/);
  assert.match(joined, /create table if not exists shared_capsules/);
  assert.match(joined, /create table if not exists search/);
  assert.ok(
    joined.indexOf("create table if not exists profiles")
      < joined.indexOf("create table if not exists profile_passkeys")
  );
});
