type OutfitItemSnapshot = Record<string, unknown>;
type OutfitItemRef = { url: string; source: "uploaded" | "from_catalog" };

function getSnapshotUrl(item: OutfitItemSnapshot) {
  const nestedItem = item?.item;
  return String(
    item?.url ||
      (nestedItem && typeof nestedItem === "object" && "url" in nestedItem
        ? nestedItem.url
        : "") ||
      "",
  ).trim();
}

function normalizeOutfitItemSource(source: unknown) {
  return source === "uploaded" || source === "from_catalog" ? source : null;
}

function getSnapshotSource(item: OutfitItemSnapshot) {
  const nestedItem = item?.item;
  return (
    normalizeOutfitItemSource(item?.source) ||
    (nestedItem && typeof nestedItem === "object" && "source" in nestedItem
      ? normalizeOutfitItemSource(nestedItem.source)
      : null) ||
    "from_catalog"
  );
}

function toOutfitItemRef(item: OutfitItemSnapshot): OutfitItemRef | null {
  const url = getSnapshotUrl(item);
  const source = getSnapshotSource(item);
  return url ? { url, source } : null;
}

function toOutfitItemRefs(items: OutfitItemSnapshot[] = []) {
  return items
    .map(toOutfitItemRef)
    .filter((item): item is OutfitItemRef => Boolean(item));
}

export { toOutfitItemRefs };
export type { OutfitItemSnapshot };
