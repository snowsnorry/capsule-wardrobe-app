type OutfitItemSource = "personal" | "catalog";

type OutfitItemSnapshot = {
  key: string;
  source: OutfitItemSource;
  item: Record<string, unknown>;
};

export type OutfitSnapshot = {
  items: OutfitItemSnapshot[];
};

export type OutfitRecord = {
  id?: string | null;
  draft?: Record<string, unknown> | null;
  saved?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type NormalizedOutfitRecord = Omit<OutfitRecord, "draft" | "saved"> & {
  id?: string | null;
  draft: OutfitSnapshot | null;
  saved: OutfitSnapshot | null;
  status: "new" | "saved" | "modified";
};

export const DEFAULT_OUTFIT_NAME = "<New outfit>";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeItemSource(value: unknown): OutfitItemSource {
  return value === "personal" ? "personal" : "catalog";
}

function normalizeItemKey(value: unknown, item: Record<string, unknown>) {
  const explicitKey = String(value || "").trim();
  if (explicitKey) {
    return explicitKey;
  }

  const itemUrl = String(item.url || "").trim();
  if (itemUrl) {
    return itemUrl;
  }

  const itemId = String(item.id || item.wardrobeId || "").trim();
  return itemId ? `wardrobe://${itemId}` : "";
}

function normalizeOutfitItemSnapshot(
  value: unknown,
): OutfitItemSnapshot | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const item = isPlainRecord(value.item) ? value.item : null;
  if (!item) {
    return null;
  }

  const key = normalizeItemKey(value.key, item);
  if (!key) {
    return null;
  }

  return {
    key,
    source: normalizeItemSource(value.source),
    item,
  };
}

export function normalizeOutfitSnapshot(
  snapshot: Record<string, unknown> | null = null,
): OutfitSnapshot | null {
  if (!isPlainRecord(snapshot)) {
    return null;
  }

  return {
    items: Array.isArray(snapshot.items)
      ? snapshot.items
          .map(normalizeOutfitItemSnapshot)
          .filter((item): item is OutfitItemSnapshot => Boolean(item))
      : [],
  };
}

export function normalizeOutfitRecord(
  outfit: OutfitRecord | null,
): NormalizedOutfitRecord | null {
  if (!outfit) {
    return null;
  }

  const draft = normalizeOutfitSnapshot(outfit.draft);
  const saved = normalizeOutfitSnapshot(outfit.saved);
  const hasSaved = Boolean(saved);
  const hasDraft = Boolean(draft);
  let status: NormalizedOutfitRecord["status"] = "new";

  if (hasSaved && !hasDraft) {
    status = "saved";
  } else if (hasSaved && hasDraft) {
    status =
      JSON.stringify(saved) === JSON.stringify(draft) ? "saved" : "modified";
  }

  return {
    ...outfit,
    draft,
    saved,
    status,
  };
}

export function getEffectiveOutfitSnapshot(
  outfit: OutfitRecord | null,
): OutfitSnapshot | null {
  const normalized = normalizeOutfitRecord(outfit);
  return normalized?.draft || normalized?.saved || null;
}
