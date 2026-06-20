import type { PromptImageItemLike } from "./types.js";
import type { OutfitReportItem } from "./outfitReportTypes.js";
import { buildPromptImageThumbnailUrl } from "./promptImageThumbnails.js";

function getStringField(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function getArrayField(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function getItemId(item: Record<string, unknown>) {
  const id = item.id;
  return typeof id === "string" || typeof id === "number"
    ? String(id).trim()
    : "";
}

function isWardrobeOutfitItem(item: Record<string, unknown>) {
  const itemSource = getStringField(item, "itemSource", "item_source");
  if (itemSource === "wardrobe") {
    return true;
  }

  if (getStringField(item, "wardrobeId", "wardrobe_id")) {
    return true;
  }

  if (getStringField(item, "profileEmail", "profile_email")) {
    return true;
  }

  return getStringField(item, "source") === "uploaded";
}

function getOutfitReportPromptItemId(item: Record<string, unknown>) {
  const id = getItemId(item);
  if (!id || !isWardrobeOutfitItem(item) || id.startsWith("W")) {
    return id;
  }
  return `W${id}`;
}

function toOutfitReportItem(
  item: Record<string, unknown>,
): OutfitReportItem | null {
  const id = getOutfitReportPromptItemId(item);
  if (!id) {
    return null;
  }

  return {
    id,
    itemSource: getStringField(item, "itemSource", "item_source", "source"),
    name: getStringField(item, "name"),
    category: getStringField(item, "category"),
    brand: getStringField(item, "brand"),
    audience: getStringField(item, "audience"),
    season: getArrayField(item, "season"),
    formalityLevel: getArrayField(item, "formalityLevel", "formality_level"),
    style: getArrayField(item, "style"),
    occasions: getArrayField(item, "occasions"),
    colorBase: getArrayField(item, "colorBase", "color_base"),
    pattern: getStringField(item, "pattern"),
    finish: getStringField(item, "finish"),
    composition: getStringField(item, "composition"),
    silhouette: getStringField(item, "silhouette"),
    fit: getStringField(item, "fit"),
    closureType: getArrayField(item, "closureType", "closure_type"),
  };
}

function toOutfitReportPromptImageItem(
  item: Record<string, unknown>,
): PromptImageItemLike | null {
  const id = getOutfitReportPromptItemId(item);
  if (!id) {
    return null;
  }
  const source = getStringField(item, "source");
  const imageUrl = getStringField(
    item,
    "imageUrl",
    "image_url",
    "rawImageUrl",
    "raw_image_url",
  );

  return {
    id,
    category: getStringField(item, "category") || "other",
    imageUrl,
    source,
    thumbnailUrl: buildPromptImageThumbnailUrl(imageUrl, source),
  };
}

export {
  getOutfitReportPromptItemId,
  toOutfitReportItem,
  toOutfitReportPromptImageItem,
};
