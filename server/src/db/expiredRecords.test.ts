import { afterEach, expect, test } from "vitest";
import {
  setSqlClientOverride,
  type SqlClientLike,
  type SqlResultLike,
} from "./core.js";
import { pruneExpiredRecords } from "./expiredRecords.js";

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

test("pruneExpiredRecords deletes expired transient records and returns counts", async () => {
  const { statements, values } = useQueuedSql([
    [{ count: 1 }],
    [{ count: "2" }],
    [{ count: 3 }],
    [{ count: 4 }],
    [{ count: 5 }],
    [{ count: 6 }],
    [{ count: 7 }],
  ]);

  await expect(pruneExpiredRecords()).resolves.toEqual({
    jobRuns: 7,
    loginCodes: 1,
    mcpOAuthAuthorizationCodes: 5,
    mcpOAuthRefreshTokens: 6,
    passkeyChallenges: 4,
    sharedCapsules: 3,
    userSessions: 2,
  });

  expect(statements[0]).toContain("delete from login_codes");
  expect(statements[0]).toContain(
    "where expires_at <= now() or consumed_at is not null",
  );
  expect(statements[1]).toContain("delete from user_sessions");
  expect(statements[1]).toContain("where expires_at <= now()");
  expect(statements[2]).toContain("delete from shared_capsules");
  expect(statements[2]).toContain("where expires_at < now()");
  expect(statements[3]).toContain("delete from passkey_challenges");
  expect(statements[3]).toContain(
    "where expires_at <= now() or consumed_at is not null",
  );
  expect(statements[4]).toContain("delete from mcp_oauth_authorization_codes");
  expect(statements[4]).toContain(
    "where expires_at <= now() or consumed_at is not null",
  );
  expect(statements[5]).toContain("delete from mcp_oauth_refresh_tokens");
  expect(statements[5]).toContain("expires_at <= now() - ?::interval");
  expect(statements[5]).toContain("consumed_at <= now() - ?::interval");
  expect(statements[5]).toContain("revoked_at <= now() - ?::interval");
  expect(values[5]).toEqual(["7 days", "7 days", "7 days"]);
  expect(statements[6]).toContain("delete from job_runs");
  expect(statements[6]).toContain(
    "where expires_at is not null and expires_at <= now()",
  );
});

test("pruneExpiredRecords treats missing count rows as zero", async () => {
  useQueuedSql([
    [],
    [{ count: 0 }],
    [{}],
    [],
    [{ count: "0" }],
    [],
    [{ count: 0 }],
  ]);

  await expect(pruneExpiredRecords()).resolves.toEqual({
    jobRuns: 0,
    loginCodes: 0,
    mcpOAuthAuthorizationCodes: 0,
    mcpOAuthRefreshTokens: 0,
    passkeyChallenges: 0,
    sharedCapsules: 0,
    userSessions: 0,
  });
});
