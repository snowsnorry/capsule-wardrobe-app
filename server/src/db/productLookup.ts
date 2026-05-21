import { getFirstRow, getSqlClient, type ProductSearchRow } from "./core.js";

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
      null::double precision as distance
    from products
    where products.url = ${normalizedUrl}
    limit 1
  `,
  );
}
