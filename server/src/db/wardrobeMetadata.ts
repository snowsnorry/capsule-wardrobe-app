import { getFirstRow, getSqlClient } from "./core.js";
import { toWardrobeUiItem } from "./wardrobe.js";
import type { UserWardrobeRow } from "./wardrobeTypes.js";
import type { WardrobeImageAnalysisMetadata } from "../wardrobeImageAnalysis.js";

type UploadedWardrobeMetadataUpdate = {
  email: string;
  id: string;
  metadata?: WardrobeImageAnalysisMetadata | null;
  processingStatus: "metadata_processed" | "failed";
};

async function markUploadedWardrobeItemFailed(email: string, id: string) {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<UserWardrobeRow>`
      update wardrobe
      set
        processing_status = 'failed',
        updated_at = now()
      where profile_email = ${email}
        and id = ${id}
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

async function markUploadedWardrobeItemMetadataProcessed({
  email,
  id,
  metadata,
}: {
  email: string;
  id: string;
  metadata: WardrobeImageAnalysisMetadata;
}) {
  const sql = getSqlClient();
  const row = getFirstRow(
    await sql<UserWardrobeRow>`
    update wardrobe
    set
      name = ${metadata.name},
      description = ${metadata.description},
      brand = ${metadata.brand},
      audience = ${metadata.audience},
      category = ${metadata.category},
      season = ${metadata.season},
      formality_level = ${metadata.formality_level},
      style = ${metadata.style},
      occasions = ${metadata.occasions},
      color_base = ${metadata.color_base},
      is_neutral = ${metadata.is_neutral},
      pattern = ${metadata.pattern},
      finish = ${metadata.finish},
      composition = ${metadata.composition},
      silhouette = ${metadata.silhouette},
      fit = ${metadata.fit},
      closure_type = ${metadata.closure_type},
      processing_status = 'metadata_processed',
      updated_at = now()
    where profile_email = ${email}
      and id = ${id}
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

async function updateUploadedWardrobeItemMetadataById({
  email,
  id,
  metadata,
  processingStatus,
}: UploadedWardrobeMetadataUpdate): Promise<Record<string, unknown> | null> {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return null;
  }

  if (processingStatus === "failed" || !metadata) {
    return markUploadedWardrobeItemFailed(email, normalizedId);
  }

  return markUploadedWardrobeItemMetadataProcessed({
    email,
    id: normalizedId,
    metadata,
  });
}

export { updateUploadedWardrobeItemMetadataById };
