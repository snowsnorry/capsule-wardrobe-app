import { translateOption } from "../i18n";
import type { AnchorItem, Translate } from "./ProfileFiltersAnchorTypes";

function getWardrobeItemSource(url: string): AnchorItem["source"] {
  return url.startsWith("wardrobe://") ? "uploaded" : "catalog";
}

function getStringValue(item: Record<string, unknown>, key: string): string {
  return typeof item[key] === "string" ? item[key].trim() : "";
}

export function toAnchorItem(item: unknown): AnchorItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const source = item as Record<string, unknown>;
  const wardrobeId = Number(source.id);
  if (!Number.isInteger(wardrobeId) || wardrobeId <= 0) {
    return null;
  }

  const url = getStringValue(source, "url");
  return {
    id: `W${wardrobeId}`,
    wardrobeId,
    url,
    name: getStringValue(source, "name") || null,
    imageUrl:
      getStringValue(source, "imageUrl") ||
      getStringValue(source, "rawImageUrl") ||
      null,
    category: getStringValue(source, "category") || null,
    source: getWardrobeItemSource(url),
  };
}

export function normalizeSelectedIds(ids: string[] = []): string[] {
  return [
    ...new Set(
      ids
        .map((id) =>
          String(id || "")
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ];
}

export function getAnchorLabel(
  item: AnchorItem | null,
  id: string,
  t: Translate,
) {
  return item?.name || t("capsule.anchors.unnamed", { id });
}

export function getAnchorCategoryLabel(
  category: string | null,
  locale: string,
): string {
  return category ? translateOption("categories", category, locale) : "";
}
