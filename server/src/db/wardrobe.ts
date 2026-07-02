import { getFirstRow, getResultRows, getSqlClient } from "./core.js";
import { normalizeWardrobeSource, toWardrobeUiItem } from "./wardrobeMapper.js";
import type { UserWardrobeRow, UserWardrobeSource } from "./wardrobeTypes.js";

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

export async function listWardrobeItemsByUrlsForEmail({
  email,
  urls,
  source,
}: {
  email: string;
  urls: unknown[];
  source: UserWardrobeSource;
}): Promise<Array<Record<string, unknown>>> {
  const normalizedUrls = Array.isArray(urls)
    ? urls.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const normalizedSource = normalizeWardrobeSource(source);
  if (normalizedUrls.length === 0 || !normalizedSource) {
    return [];
  }

  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<UserWardrobeRow>`
    select
      wardrobe.id,
      wardrobe.profile_email as "profileEmail",
      wardrobe.product_id as "productId",
      wardrobe.name,
      selected.url,
      wardrobe.description,
      wardrobe.brand,
      wardrobe.price,
      wardrobe.currency,
      wardrobe.availability,
      wardrobe.image_url as "imageUrl",
      wardrobe.audience,
      wardrobe.category,
      wardrobe.season,
      wardrobe.formality_level as "formalityLevel",
      wardrobe.style,
      wardrobe.occasions,
      wardrobe.color_base as "colorBase",
      wardrobe.pattern,
      wardrobe.finish,
      wardrobe.is_neutral as "isNeutral",
      wardrobe.composition,
      wardrobe.silhouette,
      wardrobe.fit,
      wardrobe.closure_type as "closureType",
      wardrobe.source,
      wardrobe.raw_image_url as "rawImageUrl",
      wardrobe.processing_status as "processingStatus",
      wardrobe.created_at as "createdAt",
      wardrobe.updated_at as "updatedAt"
    from unnest(${normalizedUrls}::text[]) with ordinality as selected(url, position)
    join wardrobe on (
      wardrobe.url = selected.url
      or (
        ${normalizedSource} = 'uploaded'
        and 'wardrobe://' || wardrobe.id::text = selected.url
      )
    )
    where wardrobe.profile_email = ${email}
      and wardrobe.source = ${normalizedSource}
    order by selected.position asc, wardrobe.id asc
  `,
  );

  return rows.map(toWardrobeUiItem);
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
