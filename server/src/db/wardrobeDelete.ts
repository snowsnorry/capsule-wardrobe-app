import { getFirstRow, getResultRows, getSqlClient } from "./core.js";
import { toWardrobeUiItem } from "./wardrobeMapper.js";
import type { UserWardrobeRow } from "./wardrobeTypes.js";
import { normalizeOwnedWardrobeR2Keys } from "../wardrobeR2Keys.js";

type OwnedR2ImageKeysRow = {
  ownedR2ImageKeys: string[] | null;
};

function toDeletedWardrobeItem(row: UserWardrobeRow) {
  const item = toWardrobeUiItem(row);
  return {
    ...item,
    ownedR2ImageKeys: Array.isArray(row.ownedR2ImageKeys)
      ? row.ownedR2ImageKeys
      : [],
  };
}

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
        owned_r2_image_keys as "ownedR2ImageKeys",
        source,
        raw_image_url as "rawImageUrl",
        processing_status as "processingStatus",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
  );

  return row ? toDeletedWardrobeItem(row) : null;
}

async function listUploadedWardrobeR2KeysByEmail({
  email,
}: {
  email: string;
}): Promise<string[]> {
  const sql = getSqlClient();
  const rows = getResultRows(
    await sql<OwnedR2ImageKeysRow>`
      select owned_r2_image_keys as "ownedR2ImageKeys"
      from wardrobe
      where profile_email = ${email}
        and source = 'uploaded'
    `,
  );
  return normalizeOwnedWardrobeR2Keys({
    email,
    keys: rows.flatMap((row) =>
      Array.isArray(row.ownedR2ImageKeys) ? row.ownedR2ImageKeys : [],
    ),
  });
}

export { deleteUploadedWardrobeItemById, listUploadedWardrobeR2KeysByEmail };
