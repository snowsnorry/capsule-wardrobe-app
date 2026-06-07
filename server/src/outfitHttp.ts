import { getEffectiveOutfitSnapshot } from "./outfitStore.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";

export function hasUnexpectedOutfitCreateFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const allowedKeys = new Set(["name", "items"]);
  return Object.keys(payload).some((key) => !allowedKeys.has(key));
}

export function hasUnexpectedOutfitItemsFields(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return Object.keys(payload).some((key) => key !== "items");
}

export function toOutfitSummary(outfit) {
  const effective = getEffectiveOutfitSnapshot(outfit);
  return {
    id: outfit.id,
    name: outfit.name,
    status: outfit.status,
    createdAt: outfit.createdAt,
    updatedAt: outfit.updatedAt,
    hasDraft: Boolean(outfit.draft),
    hasSaved: Boolean(outfit.saved),
    itemCount: effective?.items?.length || 0,
  };
}

export function toOutfitResponse(outfit) {
  return {
    ...toOutfitSummary(outfit),
    draft: outfit.draft,
    saved: outfit.saved,
    effective: getEffectiveOutfitSnapshot(outfit),
  };
}

export function getOutfitItems(outfit) {
  const effective = getEffectiveOutfitSnapshot(outfit);
  const items = Array.isArray(effective?.items)
    ? effective.items.map((entry) => entry?.item).filter(Boolean)
    : [];
  return sortWardrobeItems(items);
}
