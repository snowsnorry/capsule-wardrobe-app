import { getResultRows, getSqlClient } from "./core.js";
import { toWardrobeUiItem } from "./wardrobeMapper.js";
import type { UserWardrobeRow } from "./wardrobeTypes.js";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";

type UploadedWardrobeItemInput = {
  imageUrl?: string | null;
  rawImageUrl?: string | null;
  url?: string | null;
};

type NormalizedUploadedWardrobeItem = {
  imageUrl: string;
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
  if (normalizedItems.length === 0) {
    return [];
  }

  const insertedIds = await insertUploadedWardrobeRows(email, normalizedItems);
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
        value ->> 'rawImageUrl' as raw_image_url,
        nullif(trim(value ->> 'url'), '') as url
      from jsonb_array_elements(${JSON.stringify(normalizedItems)}::jsonb)
    )
    insert into wardrobe (
      profile_email,
      image_url,
      url,
      source,
      raw_image_url,
      processing_status
    )
    select
      ${email},
      uploaded.image_url,
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
        wardrobe.embedding,
        wardrobe.source,
        wardrobe.raw_image_url as "rawImageUrl",
        wardrobe.processing_status as "processingStatus",
        wardrobe.created_at as "createdAt",
        wardrobe.updated_at as "updatedAt"
    )
    select *
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
            rawImageUrl,
            url,
          }
        : null;
    })
    .filter((item): item is NormalizedUploadedWardrobeItem => Boolean(item));
}

export { saveUploadedWardrobeItemsByEmail };
