import {
  getFirstRow,
  getResultRows,
  getSqlClient,
  type ProductSearchRow,
} from "./core.js";

export async function getProductByIdForEmail(
  id: unknown,
  profileEmail: unknown,
): Promise<ProductSearchRow | null> {
  const normalizedId = String(id || "").trim();
  const normalizedEmail = String(profileEmail || "").trim();
  if (!normalizedId) {
    return null;
  }

  const sql = getSqlClient();
  return getFirstRow(
    await sql<ProductSearchRow>`
    select
      products.id,
      products.name,
      products.url,
      products.description,
      products.brand,
      products.price,
      products.currency,
      products.availability,
      products.image_url as "imageUrl",
      products.audience,
      products.category,
      products.season,
      products.formality_level as "formalityLevel",
      products.style,
      products.occasions,
      products.color_base as "colorBase",
      products.pattern,
      products.finish,
      products.is_neutral as "isNeutral",
      products.composition,
      products.silhouette,
      products.fit,
      products.closure_type as "closureType",
      exists (
        select 1
        from wardrobe
        where wardrobe.profile_email = ${normalizedEmail || null}
          and wardrobe.source = 'from_catalog'
          and wardrobe.url = products.url
      ) as "isSavedToWardrobe",
      exists (
        select 1
        from user_liked_items
        where user_liked_items.user_email = ${normalizedEmail || null}
          and user_liked_items.item_url = products.url
      ) as "isLiked",
      null::double precision as distance
    from products
    where products.id = ${normalizedId}
    limit 1
  `,
  );
}

export async function getProductByUrlForEmail(
  url: unknown,
  profileEmail: unknown,
): Promise<ProductSearchRow | null> {
  const normalizedUrl = String(url || "").trim();
  const normalizedEmail = String(profileEmail || "").trim();
  if (!normalizedUrl) {
    return null;
  }

  const sql = getSqlClient();
  return getFirstRow(
    await sql<ProductSearchRow>`
    select
      products.id,
      products.name,
      products.url,
      products.description,
      products.brand,
      products.price,
      products.currency,
      products.availability,
      products.image_url as "imageUrl",
      products.audience,
      products.category,
      products.season,
      products.formality_level as "formalityLevel",
      products.style,
      products.occasions,
      products.color_base as "colorBase",
      products.pattern,
      products.finish,
      products.is_neutral as "isNeutral",
      products.composition,
      products.silhouette,
      products.fit,
      products.closure_type as "closureType",
      exists (
        select 1
        from wardrobe
        where wardrobe.profile_email = ${normalizedEmail || null}
          and wardrobe.source = 'from_catalog'
          and wardrobe.url = products.url
      ) as "isSavedToWardrobe",
      exists (
        select 1
        from user_liked_items
        where user_liked_items.user_email = ${normalizedEmail || null}
          and user_liked_items.item_url = products.url
      ) as "isLiked",
      null::double precision as distance
    from products
    where products.url = ${normalizedUrl}
    limit 1
  `,
  );
}

export async function getProductsByUrlsForEmailInOrder({
  urls = [],
  email,
}: {
  urls?: unknown[];
  email: unknown;
}): Promise<ProductSearchRow[]> {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  const normalizedUrls = urls
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const normalizedEmail = String(email || "").trim();
  if (normalizedUrls.length === 0) {
    return [];
  }

  const sql = getSqlClient();
  return getResultRows(
    await sql<ProductSearchRow>`
    select
      products.id,
      products.name,
      products.url,
      products.description,
      products.brand,
      products.price,
      products.currency,
      products.availability,
      products.image_url as "imageUrl",
      products.audience,
      products.category,
      products.season,
      products.formality_level as "formalityLevel",
      products.style,
      products.occasions,
      products.color_base as "colorBase",
      products.pattern,
      products.finish,
      products.is_neutral as "isNeutral",
      products.composition,
      products.silhouette,
      products.fit,
      products.closure_type as "closureType",
      exists (
        select 1
        from wardrobe
        where wardrobe.profile_email = ${normalizedEmail || null}
          and wardrobe.source = 'from_catalog'
          and wardrobe.url = products.url
      ) as "isSavedToWardrobe",
      null::double precision as distance
    from unnest(${normalizedUrls}::text[]) with ordinality as selected(url, position)
    join products on products.url = selected.url
    order by selected.position asc
  `,
  );
}
