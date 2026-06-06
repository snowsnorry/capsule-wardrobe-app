import { getResultRows, getSqlClient, hasAffectedRows } from "./core.js";

type LikedItemRow = {
  itemUrl: string | null;
};

function normalizeLikedItemUrl(value: unknown): string {
  return String(value || "").trim();
}

export async function listLikedItemUrlsByEmail(
  email: string,
): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<LikedItemRow>`
    select item_url as "itemUrl"
    from user_liked_items
    where user_email = ${email}
    order by item_url asc
  `,
  );

  return rows.map((row) => normalizeLikedItemUrl(row.itemUrl)).filter(Boolean);
}

export async function upsertLikedItemByUrl({
  email,
  itemUrl,
}: {
  email: string;
  itemUrl: string;
}): Promise<string> {
  const normalizedItemUrl = normalizeLikedItemUrl(itemUrl);
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<LikedItemRow>`
    insert into user_liked_items (user_email, item_url)
    values (${email}, ${normalizedItemUrl})
    on conflict (user_email, item_url)
    do update set updated_at = now()
    returning item_url as "itemUrl"
  `,
  );

  return normalizeLikedItemUrl(rows[0]?.itemUrl);
}

export async function deleteLikedItemByUrl({
  email,
  itemUrl,
}: {
  email: string;
  itemUrl: string;
}): Promise<boolean> {
  const normalizedItemUrl = normalizeLikedItemUrl(itemUrl);
  const sql = getSqlClient();
  const result = await sql`
    delete from user_liked_items
    where user_email = ${email}
      and item_url = ${normalizedItemUrl}
    returning item_url
  `;

  return hasAffectedRows(result);
}
