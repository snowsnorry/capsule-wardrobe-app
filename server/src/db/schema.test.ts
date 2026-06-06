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
  ensureLikedItemsTable,
  ensurePasskeysTables,
  ensureProfilesTable,
  ensureMcpOAuthTables,
  ensureSearchTable,
  ensureSharedCapsulesTable,
  ensureWardrobeTable,
  ensureTables,
} from "./schema.js";

function createSqlRecorder(results: SqlResultLike[] = []) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  const sql = (async <TRow = unknown>(
    query: string | TemplateStringsArray,
    ...queryValues: readonly unknown[]
  ): Promise<SqlResultLike<TRow>> => {
    if (typeof query === "string") {
      statements.push(query.replace(/\s+/g, " ").trim());
      values.push(
        Array.isArray(queryValues[0])
          ? [...(queryValues[0] as readonly unknown[])]
          : [...queryValues],
      );
      return (results.shift() ?? []) as SqlResultLike<TRow>;
    }

    statements.push(query.join("?").replace(/\s+/g, " ").trim());
    values.push([...queryValues]);
    return (results.shift() ?? []) as SqlResultLike<TRow>;
  }) as SqlClientLike & {
    query: <TRow = unknown>(
      query: string,
      values?: readonly unknown[],
    ) => Promise<SqlResultLike<TRow>>;
  };

  sql.query = async <TRow = unknown>(
    query: string,
    queryValues: readonly unknown[] = [],
  ): Promise<SqlResultLike<TRow>> => {
    statements.push(query.replace(/\s+/g, " ").trim());
    values.push([...queryValues]);
    return (results.shift() ?? []) as SqlResultLike<TRow>;
  };

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
  await ensureLikedItemsTable();
  await ensureMcpOAuthTables();
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
    statements.some((statement) =>
      statement.includes("theme text not null default 'system'"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("llm text not null default 'openai:gpt-5.5'"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes(
        "image_llm text not null default 'openai:gpt-image-2'",
      ),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) => statement.includes("profiles_theme_check")),
  ).toBeTruthy();
  expect(
    statements.some((statement) => statement.includes("profiles_llm_check")),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("profiles_image_llm_check"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) => statement.includes("profile_passkeys")),
  ).toBeTruthy();
  expect(
    statements.some((statement) => statement.includes("aaguid text null")),
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
      statement.includes("create table if not exists user_liked_items"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes(
        "user_email text not null references profiles(email) on delete cascade",
      ),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("primary key (user_email, item_url)"),
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
  expect(
    statements.some((statement) =>
      statement.includes(
        "create table if not exists mcp_oauth_authorization_codes",
      ),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("create table if not exists mcp_oauth_grants"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes(
        "create table if not exists mcp_oauth_registered_clients",
      ),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("create table if not exists mcp_oauth_refresh_tokens"),
    ),
  ).toBeTruthy();
  expect(
    statements.some((statement) =>
      statement.includes("mcp_oauth_refresh_tokens_active_idx"),
    ),
  ).toBeTruthy();

  const joined = statements.join("\n");
  expect(joined).not.toMatch(/alter table profiles/i);
  expect(joined).not.toMatch(/alter table profile_passkeys/i);
  expect(joined).not.toMatch(/update profiles\s+set\s+llm/i);
});

test("ensureTables runs every schema group in dependency order", async () => {
  const { statements } = createSqlRecorder();

  await ensureTables();

  const joined = statements.join("\n");
  expect(joined).toMatch(/create table if not exists login_codes/);
  expect(joined).toMatch(/create table if not exists profiles/);
  expect(joined).toMatch(/create table if not exists profile_passkeys/);
  expect(joined).toMatch(/create table if not exists user_liked_items/);
  expect(joined).toMatch(/create table if not exists capsules/);
  expect(joined).toMatch(/create table if not exists shared_capsules/);
  expect(joined).toMatch(/create table if not exists wardrobe/);
  expect(joined).toMatch(
    /create table if not exists mcp_oauth_authorization_codes/,
  );
  expect(joined).toMatch(/create table if not exists mcp_oauth_grants/);
  expect(joined).toMatch(
    /create table if not exists mcp_oauth_registered_clients/,
  );
  expect(joined).toMatch(/create table if not exists mcp_oauth_refresh_tokens/);
  expect(joined).toMatch(/create table if not exists search/);
  expect(
    joined.indexOf("create table if not exists profiles") <
      joined.indexOf("create table if not exists user_liked_items"),
  ).toBeTruthy();
  expect(
    joined.indexOf("create table if not exists user_liked_items") <
      joined.indexOf("create table if not exists profile_passkeys"),
  ).toBeTruthy();
});
