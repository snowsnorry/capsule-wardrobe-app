import { getFirstRow, getSqlClient } from "./core.js";
import type {
  McpAuthorizationCodeRow,
  McpRegisteredClientRow,
} from "../mcp/types.js";

function normalizeRegisteredClientRow(
  row: McpRegisteredClientRow | null | undefined,
): McpRegisteredClientRow | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    redirectUris: Array.isArray(row.redirectUris) ? row.redirectUris : [],
  };
}

export async function insertMcpAuthorizationCode({
  codeHash,
  userEmail,
  clientId,
  redirectUri,
  codeChallenge,
  codeChallengeMethod,
  scopes,
  resource,
  expiresAt,
}: Omit<McpAuthorizationCodeRow, "consumedAt" | "createdAt">): Promise<void> {
  const sql = getSqlClient();
  await sql`
    insert into mcp_oauth_authorization_codes (
      code_hash,
      user_email,
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      scopes,
      resource,
      expires_at
    )
    values (
      ${codeHash},
      ${userEmail},
      ${clientId},
      ${redirectUri},
      ${codeChallenge},
      ${codeChallengeMethod},
      ${scopes},
      ${resource},
      ${expiresAt}
    )
  `;
}

export async function getMcpAuthorizationCode(
  codeHash: string,
): Promise<McpAuthorizationCodeRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<McpAuthorizationCodeRow>`
      select
        code_hash as "codeHash",
        user_email as "userEmail",
        client_id as "clientId",
        redirect_uri as "redirectUri",
        code_challenge as "codeChallenge",
        code_challenge_method as "codeChallengeMethod",
        scopes,
        resource,
        expires_at as "expiresAt",
        consumed_at as "consumedAt",
        created_at as "createdAt"
      from mcp_oauth_authorization_codes
      where code_hash = ${codeHash}
      limit 1
    `,
  );
  return row || null;
}

export async function consumeMcpAuthorizationCode({
  codeHash,
  clientId,
  redirectUri,
  codeChallenge,
  resource,
}: {
  codeHash: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
}): Promise<McpAuthorizationCodeRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<McpAuthorizationCodeRow>`
      update mcp_oauth_authorization_codes
      set consumed_at = now()
      where
        code_hash = ${codeHash}
        and client_id = ${clientId}
        and redirect_uri = ${redirectUri}
        and code_challenge = ${codeChallenge}
        and resource = ${resource}
        and consumed_at is null
        and expires_at > now()
      returning
        code_hash as "codeHash",
        user_email as "userEmail",
        client_id as "clientId",
        redirect_uri as "redirectUri",
        code_challenge as "codeChallenge",
        code_challenge_method as "codeChallengeMethod",
        scopes,
        resource,
        expires_at as "expiresAt",
        consumed_at as "consumedAt",
        created_at as "createdAt"
    `,
  );
  return row || null;
}

export async function hasActiveMcpGrant({
  userEmail,
  clientId,
  scopes,
  resource,
}: {
  userEmail: string;
  clientId: string;
  scopes: string;
  resource: string;
}): Promise<boolean> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<{ id: string }>`
      select id
      from mcp_oauth_grants
      where
        user_email = ${userEmail}
        and client_id = ${clientId}
        and scopes = ${scopes}
        and resource = ${resource}
        and revoked_at is null
      limit 1
    `,
  );
  return Boolean(row);
}

export async function upsertMcpGrant({
  userEmail,
  clientId,
  scopes,
  resource,
}: {
  userEmail: string;
  clientId: string;
  scopes: string;
  resource: string;
}): Promise<void> {
  if (await hasActiveMcpGrant({ userEmail, clientId, scopes, resource })) {
    return;
  }

  const sql = getSqlClient();
  await sql`
    insert into mcp_oauth_grants (user_email, client_id, scopes, resource)
    values (${userEmail}, ${clientId}, ${scopes}, ${resource})
  `;
}

export async function insertMcpRegisteredClient({
  clientId,
  clientName,
  redirectUris,
  scope,
}: {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  scope: string | null;
}): Promise<McpRegisteredClientRow> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<McpRegisteredClientRow>`
      insert into mcp_oauth_registered_clients (
        client_id,
        client_name,
        redirect_uris,
        scope,
        token_endpoint_auth_method,
        grant_types,
        response_types
      )
      values (
        ${clientId},
        ${clientName},
        ${JSON.stringify(redirectUris)}::jsonb,
        ${scope},
        'none',
        'authorization_code',
        'code'
      )
      returning
        client_id as "clientId",
        client_name as "clientName",
        redirect_uris as "redirectUris",
        scope,
        token_endpoint_auth_method as "tokenEndpointAuthMethod",
        grant_types as "grantTypes",
        response_types as "responseTypes",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
  );

  const normalized = normalizeRegisteredClientRow(row);
  if (!normalized) {
    throw new Error("mcp_registered_client_insert_failed");
  }
  return normalized;
}

export async function getMcpRegisteredClient(
  clientId: string,
): Promise<McpRegisteredClientRow | null> {
  const sql = getSqlClient();
  return normalizeRegisteredClientRow(
    getFirstRow(
      await sql<McpRegisteredClientRow>`
        select
          client_id as "clientId",
          client_name as "clientName",
          redirect_uris as "redirectUris",
          scope,
          token_endpoint_auth_method as "tokenEndpointAuthMethod",
          grant_types as "grantTypes",
          response_types as "responseTypes",
          created_at as "createdAt",
          updated_at as "updatedAt"
        from mcp_oauth_registered_clients
        where client_id = ${clientId}
        limit 1
      `,
    ),
  );
}
