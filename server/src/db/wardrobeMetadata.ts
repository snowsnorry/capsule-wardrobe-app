import { getFirstRow, getSqlClient } from "./core.js";
import { toWardrobeUiItem } from "./wardrobe.js";
import type { UserWardrobeRow } from "./wardrobeTypes.js";
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
  processingStatus: "metadata_processed" | "ready" | "failed";
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
  embedding = null,
  id,
  imageUrl = null,
  metadata,
  processingStatus = "metadata_processed",
}: {
  email: string;
  embedding?: number[] | null;
  id: string;
  imageUrl?: string | null;
  metadata: WardrobeImageAnalysisMetadata;
  processingStatus?: "metadata_processed" | "ready" | "failed";
}) {
  const sql = getSqlClient();
  const normalizedImageUrl = String(imageUrl || "").trim() || null;
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
  embedding = null,
  id,
  imageUrl = null,
  metadata,
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
    is_neutral: null,
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
        formality_level = ${details.formality_level},
        style = ${details.style},
        occasions = ${details.occasions},
        color_base = ${details.color_base},
        is_neutral = ${isNeutral},
        pattern = ${details.pattern},
        finish = ${details.finish},
        composition = ${details.composition},
        silhouette = ${details.silhouette},
        fit = ${details.fit},
        closure_type = ${details.closure_type},
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

export {
  updateUploadedWardrobeItemDetailsById,
  updateUploadedWardrobeItemMetadataById,
};
