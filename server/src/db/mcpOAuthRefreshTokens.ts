import { getFirstRow, getSqlClient } from "./core.js";
import type { McpRefreshTokenRow } from "../mcp/types.js";

export async function insertMcpRefreshToken({
  tokenHash,
  userEmail,
  clientId,
  scopes,
  resource,
  expiresAt,
}: Omit<
  McpRefreshTokenRow,
  "revokedAt" | "createdAt" | "consumedAt"
>): Promise<void> {
  const sql = getSqlClient();
  await sql`
    insert into mcp_oauth_refresh_tokens (
      token_hash,
      user_email,
      client_id,
      scopes,
      resource,
      expires_at
    )
    values (
      ${tokenHash},
      ${userEmail},
      ${clientId},
      ${scopes},
      ${resource},
      ${expiresAt}
    )
  `;
}

export async function getMcpRefreshToken(
  tokenHash: string,
): Promise<McpRefreshTokenRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<McpRefreshTokenRow>`
      select
        token_hash as "tokenHash",
        user_email as "userEmail",
        client_id as "clientId",
        scopes,
        resource,
        expires_at as "expiresAt",
        revoked_at as "revokedAt",
        created_at as "createdAt",
        consumed_at as "consumedAt"
      from mcp_oauth_refresh_tokens
      where token_hash = ${tokenHash}
      limit 1
    `,
  );
  return row || null;
}

export async function rotateMcpRefreshToken({
  tokenHash,
  newTokenHash,
  clientId,
  scopes,
  resource,
  expiresAt,
}: {
  tokenHash: string;
  newTokenHash: string;
  clientId: string;
  scopes: string;
  resource: string;
  expiresAt: Date;
}): Promise<McpRefreshTokenRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<McpRefreshTokenRow>`
      with consumed as (
        update mcp_oauth_refresh_tokens
        set consumed_at = now()
        where
          token_hash = ${tokenHash}
          and client_id = ${clientId}
          and resource = ${resource}
          and revoked_at is null
          and consumed_at is null
          and expires_at > now()
        returning user_email, client_id, resource
      ),
      inserted as (
        insert into mcp_oauth_refresh_tokens (
          token_hash,
          user_email,
          client_id,
          scopes,
          resource,
          expires_at
        )
        select
          ${newTokenHash},
          user_email,
          client_id,
          ${scopes},
          resource,
          ${expiresAt}
        from consumed
        returning
          token_hash as "tokenHash",
          user_email as "userEmail",
          client_id as "clientId",
          scopes,
          resource,
          expires_at as "expiresAt",
          revoked_at as "revokedAt",
          created_at as "createdAt",
          consumed_at as "consumedAt"
      )
      select *
      from inserted
      limit 1
    `,
  );
  return row || null;
}

export async function revokeMcpRefreshToken(
  tokenHash: string,
): Promise<boolean> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<{ tokenHash: string }>`
      update mcp_oauth_refresh_tokens
      set revoked_at = now()
      where
        token_hash = ${tokenHash}
        and revoked_at is null
      returning token_hash as "tokenHash"
    `,
  );
  return Boolean(row);
}
