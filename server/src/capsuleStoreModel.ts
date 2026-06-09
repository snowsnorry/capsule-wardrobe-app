import { normalizeOccasionList } from "./profileStore.js";

export type CapsuleFilters = {
  sourceMode: CapsuleSourceMode;
  formalityLevel: string;
  style: string | null;
  occasions: string[];
  season: string[];
  audience: string;
  color: string | null;
  pattern: string;
  text: string;
  anchorItemRefs: AnchorItemRef[];
};

type AnchorItemRef = {
  source: "uploaded" | "from_catalog";
  url: string;
};

type CapsuleSourceMode =
  | "catalog_only"
  | "wardrobe_preferred"
  | "wardrobe_only";

type OutfitSetPayload = {
  itemIds: string[];
  image: string | null;
  imageObsolete: boolean;
};

export type WardrobePayload = {
  items: unknown[];
  outfitSets: OutfitSetPayload[];
  rawSelectionText: string | null;
  swimwearReasoning: string | null;
  swimwearRawSelectionText: string | null;
};

export type CapsuleRegenerationMarker = {
  status: "pending";
  kind: "full";
  startedAt: string;
  requestId: string;
};

export type CapsuleSnapshot = {
  filters: CapsuleFilters;
  data: {
    wardrobe: WardrobePayload | null;
    rejectedUrls: string[];
    regeneration: CapsuleRegenerationMarker | null;
  };
};

export type CapsuleRecord = {
  id?: string | null;
  draft?: Record<string, unknown> | null;
  saved?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type NormalizedCapsuleRecord = Omit<CapsuleRecord, "draft" | "saved"> & {
  id?: string | null;
  draft: CapsuleSnapshot | null;
  saved: CapsuleSnapshot | null;
  status: "new" | "saved" | "modified";
};

export type SharedCapsuleResult = {
  id: string;
  url: string;
  expiresAt: string | Date;
};

export type SharedCapsuleMetadata = {
  id: string;
  name: string;
  expiresAt: string | Date;
};

export type SharedCapsuleOgMetadata = {
  title: string;
  description: string;
  image: string;
};

export type CapsuleContextProfile = {
  locale?: string;
  [key: string]: unknown;
};

export type BuildProfileCapsuleContextOptions = {
  forceEmptyWardrobe?: boolean;
};

export const DEFAULT_CAPSULE_NAME = "<New capsule>";
export const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeCapsulePattern(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : "solid";
}

function normalizeCapsuleSourceMode(value: unknown): CapsuleSourceMode {
  if (value === "wardrobe_preferred" || value === "wardrobe_only") {
    return value;
  }

  return "catalog_only";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function trimmedString(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

function nullableTrimmedString(value: unknown): string | null {
  const normalized = trimmedString(value);
  return normalized || null;
}

function uniqueTrimmedStrings(values: unknown): string[] {
  return Array.isArray(values)
    ? [
        ...new Set(
          values.map((value) => String(value || "").trim()).filter(Boolean),
        ),
      ]
    : [];
}

function normalizeAnchorItemRefs(values: unknown): AnchorItemRef[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const refs: AnchorItemRef[] = [];
  for (const value of values) {
    if (!isPlainRecord(value)) {
      continue;
    }
    const source =
      value.source === "uploaded" || value.source === "from_catalog"
        ? value.source
        : null;
    const url = trimmedString(value.url);
    const key = source && url ? `${source}\u0000${url}` : "";
    if (!source || !url || seen.has(key)) {
      continue;
    }
    seen.add(key);
    refs.push({ source, url });
  }
  return refs;
}

function normalizeOutfitSetPayload(value: unknown): OutfitSetPayload | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const itemIds = uniqueTrimmedStrings(value.itemIds);
  return itemIds.length > 0
    ? {
        itemIds,
        image: nullableTrimmedString(value.image),
        imageObsolete: Boolean(value.imageObsolete),
      }
    : null;
}

function normalizeOutfitSetPayloads(value: unknown): OutfitSetPayload[] {
  return Array.isArray(value)
    ? value
        .map(normalizeOutfitSetPayload)
        .filter((set): set is OutfitSetPayload => Boolean(set))
    : [];
}

function getRawSelectionText(payload: Record<string, unknown>): string | null {
  return (
    nullableTrimmedString(payload.rawSelectionText) ||
    nullableTrimmedString(payload.reasoning)
  );
}

function normalizeWardrobePayload(
  payload: Record<string, unknown> | null = null,
): WardrobePayload | null {
  if (!isPlainRecord(payload)) {
    return null;
  }

  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    outfitSets: normalizeOutfitSetPayloads(payload.outfitSets),
    rawSelectionText: getRawSelectionText(payload),
    swimwearReasoning: nullableTrimmedString(payload.swimwearReasoning),
    swimwearRawSelectionText: nullableTrimmedString(
      payload.swimwearRawSelectionText,
    ),
  };
}

export function normalizeCapsuleFilters(
  filters: Record<string, unknown> | null = null,
): CapsuleFilters {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return {
      sourceMode: "catalog_only",
      formalityLevel: "",
      style: null,
      occasions: [],
      season: [],
      audience: "",
      color: null,
      pattern: "solid",
      text: "",
      anchorItemRefs: [],
    };
  }

  return {
    sourceMode: normalizeCapsuleSourceMode(filters.sourceMode),
    formalityLevel:
      typeof filters.formalityLevel === "string" ? filters.formalityLevel : "",
    style: typeof filters.style === "string" ? filters.style : null,
    occasions: normalizeOccasionList(filters.occasions),
    season: Array.isArray(filters.season) ? filters.season.filter(Boolean) : [],
    audience: typeof filters.audience === "string" ? filters.audience : "",
    color: typeof filters.color === "string" ? filters.color : null,
    pattern: normalizeCapsulePattern(filters.pattern),
    text:
      typeof filters.text === "string" && filters.text.trim()
        ? filters.text.trim()
        : "",
    anchorItemRefs: normalizeAnchorItemRefs(filters.anchorItemRefs),
  };
}

