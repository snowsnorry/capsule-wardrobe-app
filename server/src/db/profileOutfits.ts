import {
  getFirstRow,
  getResultRows,
  getSqlClient,
  hasAffectedRows,
  type CreateOutfitInput,
  type OutfitLookupInput,
  type OutfitRow,
  type RenameOutfitInput,
  type UpdateOutfitSnapshotInput,
} from "./core.js";

type OutfitListInput = {
  email: string;
  limit?: number;
  offset?: number;
};

export async function createOutfitRecord({
  email,
  name,
  draft = null,
  saved = null,
}: CreateOutfitInput): Promise<OutfitRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<OutfitRow>`
    insert into outfits (
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
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function getOutfitByIdForEmail({
  email,
  outfitId,
}: OutfitLookupInput): Promise<OutfitRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<OutfitRow>`
    select
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from outfits
    where email = ${email} and id = ${outfitId}
    limit 1
  `,
  );
  return row || null;
}

export async function listRecentOutfitsByEmail({
  email,
  limit = 10,
  offset = 0,
}: OutfitListInput): Promise<OutfitRow[]> {
  const sql = getSqlClient();
  return getResultRows(
    await sql<OutfitRow>`
    select
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from outfits
    where email = ${email}
    order by updated_at desc, created_at desc, id desc
    limit ${limit}
    offset ${offset}
  `,
  );
}

export async function countOutfitsByEmail(email: string): Promise<number> {
  const sql = getSqlClient();
  const row = getFirstRow<{ total: number | string }>(
    await sql<{ total: number | string }>`
    select count(*) as total
    from outfits
    where email = ${email}
  `,
  );
  return Number(row?.total || 0);
}

export async function searchOutfitsByEmail({
  email,
  query,
  limit = 25,
}: {
  email: string;
  query: string;
  limit?: number;
}): Promise<OutfitRow[]> {
  const sql = getSqlClient();
  const normalizedQuery = `%${String(query || "")
    .trim()
    .toLowerCase()}%`;
  return getResultRows(
    await sql<OutfitRow>`
    select
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from outfits
    where email = ${email}
      and lower(name) like ${normalizedQuery}
    order by updated_at desc, created_at desc
    limit ${limit}
  `,
  );
}

export async function listOutfitNamesByEmail(email: string): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<{ name: string | null }>`
    select name
    from outfits
    where email = ${email}
  `,
  );
  return rows.map((row) => String(row?.name || "").trim()).filter(Boolean);
}

export async function updateOutfitSnapshotByIdForEmail({
  email,
  outfitId,
  draft,
}: UpdateOutfitSnapshotInput): Promise<OutfitRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<OutfitRow>`
    update outfits
    set
      draft = ${draft === null ? null : JSON.stringify(draft)},
      updated_at = now()
    where email = ${email} and id = ${outfitId}
    returning
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function renameOutfitByIdForEmail({
  email,
  outfitId,
  name,
}: RenameOutfitInput): Promise<OutfitRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<OutfitRow>`
    update outfits
    set
      name = ${name},
      updated_at = now()
    where email = ${email} and id = ${outfitId}
    returning
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function saveOutfitByIdForEmail({
  email,
  outfitId,
}: OutfitLookupInput): Promise<OutfitRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<OutfitRow>`
    update outfits
    set
      saved = coalesce(draft, saved),
      draft = null,
      updated_at = now()
    where email = ${email} and id = ${outfitId}
    returning
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function revertOutfitDraftByIdForEmail({
  email,
  outfitId,
}: OutfitLookupInput): Promise<OutfitRow | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<OutfitRow>`
    update outfits
    set
      draft = null,
      updated_at = now()
    where email = ${email} and id = ${outfitId}
    returning
      id,
      email,
      name,
      draft,
      saved,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `,
  );
  return row || null;
}

export async function deleteOutfitByIdForEmail({
  email,
  outfitId,
}: OutfitLookupInput): Promise<boolean> {
  const sql = getSqlClient();
  const result = await sql`
    delete from outfits
    where email = ${email} and id = ${outfitId}
    returning id
  `;
  return hasAffectedRows(result);
}
