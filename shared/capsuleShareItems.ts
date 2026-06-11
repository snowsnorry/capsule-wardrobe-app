type ShareItem = Record<string, unknown>;

type ShareSnapshot = {
  data?: {
    wardrobe?: {
      items?: unknown[];
      outfitSets?: unknown[];
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const MINIMAL_CAPSULE_ITEM_KEYS = [
  "id",
  "url",
  "name",
  "audience",
  "category",
  "imageUrl",
] as const;

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getItemString(item: ShareItem, ...keys: string[]): string {
  for (const key of keys) {
    const value = getTrimmedString(item[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function getCapsuleSnapshotItems(snapshot: unknown): ShareItem[] {
  const value = snapshot as ShareSnapshot | null | undefined;
  const items = value?.data?.wardrobe?.items;
  return Array.isArray(items) ? (items as ShareItem[]) : [];
}

function isUploadedPersonalWardrobeItem(item: unknown): boolean {
  const value = item as ShareItem | null | undefined;
  return Boolean(
    value && getTrimmedString(value.source).toLowerCase() === "uploaded",
  );
}

function isCatalogWardrobeItem(item: unknown): boolean {
  const value = item as ShareItem | null | undefined;
  if (!value || isUploadedPersonalWardrobeItem(value)) {
    return false;
  }

  return getTrimmedString(value.source).toLowerCase() === "from_catalog";
}

function hasUploadedPersonalWardrobeItems(snapshot: unknown): boolean {
  return getCapsuleSnapshotItems(snapshot).some(isUploadedPersonalWardrobeItem);
}

function normalizeCapsuleItemForShare(item: unknown): ShareItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const source = item as ShareItem;
  const normalized = {
    id: getItemString(source, "id"),
    url: getItemString(source, "url"),
    name: getItemString(source, "name"),
    audience: getItemString(source, "audience"),
    category: getItemString(source, "category"),
    imageUrl: getItemString(source, "imageUrl"),
  };

  return MINIMAL_CAPSULE_ITEM_KEYS.every((key) => normalized[key])
    ? normalized
    : null;
}

function getItemIdAliases(item: ShareItem): string[] {
  return [getItemString(item, "id")].filter(Boolean);
}

function buildOutfitSetWithMappedItemIds(
  outfitSet: unknown,
  itemIdMap: Map<string, string>,
): unknown {
  if (!outfitSet || typeof outfitSet !== "object" || Array.isArray(outfitSet)) {
    return outfitSet;
  }

  const source = outfitSet as { itemIds?: unknown[]; [key: string]: unknown };
  if (!Array.isArray(source.itemIds)) {
    return source;
  }

  return {
    ...source,
    itemIds: source.itemIds
      .map((id) => {
        const normalizedId = getTrimmedString(id);
        return itemIdMap.get(normalizedId) || normalizedId;
      })
      .filter(Boolean),
  };
}

function normalizeCapsuleSnapshotItemsForShare<T extends ShareSnapshot>(
  snapshot: T | null,
): T | null {
  if (!snapshot) {
    return null;
  }

  const wardrobe = snapshot.data?.wardrobe;
  const items = Array.isArray(wardrobe?.items) ? wardrobe.items : [];
  const itemIdMap = new Map<string, string>();
  const normalizedItems = [];

  for (const item of items) {
    const normalizedItem = normalizeCapsuleItemForShare(item);
    if (!normalizedItem) {
      return null;
    }

    for (const alias of getItemIdAliases(item as ShareItem)) {
      itemIdMap.set(alias, String(normalizedItem.id));
    }
    normalizedItems.push(normalizedItem);
  }

  return {
    ...snapshot,
    data: {
      ...snapshot.data,
      wardrobe: {
        ...wardrobe,
        items: normalizedItems,
        outfitSets: Array.isArray(wardrobe?.outfitSets)
          ? wardrobe.outfitSets.map((set) =>
              buildOutfitSetWithMappedItemIds(set, itemIdMap),
            )
          : wardrobe?.outfitSets,
      },
    },
  };
}

export {
  hasUploadedPersonalWardrobeItems,
  isCatalogWardrobeItem,
  isUploadedPersonalWardrobeItem,
  normalizeCapsuleSnapshotItemsForShare,
  normalizeCapsuleItemForShare,
};
