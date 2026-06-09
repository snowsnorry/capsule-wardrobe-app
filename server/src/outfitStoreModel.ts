type OutfitItemSource = "uploaded" | "from_catalog";

type OutfitItemSnapshot = {
  source: OutfitItemSource;
  url: string;
};

export type OutfitSnapshot = {
  items: OutfitItemSnapshot[];
  image: string | null;
  imageObsolete: boolean;
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

function normalizeItemSource(value: unknown): OutfitItemSource | null {
  return value === "uploaded" || value === "from_catalog" ? value : null;
}

function normalizeOutfitItemSnapshot(
  value: unknown,
): OutfitItemSnapshot | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const source = normalizeItemSource(value.source);
  const url = String(value.url || "").trim();
  if (!source || !url) {
    return null;
  }

  return {
    url,
    source,
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
    image:
      typeof snapshot.image === "string" && snapshot.image.trim().length > 0
        ? snapshot.image.trim()
        : null,
    imageObsolete: Boolean(snapshot.imageObsolete),
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
