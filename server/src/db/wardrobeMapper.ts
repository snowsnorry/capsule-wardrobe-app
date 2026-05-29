import type { UserWardrobeRow, UserWardrobeSource } from "./wardrobeTypes.js";

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

export { normalizeWardrobeSource, toWardrobeUiItem };
