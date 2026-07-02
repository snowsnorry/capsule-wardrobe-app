import { getResultRows, getSqlClient } from "./core.js";
import { toWardrobeUiItem } from "./wardrobeMapper.js";
import type { UserWardrobeRow } from "./wardrobeTypes.js";
import { normalizeOwnedWardrobeR2Keys } from "../wardrobeR2Keys.js";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";

type UploadedWardrobeItemInput = {
  imageUrl?: string | null;
  ownedR2ImageKeys?: unknown[] | null;
  rawImageUrl?: string | null;
  url?: string | null;
};

type NormalizedUploadedWardrobeItem = {
  imageUrl: string;
  ownedR2ImageKeys: string[];
  rawImageUrl: string;
  url: string | null;
};

async function saveUploadedWardrobeItemsByEmail({
  email,
  imageUrls,
  items,
}: {
  email: string;
  imageUrls?: string[];
  items?: UploadedWardrobeItemInput[];
}): Promise<Array<Record<string, unknown>>> {
  const normalizedItems = normalizeUploadedWardrobeItems({ imageUrls, items });
  const ownedItems = normalizedItems.map((item) => ({
    ...item,
    ownedR2ImageKeys: normalizeOwnedWardrobeR2Keys({
      email,
      keys: item.ownedR2ImageKeys,
    }),
  }));
  if (ownedItems.length === 0) {
    return [];
  }

  const insertedIds = await insertUploadedWardrobeRows(email, ownedItems);
  if (insertedIds.length === 0) {
    return [];
  }

  return (await listUploadedWardrobeRowsByIds(insertedIds)).map(
    toWardrobeUiItem,
  );
}

async function insertUploadedWardrobeRows(
  email: string,
  normalizedItems: NormalizedUploadedWardrobeItem[],
) {
  const sql = getSqlClient();
  const insertedRows = getResultRows(
    await sql<Pick<UserWardrobeRow, "id">>`
    with uploaded as (
      select
        value ->> 'imageUrl' as image_url,
        coalesce(
          array(
            select jsonb_array_elements_text(
              coalesce(value -> 'ownedR2ImageKeys', '[]'::jsonb)
            )
          ),
          '{}'::text[]
        ) as owned_r2_image_keys,
        value ->> 'rawImageUrl' as raw_image_url,
        nullif(trim(value ->> 'url'), '') as url
      from jsonb_array_elements(${JSON.stringify(normalizedItems)}::jsonb)
    )
    insert into wardrobe (
      profile_email,
      image_url,
      owned_r2_image_keys,
      url,
      source,
      raw_image_url,
      processing_status
    )
    select
      ${email},
      uploaded.image_url,
      uploaded.owned_r2_image_keys,
      uploaded.url,
      'uploaded',
      uploaded.raw_image_url,
      'uploaded'
    from uploaded
    returning id
  `,
  );
  return insertedRows.map((row) => String(row.id || "").trim());
}

async function listUploadedWardrobeRowsByIds(insertedIds: string[]) {
  const sql = getSqlClient();
  return getResultRows(
    await sql<UserWardrobeRow>`
    with updated as (
      update wardrobe
      set
        url = coalesce(nullif(trim(wardrobe.url), ''), 'wardrobe://' || wardrobe.id),
        updated_at = now()
      where wardrobe.id::text = any(${insertedIds}::text[])
      returning
        wardrobe.id,
        wardrobe.profile_email as "profileEmail",
        wardrobe.product_id as "productId",
        wardrobe.name,
        wardrobe.url,
        wardrobe.description,
        wardrobe.brand,
        wardrobe.price,
        wardrobe.currency,
        wardrobe.availability,
        wardrobe.image_url as "imageUrl",
        wardrobe.owned_r2_image_keys as "ownedR2ImageKeys",
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
    )
    select
      updated.id,
      updated."profileEmail",
      updated."productId",
      updated.name,
      updated.url,
      updated.description,
      updated.brand,
      updated.price,
      updated.currency,
      updated.availability,
      updated."imageUrl",
      updated."ownedR2ImageKeys",
      updated.audience,
      updated.category,
      updated.season,
      updated."formalityLevel",
      updated.style,
      updated.occasions,
      updated."colorBase",
      updated.pattern,
      updated.finish,
      updated."isNeutral",
      updated.composition,
      updated.silhouette,
      updated.fit,
      updated."closureType",
      updated.source,
      updated."rawImageUrl",
      updated."processingStatus",
      updated."createdAt",
      updated."updatedAt"
    from updated
    order by array_position(${insertedIds}::text[], updated.id::text)
  `,
  );
}

function normalizeUploadedWardrobeItems({
  imageUrls,
  items,
}: {
  imageUrls?: string[];
  items?: UploadedWardrobeItemInput[];
}): NormalizedUploadedWardrobeItem[] {
  const sourceItems = Array.isArray(items)
    ? items
    : Array.isArray(imageUrls)
      ? imageUrls.map((imageUrl) => ({ imageUrl, rawImageUrl: imageUrl }))
      : [];

  return sourceItems
    .map((item) => {
      const imageUrl = getSafeHttpUrl(item?.imageUrl);
      const rawImageUrl = getSafeHttpUrl(item?.rawImageUrl) || imageUrl;
      const url = getSafeHttpUrl(item?.url) || null;
      return imageUrl && rawImageUrl
        ? {
            imageUrl,
            ownedR2ImageKeys: Array.isArray(item?.ownedR2ImageKeys)
              ? item.ownedR2ImageKeys
              : [],
            rawImageUrl,
            url,
          }
        : null;
    })
    .filter((item): item is NormalizedUploadedWardrobeItem => Boolean(item));
}

export { saveUploadedWardrobeItemsByEmail };
