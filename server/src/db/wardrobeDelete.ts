import { getFirstRow, getSqlClient } from "./core.js";
import { toWardrobeUiItem } from "./wardrobe.js";
import type { UserWardrobeRow } from "./wardrobeTypes.js";

async function deleteUploadedWardrobeItemById({
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
      delete from wardrobe
      where profile_email = ${email}
        and id = ${normalizedId}
        and source = 'uploaded'
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

export { deleteUploadedWardrobeItemById };
