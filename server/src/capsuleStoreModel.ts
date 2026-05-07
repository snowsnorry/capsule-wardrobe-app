import { normalizeOccasionList } from "./profileStore.js";
import { t, translateOption } from "../../shared/i18n/helpers.js";

export type CapsuleFilters = {
  formalityLevel: string;
  style: string | null;
  occasions: string[];
  season: string[];
  audience: string;
  color: string | null;
  pattern: string;
  text: string;
};

export type OutfitSetPayload = {
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

export function normalizeWardrobePayload(
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
      formalityLevel: "",
      style: null,
      occasions: [],
      season: [],
      audience: "",
      color: null,
      pattern: "solid",
      text: "",
    };
  }

  return {
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
  };
}

export function normalizeCapsuleRegenerationMarker(
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

export function getCapsuleIdValue(
  capsule: { id?: unknown } | null,
): string | null {
  return typeof capsule?.id === "string" && capsule.id.trim()
    ? capsule.id
    : null;
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

export function capsuleSnapshotHasWardrobe(
  snapshot: CapsuleSnapshot | null,
): boolean {
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

export function firstStringValue(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

export function translateCapsuleFilterValue(
  group: string,
  value: unknown,
): string {
  const normalizedValue = firstStringValue(value);
  return normalizedValue ? translateOption(group, normalizedValue, "en") : "";
}

export function buildCapsuleFilterSentence(
  labelKey: string,
  value: string | string[],
): string {
  const values = Array.isArray(value) ? value : [value];
  const translatedValues = values
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (!translatedValues.length) {
    return "";
  }

  return `${t(labelKey, undefined, "en")}: ${translatedValues.join(", ")}`;
}

export function buildSharedCapsuleDescription(
  filters: CapsuleFilters | null,
): string {
  if (!filters) {
    return "";
  }

  const sentences = [
    buildCapsuleFilterSentence(
      "search.fields.formalityLevel",
      translateCapsuleFilterValue("styles", filters.formalityLevel),
    ),
    buildCapsuleFilterSentence(
      "search.fields.style",
      translateCapsuleFilterValue("styles", filters.style),
    ),
    buildCapsuleFilterSentence(
      "search.fields.occasions",
      filters.occasions.map((value) =>
        translateCapsuleFilterValue("occasions", value),
      ),
    ),
    buildCapsuleFilterSentence(
      "search.fields.season",
      filters.season.map((value) =>
        translateCapsuleFilterValue("seasons", value),
      ),
    ),
    buildCapsuleFilterSentence(
      "search.fields.audience",
      translateCapsuleFilterValue("audience", filters.audience),
    ),
    buildCapsuleFilterSentence(
      "search.fields.color",
      translateCapsuleFilterValue("accentColors", filters.color),
    ),
    buildCapsuleFilterSentence(
      "search.fields.pattern",
      translateCapsuleFilterValue("patterns", filters.pattern),
    ),
  ].filter(Boolean);

  return sentences.length ? `${sentences.join(". ")}.` : "";
}

export function getSharedCapsuleImage(
  snapshot: CapsuleSnapshot | null,
): string {
  const wardrobe = snapshot?.data?.wardrobe;
  const outfitSets = Array.isArray(wardrobe?.outfitSets)
    ? wardrobe.outfitSets
    : [];
  for (const outfitSet of outfitSets) {
    const image = firstStringValue(outfitSet?.image);
    if (image) {
      return image;
    }
  }

  const items = Array.isArray(wardrobe?.items) ? wardrobe.items : [];
  return isPlainRecord(items[0]) ? firstStringValue(items[0].image_url) : "";
}

export function buildSharedCapsuleOgMetadata({
  name,
  content,
}: {
  name: unknown;
  content: unknown;
}): SharedCapsuleOgMetadata | null {
  const snapshot = normalizeCapsuleSnapshot(
    content && typeof content === "object" && !Array.isArray(content)
      ? (content as Record<string, unknown>)
      : null,
  );
  if (!snapshot) {
    return null;
  }

  return {
    title: firstStringValue(name) || DEFAULT_CAPSULE_NAME,
    description: buildSharedCapsuleDescription(snapshot.filters),
    image: getSharedCapsuleImage(snapshot),
  };
}
