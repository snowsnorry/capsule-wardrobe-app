import { getFirstRow, getResultRows, getSqlClient } from "./core.js";
import { normalizeWardrobeSource, toWardrobeUiItem } from "./wardrobeMapper.js";
import type { UserWardrobeRow, UserWardrobeSource } from "./wardrobeTypes.js";

export { toWardrobeUiItem } from "./wardrobeMapper.js";
export {
  deleteWardrobeItemFromCatalogByUrl,
  saveWardrobeItemFromCatalogByUrl,
} from "./wardrobeCatalog.js";
export { saveUploadedWardrobeItemsByEmail } from "./wardrobeUploadedItems.js";

export async function listWardrobeItemsByEmail({
  email,
  source,
}: {
  email: string;
  source?: UserWardrobeSource | null;
}): Promise<Array<Record<string, unknown>>> {
  const sql = getSqlClient();
  const normalizedSource = normalizeWardrobeSource(source);

  const rows = getResultRows(
    await sql<UserWardrobeRow>`
    select
      id,
      profile_email as "profileEmail",
      product_id as "productId",
      name,
      url,
      description,
      brand,
      price,
      currency,
      availability,
      image_url as "imageUrl",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color_base as "colorBase",
      pattern,
      finish,
      is_neutral as "isNeutral",
      composition,
      silhouette,
      fit,
      closure_type as "closureType",
      embedding,
      source,
      raw_image_url as "rawImageUrl",
      processing_status as "processingStatus",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from wardrobe
    where profile_email = ${email}
      and (${normalizedSource}::text is null or source = ${normalizedSource})
    order by updated_at desc, created_at desc, id desc
  `,
  );

  return rows.map(toWardrobeUiItem);
}

export async function getUploadedWardrobeItemById({
  email,
  id,
}: {
  email: string;
  id: string;
}): Promise<Record<string, unknown> | null> {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return null;
  }

  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<UserWardrobeRow>`
    select
      id,
      profile_email as "profileEmail",
      product_id as "productId",
      name,
      url,
      description,
      brand,
      price,
      currency,
      availability,
      image_url as "imageUrl",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color_base as "colorBase",
      pattern,
      finish,
      is_neutral as "isNeutral",
      composition,
      silhouette,
      fit,
      closure_type as "closureType",
      embedding,
      source,
      raw_image_url as "rawImageUrl",
      processing_status as "processingStatus",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from wardrobe
    where profile_email = ${email}
      and id = ${normalizedId}
      and source = 'uploaded'
  `,
  );

  return row ? toWardrobeUiItem(row) : null;
}

export async function listWardrobeItemsByIdsForEmail({
  email,
  ids,
}: {
  email: string;
  ids: number[];
}): Promise<Array<Record<string, unknown>>> {
  const normalizedIds = [
    ...new Set(
      ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (normalizedIds.length === 0) {
    return [];
  }

  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<UserWardrobeRow>`
    select
      id,
      profile_email as "profileEmail",
      product_id as "productId",
      name,
      url,
      description,
      brand,
      price,
      currency,
      availability,
      image_url as "imageUrl",
      audience,
      category,
      season,
      formality_level as "formalityLevel",
      style,
      occasions,
      color_base as "colorBase",
      pattern,
      finish,
      is_neutral as "isNeutral",
      composition,
      silhouette,
      fit,
      closure_type as "closureType",
      embedding,
      source,
      raw_image_url as "rawImageUrl",
      processing_status as "processingStatus",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from wardrobe
    where profile_email = ${email}
      and id = any(${normalizedIds}::bigint[])
    order by array_position(${normalizedIds}::bigint[], id), id
  `,
  );

  return rows.map(toWardrobeUiItem);
}
