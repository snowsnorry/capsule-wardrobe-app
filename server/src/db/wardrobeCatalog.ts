import { getFirstRow, getSqlClient, hasAffectedRows } from "./core.js";
import { executeSqlFile } from "./sqlFiles.js";
import { toWardrobeUiItem } from "./wardrobeMapper.js";
import type { UserWardrobeRow } from "./wardrobeTypes.js";

const SAVE_WARDROBE_ITEM_FROM_CATALOG_SQL_FILE = new URL(
  "./sql/save_wardrobe_item_from_catalog_by_url.sql",
  import.meta.url,
);

async function saveWardrobeItemFromCatalogByUrl({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<Record<string, unknown> | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await executeSqlFile<UserWardrobeRow>(
      sql,
      SAVE_WARDROBE_ITEM_FROM_CATALOG_SQL_FILE,
      [email, url],
    ),
  );

  return row ? toWardrobeUiItem(row) : null;
}

async function deleteWardrobeItemFromCatalogByUrl({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<boolean> {
  const sql = getSqlClient();
  const result = await sql`
    delete from wardrobe
    where profile_email = ${email}
      and source = 'from_catalog'
      and url = ${url}
    returning id
  `;

  return hasAffectedRows(result);
}

export { deleteWardrobeItemFromCatalogByUrl, saveWardrobeItemFromCatalogByUrl };
