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

export function getItemKey(item: WardrobeItem, source: "personal" | "catalog") {
  if (source === "personal") {
    const id = String(item.id || item.wardrobeId || "").trim();
    if (id) return `wardrobe://${id}`;
  }
  return String(item.url || item.id || "").trim();
}

export function toSnapshot(
  item: WardrobeItem,
  source: "personal" | "catalog",
): OutfitItemSnapshot | null {
  const key = getItemKey(item, source);
  return key ? { key, source, item } : null;
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
  return sortWardrobeItems(
    items.map((entry) => ({
      category: entry.item?.category,
      entry,
      name: getItemName(entry.item),
    })),
  ).map(({ entry }) => entry);
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

export function buildSummary(
  items: OutfitItemSnapshot[],
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  const counts = new Map<string, number>();
  items.forEach(({ item }) => {
    const category = String(item.category || "").trim();
    if (category) counts.set(category, (counts.get(category) || 0) + 1);
  });
  const parts = [...counts.entries()].map(([category, count]) =>
    t("outfit.categoryCount", {
      count,
      category: t(`options.categories.${category}`) || category,
    }),
  );
  return parts.length ? parts.join(" · ") : t("outfit.emptySummary");
}

export function outfitHasUnsavedChanges(outfit: OutfitMeta | null | undefined) {
  return outfit?.status === "new" || outfit?.status === "modified";
}
