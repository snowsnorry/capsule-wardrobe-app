import {
  getFirstRow,
  getResultRows,
  getSqlClient,
  hasAffectedRows,
  type PasskeyChallengeRow,
  type PasskeyRow,
} from "./core.js";

export function normalizePasskeyRow(row: PasskeyRow | null): PasskeyRow | null {
  if (!row) {
    return null;
  }
  return {
    ...row,
    counter: Number(row.counter || 0),
    transports: Array.isArray(row.transports) ? row.transports : [],
  };
}

export async function listPasskeysByEmail(
  email: string,
): Promise<PasskeyRow[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<PasskeyRow>`
    select
      id::text as id,
      profile_email as "profileEmail",
      credential_id as "credentialId",
      credential_public_key as "credentialPublicKey",
      counter,
      device_type as "deviceType",
      backed_up as "backedUp",
      transports,
      name,
      aaguid,
      last_used_at as "lastUsedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from profile_passkeys
    where profile_email = ${email}
    order by created_at desc
  `,
  );
  return rows.map((row) => normalizePasskeyRow(row)).filter(Boolean);
}

export async function insertPasskey({
  profileEmail,
  credentialId,
  credentialPublicKey,
  counter,
  deviceType,
  backedUp,
  transports,
  name,
  aaguid,
}: {
  profileEmail: string;
  credentialId: string;
  credentialPublicKey: string;
  counter: number;
  deviceType: string | null;
  backedUp: boolean | null;
  transports: string[];
  name: string | null;
  aaguid: string | null;
}): Promise<PasskeyRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<PasskeyRow>`
    insert into profile_passkeys (
      profile_email,
      credential_id,
      credential_public_key,
      counter,
      device_type,
      backed_up,
      transports,
      name,
      aaguid
    )
    values (
      ${profileEmail},
      ${credentialId},
      ${credentialPublicKey},
      ${counter},
      ${deviceType},
      ${backedUp},
      ${transports},
      ${name},
      ${aaguid}
    )
    returning
      id::text as id,
      profile_email as "profileEmail",
      credential_id as "credentialId",
      credential_public_key as "credentialPublicKey",
      counter,
      device_type as "deviceType",
      backed_up as "backedUp",
      transports,
      name,
      aaguid,
      last_used_at as "lastUsedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return normalizePasskeyRow(row);
}

export async function getPasskeyByCredentialId(
  credentialId: string,
): Promise<PasskeyRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<PasskeyRow>`
    select
      id::text as id,
      profile_email as "profileEmail",
      credential_id as "credentialId",
      credential_public_key as "credentialPublicKey",
      counter,
      device_type as "deviceType",
      backed_up as "backedUp",
      transports,
      name,
      aaguid,
      last_used_at as "lastUsedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from profile_passkeys
    where credential_id = ${credentialId}
    limit 1
  `,
  );
  return normalizePasskeyRow(row);
}

export async function updatePasskeyAuthentication({
  credentialId,
  counter,
  deviceType,
  backedUp,
}: {
  credentialId: string;
  counter: number;
  deviceType: string | null;
  backedUp: boolean | null;
}): Promise<PasskeyRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<PasskeyRow>`
    update profile_passkeys
    set
      counter = ${counter},
      device_type = coalesce(${deviceType}, device_type),
      backed_up = coalesce(${backedUp}, backed_up),
      last_used_at = now(),
      updated_at = now()
    where credential_id = ${credentialId}
    returning
      id::text as id,
      profile_email as "profileEmail",
      credential_id as "credentialId",
      credential_public_key as "credentialPublicKey",
      counter,
      device_type as "deviceType",
      backed_up as "backedUp",
      transports,
      name,
      aaguid,
      last_used_at as "lastUsedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return normalizePasskeyRow(row);
}

export async function deletePasskeyByIdForEmail({
  email,
  passkeyId,
}: {
  email: string;
  passkeyId: string;
}): Promise<boolean> {
  const sql = getSqlClient();
  const result = await sql`
    delete from profile_passkeys
    where profile_email = ${email} and id::text = ${passkeyId}
    returning id
  `;
  return hasAffectedRows(result);
}

export async function insertPasskeyChallenge({
  id,
  kind,
  challenge,
  profileEmail,
  expiresAt,
}: {
  id: string;
  kind: string;
  challenge: string;
  profileEmail: string | null;
  expiresAt: Date;
}): Promise<void> {
  const sql = getSqlClient();
  await sql`
    insert into passkey_challenges (id, kind, challenge, profile_email, expires_at)
    values (${id}, ${kind}, ${challenge}, ${profileEmail}, ${expiresAt})
  `;
}

export async function consumePasskeyChallenge({
  id,
  kind,
}: {
  id: string;
  kind: string;
}): Promise<PasskeyChallengeRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<PasskeyChallengeRow>`
    update passkey_challenges
    set consumed_at = now()
    where
      id = ${id}
      and kind = ${kind}
      and consumed_at is null
      and expires_at > now()
    returning
      id,
      kind,
      challenge,
      profile_email as "profileEmail",
      expires_at as "expiresAt",
      consumed_at as "consumedAt",
      created_at as "createdAt"
  `,
  );
  return row || null;
}

export async function pruneExpiredPasskeyChallenges(): Promise<void> {
  const sql = getSqlClient();
  await sql`
    delete from passkey_challenges
    where expires_at <= now() or consumed_at is not null
  `;
}
