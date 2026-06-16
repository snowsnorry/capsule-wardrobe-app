import {
  getFirstRow,
  getResultRows,
  getSqlClient,
  hasAffectedRows,
  type CapsuleLookupInput,
  type CapsuleRow,
  type CreateCapsuleInput,
  type RenameCapsuleInput,
  type SharedCapsuleRow,
  type UpdateCapsuleReportInput,
  type UpdateCapsulePinInput,
  type UpdateCapsuleSavedSnapshotInput,
  type UpdateCapsuleSnapshotInput,
  type UpsertSharedCapsuleInput,
} from "./core.js";

type CapsuleListInput = {
  email: string;
  limit?: number;
  offset?: number;
};

export async function createCapsuleRecord({
  email,
  name,
  draft = null,
  saved = null,
}: CreateCapsuleInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<CapsuleRow>`
    insert into capsules (
      email,
      name,
      draft,
      saved
    )
    values (
      ${email},
      ${name},
      ${draft === null ? null : JSON.stringify(draft)},
      ${saved === null ? null : JSON.stringify(saved)}
    )
    returning
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function getCapsuleByIdForEmail({
  email,
  capsuleId,
}: CapsuleLookupInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<CapsuleRow>`
    select
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from capsules
    where email = ${email} and id = ${capsuleId}
    limit 1
  `,
  );
  return row || null;
}

export async function listRecentCapsulesByEmail({
  email,
  limit = 10,
  offset = 0,
}: CapsuleListInput): Promise<CapsuleRow[]> {
  const sql = getSqlClient();
  return getResultRows(
    await sql<CapsuleRow>`
    select
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from capsules
    where email = ${email}
    order by pin desc, updated_at desc, created_at desc, id desc
    limit ${limit}
    offset ${offset}
  `,
  );
}

export async function countCapsulesByEmail(email: string): Promise<number> {
  const sql = getSqlClient();
  const row = getFirstRow<{ total: number | string }>(
    await sql<{ total: number | string }>`
    select count(*) as total
    from capsules
    where email = ${email}
  `,
  );
  return Number(row?.total || 0);
}

export async function searchCapsulesByEmail({
  email,
  query,
  limit = 25,
}: {
  email: string;
  query: string;
  limit?: number;
}): Promise<CapsuleRow[]> {
  const sql = getSqlClient();
  const normalizedQuery = `%${String(query || "")
    .trim()
    .toLowerCase()}%`;
  return getResultRows(
    await sql<CapsuleRow>`
    select
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from capsules
    where email = ${email}
      and lower(name) like ${normalizedQuery}
    order by pin desc, updated_at desc, created_at desc, id desc
    limit ${limit}
  `,
  );
}

export async function listCapsuleNamesByEmail(
  email: string,
): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<{ name: string | null }>`
    select name
    from capsules
    where email = ${email}
  `,
  );
  return rows.map((row) => String(row?.name || "").trim()).filter(Boolean);
}

export async function updateCapsuleSnapshotByIdForEmail({
  email,
  capsuleId,
  draft,
}: UpdateCapsuleSnapshotInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const draftJson = draft === null ? null : JSON.stringify(draft);
  const row = getFirstRow(
    await sql<CapsuleRow>`
    update capsules
    set
      draft = case
        when ${draftJson}::jsonb is null then null
        when not (${draftJson}::jsonb ? 'report')
          and (
            coalesce(draft ? 'report', false) or
            coalesce(saved ? 'report', false)
          )
          then jsonb_set(
            ${draftJson}::jsonb,
            '{report}',
            coalesce(draft -> 'report', saved -> 'report'),
            true
          )
        else ${draftJson}::jsonb
      end,
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function updateCapsuleSavedSnapshotByIdForEmail({
  email,
  capsuleId,
  saved,
}: UpdateCapsuleSavedSnapshotInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<CapsuleRow>`
    update capsules
    set
      saved = ${saved === null ? null : JSON.stringify(saved)},
      draft = null,
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function updateCapsuleReportByIdForEmail({
  email,
  capsuleId,
  report,
}: UpdateCapsuleReportInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const reportJson = JSON.stringify(report);
  const row = getFirstRow(
    await sql<CapsuleRow>`
    update capsules
    set
      draft = case
        when draft is not null then jsonb_set(draft, '{report}', ${reportJson}::jsonb, true)
        else draft
      end,
      saved = case
        when saved is not null and (draft is null or draft = saved)
          then jsonb_set(saved, '{report}', ${reportJson}::jsonb, true)
        else saved
      end,
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function renameCapsuleByIdForEmail({
  email,
  capsuleId,
  name,
}: RenameCapsuleInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<CapsuleRow>`
    update capsules
    set
      name = ${name},
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function updateCapsulePinByIdForEmail({
  email,
  capsuleId,
  pin,
}: UpdateCapsulePinInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<CapsuleRow>`
    update capsules
    set
      pin = ${pin},
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function saveCapsuleByIdForEmail({
  email,
  capsuleId,
}: CapsuleLookupInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<CapsuleRow>`
    update capsules
    set
      saved = coalesce(draft, saved),
      draft = null,
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function revertCapsuleDraftByIdForEmail({
  email,
  capsuleId,
}: CapsuleLookupInput): Promise<CapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<CapsuleRow>`
    update capsules
    set
      draft = null,
      updated_at = now()
    where email = ${email} and id = ${capsuleId}
    returning
      id,
      email,
      name,
      pin,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function deleteCapsuleByIdForEmail({
  email,
  capsuleId,
}: CapsuleLookupInput): Promise<boolean> {
  const sql = getSqlClient();
  const result = await sql`
    delete from capsules
    where email = ${email} and id = ${capsuleId}
    returning id
  `;
  return hasAffectedRows(result);
}

export async function upsertSharedCapsule({
  profileEmail,
  name,
  content,
  contentHash,
  expiresAt,
}: UpsertSharedCapsuleInput): Promise<SharedCapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<SharedCapsuleRow>`
    insert into shared_capsules (
      profile_email,
      name,
      content,
      content_hash,
      expires_at
    )
    values (
      ${profileEmail},
      ${name},
      ${JSON.stringify(content)},
      ${contentHash},
      ${expiresAt}
    )
    on conflict (profile_email, name, content_hash)
    do update set
      expires_at = excluded.expires_at,
      updated_at = now()
    returning
      id,
      profile_email as "profileEmail",
      name,
      content,
      content_hash as "contentHash",
      expires_at as "expiresAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function getValidSharedCapsuleById(
  id: string,
): Promise<SharedCapsuleRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<SharedCapsuleRow>`
    select
      id,
      profile_email as "profileEmail",
      name,
      content,
      content_hash as "contentHash",
      expires_at as "expiresAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from shared_capsules
    where id = ${id} and expires_at > now()
    limit 1
  `,
  );
  return row || null;
}

export async function pruneExpiredSharedCapsules(): Promise<void> {
  const sql = getSqlClient();
  await sql`delete from shared_capsules where expires_at < now()`;
}

export * from "./profiles.js";
