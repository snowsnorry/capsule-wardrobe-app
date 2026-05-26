/* eslint-disable max-lines */
import {
  getFirstRow,
  getResultRows,
  getSqlClient,
  hasAffectedRows,
} from "./core.js";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
import type { UserWardrobeRow, UserWardrobeSource } from "./wardrobeTypes.js";

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

function normalizeWardrobeSource(source: unknown): UserWardrobeSource | null {
  return source === "uploaded" || source === "from_catalog" ? source : null;
}

function toWardrobeUiItem(row: UserWardrobeRow): Record<string, unknown> {
  return {
    id: row.id,
    profileEmail: row.profileEmail,
    productId: row.productId,
    name: row.name,
    url: row.url,
    description: row.description,
    brand: row.brand,
    price: row.price,
    currency: row.currency,
    availability: row.availability,
    imageUrl: row.imageUrl,
    audience: row.audience,
    category: row.category,
    season: row.season,
    formalityLevel: row.formalityLevel,
    style: row.style,
    occasions: row.occasions,
    colorBase: row.colorBase,
    pattern: row.pattern,
    finish: row.finish,
    isNeutral: row.isNeutral,
    composition: row.composition,
    silhouette: row.silhouette,
    fit: row.fit,
    closureType: row.closureType,
    source: row.source,
    rawImageUrl: row.rawImageUrl,
    processingStatus: row.processingStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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

// eslint-disable-next-line max-lines-per-function
export async function saveWardrobeItemFromCatalogByUrl({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<Record<string, unknown> | null> {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<UserWardrobeRow>`
    insert into wardrobe (
      profile_email,
      product_id,
      name,
      url,
      description,
      brand,
      price,
      currency,
      availability,
      image_url,
      audience,
      category,
      season,
      formality_level,
      style,
      occasions,
      color_base,
      pattern,
      finish,
      is_neutral,
      composition,
      silhouette,
      fit,
      closure_type,
      embedding,
      source,
      processing_status
    )
    select
      ${email},
      products.id::text,
      products.name,
      products.url,
      products.description,
      products.brand,
      products.price,
      products.currency,
      products.availability,
      products.image_url,
      products.audience,
      products.category,
      products.season,
      products.formality_level,
      products.style,
      products.occasions,
      products.color_base,
      products.pattern,
      products.finish,
      products.is_neutral,
      products.composition,
      products.silhouette,
      products.fit,
      products.closure_type,
      products.embedding,
      'from_catalog',
      'ready'
    from products
    where products.url = ${url}
    on conflict (profile_email, url)
    where source = 'from_catalog' and url is not null
    do update set
      product_id = excluded.product_id,
      name = excluded.name,
      description = excluded.description,
      brand = excluded.brand,
      price = excluded.price,
      currency = excluded.currency,
      availability = excluded.availability,
      image_url = excluded.image_url,
      audience = excluded.audience,
      category = excluded.category,
      season = excluded.season,
      formality_level = excluded.formality_level,
      style = excluded.style,
      occasions = excluded.occasions,
      color_base = excluded.color_base,
      pattern = excluded.pattern,
      finish = excluded.finish,
      is_neutral = excluded.is_neutral,
      composition = excluded.composition,
      silhouette = excluded.silhouette,
      fit = excluded.fit,
      closure_type = excluded.closure_type,
      embedding = excluded.embedding,
      processing_status = 'ready',
      updated_at = now()
    returning
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
  `,
  );

  return row ? toWardrobeUiItem(row) : null;
}

export async function saveUploadedWardrobeItemsByEmail({
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

export async function deleteWardrobeItemFromCatalogByUrl({
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

export { toWardrobeUiItem };
