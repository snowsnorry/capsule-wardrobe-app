import { getEffectiveCapsuleSnapshot } from "../capsuleStore.js";
import {
  getOutfitReportPromptItemId,
  toOutfitReportItem,
} from "./outfitReportItems.js";
import { buildCapsuleReportError } from "./capsuleReportErrors.js";
import type { CapsuleSnapshot } from "../capsuleStoreModel.js";
import type {
  CapsuleReportGeneratedOutfit,
  CapsuleReportItem,
} from "./capsuleReportTypes.js";

function normalizeCapsuleReportId(capsuleId: string) {
  const normalizedCapsuleId = String(capsuleId || "").trim();
  if (!normalizedCapsuleId) {
    throw buildCapsuleReportError("invalid_payload");
  }
  return normalizedCapsuleId;
}

function getRequiredEffectiveSnapshot(capsule: unknown) {
  const effectiveSnapshot = getEffectiveCapsuleSnapshot(
    capsule as Record<string, unknown>,
  );
  if (!effectiveSnapshot) {
    throw buildCapsuleReportError("invalid_payload", "empty_capsule");
  }
  return effectiveSnapshot;
}

function getRequiredCapsuleItems(snapshot: CapsuleSnapshot) {
  const items = snapshot.data?.wardrobe?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw buildCapsuleReportError("invalid_payload", "empty_capsule");
  }
  return items as Record<string, unknown>[];
}

function getRequiredReportItems(items: Record<string, unknown>[]) {
  const reportItems = items
    .map((item) => toOutfitReportItem(item))
    .filter((item): item is CapsuleReportItem => Boolean(item));
  if (reportItems.length !== items.length) {
    throw buildCapsuleReportError("invalid_payload", "missing_item_id");
  }
  return reportItems;
}

function getRawItemId(item: Record<string, unknown>) {
  const id = item.id;
  return typeof id === "string" || typeof id === "number"
    ? String(id).trim()
    : "";
}

function buildPromptItemIdMap(items: Record<string, unknown>[]) {
  const itemIdMap = new Map<string, string>();
  for (const item of items) {
    const rawId = getRawItemId(item);
    const promptId = getOutfitReportPromptItemId(item);
    if (rawId && promptId) {
      itemIdMap.set(rawId, promptId);
      itemIdMap.set(promptId, promptId);
    }
  }
  return itemIdMap;
}

function mapGeneratedOutfitItemIds(
  itemIds: unknown,
  itemIdMap: Map<string, string>,
) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw buildCapsuleReportError(
      "invalid_payload",
      "unresolved_generated_outfit_items",
    );
  }

  return itemIds.map((itemId) => {
    const mappedId = itemIdMap.get(String(itemId || "").trim());
    if (!mappedId) {
      throw buildCapsuleReportError(
        "invalid_payload",
        "unresolved_generated_outfit_items",
      );
    }
    return mappedId;
  });
}

function buildGeneratedOutfits({
  itemIdMap,
  snapshot,
}: {
  itemIdMap: Map<string, string>;
  snapshot: CapsuleSnapshot;
}): CapsuleReportGeneratedOutfit[] {
  const outfitSets = snapshot.data?.wardrobe?.outfitSets;
  return Array.isArray(outfitSets)
    ? outfitSets.map((outfitSet, index) => ({
        id: `outfit-set-${index + 1}`,
        itemIds: mapGeneratedOutfitItemIds(outfitSet?.itemIds, itemIdMap),
      }))
    : [];
}

export {
  buildGeneratedOutfits,
  buildPromptItemIdMap,
  getRequiredCapsuleItems,
  getRequiredEffectiveSnapshot,
  getRequiredReportItems,
  normalizeCapsuleReportId,
};
