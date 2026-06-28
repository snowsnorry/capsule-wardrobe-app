import { getFirstRow, getSqlClient, type SqlResultLike } from "./core.js";

export type PruneExpiredRecordsResult = {
  jobRuns: number;
  loginCodes: number;
  mcpOAuthAuthorizationCodes: number;
  mcpOAuthRefreshTokens: number;
  passkeyChallenges: number;
  sharedCapsules: number;
  userSessions: number;
};

const MCP_REFRESH_TOKEN_RETENTION_DAYS = 7;

function rowCount(row: { count?: number | string } | null): number {
  return Number(row?.count || 0);
}

async function deleteCounted(
  query: Promise<SqlResultLike<{ count?: number | string }>>,
): Promise<number> {
  const row = getFirstRow(await query);
  return rowCount(row);
}

export async function pruneExpiredRecords(): Promise<PruneExpiredRecordsResult> {
  const sql = getSqlClient();
  const refreshTokenRetention = `${MCP_REFRESH_TOKEN_RETENTION_DAYS} days`;

  const loginCodes = await deleteCounted(sql<{ count: number | string }>`
    with deleted as (
      delete from login_codes
      where expires_at <= now() or consumed_at is not null
      returning 1
    )
    select count(*)::integer as count from deleted
  `);
  const userSessions = await deleteCounted(sql<{ count: number | string }>`
    with deleted as (
      delete from user_sessions
      where expires_at <= now()
      returning 1
    )
    select count(*)::integer as count from deleted
  `);
  const sharedCapsules = await deleteCounted(sql<{ count: number | string }>`
    with deleted as (
      delete from shared_capsules
      where expires_at < now()
      returning 1
    )
    select count(*)::integer as count from deleted
  `);
  const passkeyChallenges = await deleteCounted(sql<{ count: number | string }>`
    with deleted as (
      delete from passkey_challenges
      where expires_at <= now() or consumed_at is not null
      returning 1
    )
    select count(*)::integer as count from deleted
  `);
  const mcpOAuthAuthorizationCodes = await deleteCounted(
    sql<{ count: number | string }>`
    with deleted as (
      delete from mcp_oauth_authorization_codes
      where expires_at <= now() or consumed_at is not null
      returning 1
    )
    select count(*)::integer as count from deleted
  `,
  );
  const mcpOAuthRefreshTokens = await deleteCounted(
    sql<{ count: number | string }>`
    with deleted as (
      delete from mcp_oauth_refresh_tokens
      where
        expires_at <= now() - ${refreshTokenRetention}::interval
        or consumed_at <= now() - ${refreshTokenRetention}::interval
        or revoked_at <= now() - ${refreshTokenRetention}::interval
      returning 1
    )
    select count(*)::integer as count from deleted
  `,
  );
  const jobRuns = await deleteCounted(sql<{ count: number | string }>`
    with deleted as (
      delete from job_runs
      where expires_at is not null and expires_at <= now()
      returning 1
    )
    select count(*)::integer as count from deleted
  `);

  return {
    jobRuns,
    loginCodes,
    mcpOAuthAuthorizationCodes,
    mcpOAuthRefreshTokens,
    passkeyChallenges,
    sharedCapsules,
    userSessions,
  };
}
