import { useMemo } from "react";
import {
  CATEGORY_ORDER,
  sortWardrobeItems,
} from "../../../../shared/wardrobeOrder.js";
import { isLikedItem } from "../../utils/likedItemState";
import type {
  AnchorItem,
  AnchorSourceFilter,
  AnchorTypeFilter,
} from "../../components/ProfileFiltersAnchorTypes";
import type {
  OutfitItemSource,
  OutfitItemSnapshot,
  OutfitMeta,
  WardrobeItem,
} from "../../app/appTypes";

type SortableWardrobeItem = WardrobeItem & {
  category?: unknown;
  name?: unknown;
};

export function getOutfitItems(
  outfit: OutfitMeta | null,
): OutfitItemSnapshot[] {
  return (
    outfit?.effective?.items ||
    outfit?.draft?.items ||
    outfit?.saved?.items ||
    []
  );
}

export function getOutfitItemKey(entry: OutfitItemSnapshot | null) {
  const source = String(entry?.source || "").trim();
  const url = String(entry?.url || "").trim();
  return source && url ? `${source}\u0000${url}` : "";
}

export function getOutfitItem(entry: OutfitItemSnapshot | null) {
  return entry?.item || null;
}

export function getItemKey(item: WardrobeItem) {
  return String(item.url || "").trim();
}

function getUploadedItemKey(item: WardrobeItem) {
  const id = String(item.id ?? item.wardrobeId ?? "").trim();
  return id ? `wardrobe://${id}` : getItemKey(item);
}

function getSnapshotSource(
  item: WardrobeItem,
  source: "personal" | "catalog",
): OutfitItemSource {
  if (source === "catalog") return "from_catalog";
  return item.source === "uploaded" ? "uploaded" : "from_catalog";
}

export function toSnapshot(
  item: WardrobeItem,
  source: "personal" | "catalog",
): OutfitItemSnapshot | null {
  const snapshotSource = getSnapshotSource(item, source);
  const url =
    snapshotSource === "uploaded" ? getUploadedItemKey(item) : getItemKey(item);
  return url ? { url, source: snapshotSource, item } : null;
}

export function getItemImageUrl(item: WardrobeItem) {
  return String(item.imageUrl || item.rawImageUrl || "").trim();
}

export function getItemName(item: WardrobeItem) {
  return String(item.name || item.title || item.productName || "").trim();
}

export function getPreviewItemKey(item: WardrobeItem | null) {
  if (!item) return "";
  return String(item.id ?? item.wardrobeId ?? item.url ?? "");
}

export function toAnchorCardItem(
  item: WardrobeItem,
  key: string,
  source: "personal" | "catalog",
): AnchorItem {
  const wardrobeId = Number(item.id || item.wardrobeId);
  const itemUrl = String(item.url || "").trim();
  const personalSource = getOutfitPersonalItemSource(item);
  return {
    id: key,
    wardrobeId: Number.isInteger(wardrobeId) && wardrobeId > 0 ? wardrobeId : 0,
    url: itemUrl,
    name: getItemName(item) || null,
    imageUrl: getItemImageUrl(item) || null,
    category: String(item.category || "").trim() || null,
    isLiked: isLikedItem(item),
    source: source === "personal" ? personalSource : "catalog",
  };
}

export function sortOutfitWardrobeItems(items: WardrobeItem[]) {
  return sortWardrobeItems(items as SortableWardrobeItem[]);
}

export function sortOutfitItemSnapshots(items: OutfitItemSnapshot[]) {
  const foundItems = items
    .map((entry, index) => ({ entry, index, item: getOutfitItem(entry) }))
    .filter(
      (
        entry,
      ): entry is {
        entry: OutfitItemSnapshot;
        index: number;
        item: WardrobeItem;
      } => Boolean(entry.item),
    );
  const missingItems = items.filter((entry) => !getOutfitItem(entry));

  return sortWardrobeItems(
    foundItems.map(({ entry, item, index }) => ({
      category: item.category,
      entry,
      index,
      name: getItemName(item),
    })),
  )
    .map(({ entry }) => entry)
    .concat(missingItems);
}

export function useOutfitPersonalItemTypeOptions(items: WardrobeItem[]) {
  return useMemo(() => {
    const values = new Set(
      items.map((item) => String(item.category || "").trim()).filter(Boolean),
    );
    return CATEGORY_ORDER.filter((category) => values.has(category)).concat(
      [...values].filter((category) => !CATEGORY_ORDER.includes(category)),
    );
  }, [items]);
}

export function getOutfitPersonalItemSource(item: WardrobeItem) {
  const explicitSource = String(item.source || "")
    .trim()
    .toLowerCase();
  if (explicitSource === "uploaded") return "uploaded";
  if (explicitSource === "from_catalog") return "catalog";
  return "catalog";
}

export function useVisibleOutfitPersonalItems({
  items,
  likedOnly,
  sourceFilter,
  typeFilter,
}: {
  items: WardrobeItem[];
  likedOnly: boolean;
  sourceFilter: AnchorSourceFilter;
  typeFilter: AnchorTypeFilter;
}) {
  return useMemo(() => {
    const filtered = items.filter((item) => {
      const sourceMatches =
        sourceFilter === "all" ||
        getOutfitPersonalItemSource(item) === sourceFilter;
      const likedMatches = !likedOnly || isLikedItem(item);
      const typeMatches =
        typeFilter === "all" || String(item.category || "") === typeFilter;
      return sourceMatches && likedMatches && typeMatches;
    });
    return typeFilter === "all" ? sortOutfitWardrobeItems(filtered) : filtered;
  }, [items, likedOnly, sourceFilter, typeFilter]);
}

export function buildSummaryItems(
  items: OutfitItemSnapshot[],
  t: (key: string, params?: Record<string, unknown>) => string,
): string[] {
  const counts = new Map<string, number>();
  items.forEach((entry) => {
    const item = getOutfitItem(entry);
    if (!item) return;
    const category = String(item.category || "").trim();
    if (category) counts.set(category, (counts.get(category) || 0) + 1);
  });
  const parts = [...counts.entries()].map(([category, count]) =>
    t("outfit.categoryCount", {
      count,
      category: t(`options.categories.${category}`) || category,
    }),
  );
  return parts.length ? parts : [t("outfit.emptySummary")];
}

export function outfitHasUnsavedChanges(outfit: OutfitMeta | null | undefined) {
  return outfit?.status === "new" || outfit?.status === "modified";
}
