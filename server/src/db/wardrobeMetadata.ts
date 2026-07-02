import { getFirstRow, getSqlClient } from "./core.js";
import { toWardrobeUiItem } from "./wardrobeMapper.js";
import type { UserWardrobeRow } from "./wardrobeTypes.js";
import { normalizeOwnedWardrobeR2Keys } from "../wardrobeR2Keys.js";
import {
  calculateWardrobeImageIsNeutral,
  type WardrobeImageAnalysisMetadata,
} from "../wardrobeImageAnalysis.js";
import type { UploadedWardrobeItemDetails } from "../wardrobeUploadedItemUpdate.js";

type UploadedWardrobeMetadataUpdate = {
  email: string;
  embedding?: number[] | null;
  id: string;
  metadata?: WardrobeImageAnalysisMetadata | null;
  imageUrl?: string | null;
  ownedR2ImageKeys?: unknown[] | null;
  processingStatus: "metadata_processed" | "needs_review" | "ready" | "failed";
};

function formatEmbeddingVector(embedding: number[] | null | undefined) {
  return Array.isArray(embedding) && embedding.length > 0
    ? `[${embedding.join(",")}]`
    : null;
}

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
        owned_r2_image_keys as "ownedR2ImageKeys",
        source,
        raw_image_url as "rawImageUrl",
        processing_status as "processingStatus",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
  );
  return row ? toWardrobeUiItem(row) : null;
}

// The SQL statement intentionally stays together so metadata and owned R2 keys update atomically.
// eslint-disable-next-line max-lines-per-function
async function markUploadedWardrobeItemMetadataProcessed({
  email,
  embedding = null,
  id,
  imageUrl = null,
  metadata,
  ownedR2ImageKeys = [],
  processingStatus = "metadata_processed",
}: {
  email: string;
  embedding?: number[] | null;
  id: string;
  imageUrl?: string | null;
  metadata: WardrobeImageAnalysisMetadata;
  ownedR2ImageKeys?: unknown[] | null;
  processingStatus?: "metadata_processed" | "needs_review" | "ready" | "failed";
}) {
  const sql = getSqlClient();
  const normalizedImageUrl = String(imageUrl || "").trim() || null;
  const normalizedOwnedR2ImageKeys = normalizeOwnedWardrobeR2Keys({
    email,
    keys: ownedR2ImageKeys,
  });
  const embeddingVector = formatEmbeddingVector(embedding);
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
      embedding = ${embeddingVector}::vector,
      image_url = coalesce(${normalizedImageUrl}, image_url),
      owned_r2_image_keys = case
        when cardinality(${normalizedOwnedR2ImageKeys}::text[]) > 0 then (
          select coalesce(array_agg(key order by first_position), '{}'::text[])
          from (
            select key, min(position) as first_position
            from unnest(
              wardrobe.owned_r2_image_keys || ${normalizedOwnedR2ImageKeys}::text[]
            ) with ordinality as keys(key, position)
            where nullif(trim(key), '') is not null
            group by key
          ) deduped
        )
        else owned_r2_image_keys
      end,
      processing_status = ${processingStatus},
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
      owned_r2_image_keys as "ownedR2ImageKeys",
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
  embedding = null,
  id,
  imageUrl = null,
  metadata,
  ownedR2ImageKeys = [],
  processingStatus,
}: UploadedWardrobeMetadataUpdate): Promise<Record<string, unknown> | null> {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return null;
  }

  if (!metadata) {
    return markUploadedWardrobeItemFailed(email, normalizedId);
  }

  return markUploadedWardrobeItemMetadataProcessed({
    embedding,
    email,
    imageUrl,
    id: normalizedId,
    metadata,
    ownedR2ImageKeys,
    processingStatus,
  });
}

async function updateUploadedWardrobeItemDetailsById({
  email,
  embedding = null,
  id,
  details,
  processingStatus = "ready",
}: {
  email: string;
  embedding?: number[] | null;
  id: string;
  details: UploadedWardrobeItemDetails;
  processingStatus?: "ready" | "failed";
}): Promise<Record<string, unknown> | null> {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return null;
  }

  const sql = getSqlClient();
  const isNeutral = calculateWardrobeImageIsNeutral({
    ...details,
    isNeutral: null,
  });
  const embeddingVector = formatEmbeddingVector(embedding);
  const row = getFirstRow(
    await sql<UserWardrobeRow>`
      update wardrobe
      set
        name = ${details.name},
        description = ${details.description},
        brand = ${details.brand},
        audience = ${details.audience},
        category = ${details.category},
        season = ${details.season},
        formality_level = ${details.formalityLevel},
        style = ${details.style},
        occasions = ${details.occasions},
        color_base = ${details.colorBase},
        is_neutral = ${isNeutral},
        pattern = ${details.pattern},
        finish = ${details.finish},
        composition = ${details.composition},
        silhouette = ${details.silhouette},
        fit = ${details.fit},
        closure_type = ${details.closureType},
        embedding = ${embeddingVector}::vector,
        processing_status = ${processingStatus},
        updated_at = now()
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
        owned_r2_image_keys as "ownedR2ImageKeys",
        source,
        raw_image_url as "rawImageUrl",
        processing_status as "processingStatus",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
  );

  return row ? toWardrobeUiItem(row) : null;
}

export {
  updateUploadedWardrobeItemDetailsById,
  updateUploadedWardrobeItemMetadataById,
};