function normalizeCapsuleRegenerationMarker(
  value: unknown,
): CapsuleRegenerationMarker | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const status = trimmedString(value.status);
  const kind = trimmedString(value.kind);
  const startedAt = trimmedString(value.startedAt);
  const requestId = trimmedString(value.requestId);

  if (status !== "pending" || kind !== "full" || !startedAt || !requestId) {
    return null;
  }

  return {
    status: "pending",
    kind: "full",
    startedAt,
    requestId,
  };
}

export function normalizeCapsuleSnapshot(
  snapshot: Record<string, unknown> | null = null,
): CapsuleSnapshot | null {
  if (!isPlainRecord(snapshot)) {
    return null;
  }

  const snapshotFilters = isPlainRecord(snapshot.filters)
    ? snapshot.filters
    : null;
  const snapshotData = isPlainRecord(snapshot.data) ? snapshot.data : null;

  return {
    filters: normalizeCapsuleFilters(snapshotFilters),
    data: {
      wardrobe: normalizeWardrobePayload(
        isPlainRecord(snapshotData?.wardrobe) ? snapshotData.wardrobe : null,
      ),
      rejectedUrls: uniqueTrimmedStrings(snapshotData?.rejectedUrls),
      regeneration: normalizeCapsuleRegenerationMarker(
        snapshotData?.regeneration,
      ),
    },
  };
}

export function buildCapsuleSnapshotWithRegeneration(
  snapshot: CapsuleSnapshot | null,
  regeneration: CapsuleRegenerationMarker | null,
): CapsuleSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return normalizeCapsuleSnapshot({
    filters: snapshot.filters,
    data: {
      wardrobe: snapshot.data?.wardrobe || null,
      rejectedUrls: snapshot.data?.rejectedUrls || [],
      regeneration,
    },
  });
}

export function normalizeCapsuleRecord(
  capsule: CapsuleRecord | null,
): NormalizedCapsuleRecord | null {
  if (!capsule) {
    return null;
  }

  const draft = normalizeCapsuleSnapshot(capsule.draft);
  const saved = normalizeCapsuleSnapshot(capsule.saved);
  const hasSaved = Boolean(saved);
  const hasDraft = Boolean(draft);
  let status: NormalizedCapsuleRecord["status"] = "new";

  if (hasSaved && !hasDraft) {
    status = "saved";
  } else if (hasSaved && hasDraft) {
    status =
      JSON.stringify(saved) === JSON.stringify(draft) ? "saved" : "modified";
  }

  return {
    ...capsule,
    draft,
    saved,
    status,
  };
}

export function getEffectiveCapsuleSnapshot(
  capsule: CapsuleRecord | null,
): CapsuleSnapshot | null {
  const normalized = normalizeCapsuleRecord(capsule);
  return normalized?.draft || normalized?.saved || null;
}

function capsuleSnapshotHasWardrobe(snapshot: CapsuleSnapshot | null): boolean {
  const items = snapshot?.data?.wardrobe?.items;
  return Array.isArray(items) && items.length > 0;
}

export function isShareableCapsuleSnapshot(
  snapshot: CapsuleSnapshot | null,
): boolean {
  return Boolean(
    snapshot &&
    capsuleSnapshotHasWardrobe(snapshot) &&
    !getCapsuleSnapshotRegeneration(snapshot),
  );
}

export function getCapsuleSnapshotRegeneration(
  snapshot: CapsuleSnapshot | null,
): CapsuleRegenerationMarker | null {
  return normalizeCapsuleRegenerationMarker(snapshot?.data?.regeneration);
}
