import { getFirstRow, getSqlClient, hasAffectedRows } from "./core.js";
import { toWardrobeUiItem } from "./wardrobeMapper.js";
import type { UserWardrobeRow } from "./wardrobeTypes.js";

// eslint-disable-next-line max-lines-per-function
async function saveWardrobeItemFromCatalogByUrl({
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
