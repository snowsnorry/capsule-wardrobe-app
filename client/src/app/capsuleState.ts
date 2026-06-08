import type {
  AnchorItemRef,
  CapsuleDraft,
  CapsuleFilters,
  CapsuleMeta,
  CapsuleSourceMode,
  CapsuleWardrobeData,
  OutfitSetSnapshot,
  WardrobeItem,
} from "./appTypes";
import { SEASON_DISPLAY_ORDER } from "./appConstants";

function normalizeAnchorItemSource(
  value: unknown,
): AnchorItemRef["source"] | null {
  return value === "uploaded" || value === "from_catalog" ? value : null;
}

export function normalizeAnchorItemRefs(values: unknown): AnchorItemRef[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const refs: AnchorItemRef[] = [];
  values.forEach((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    const source = normalizeAnchorItemSource(
      (value as Record<string, unknown>).source,
    );
    const url = String((value as Record<string, unknown>).url || "").trim();
    const key = source && url ? `${source}\u0000${url}` : "";
    if (!source || !url || seen.has(key)) {
      return;
    }
    seen.add(key);
    refs.push({ source, url });
  });
  return refs;
}

export function getWardrobeMetadata(
  wardrobe: CapsuleWardrobeData | null | undefined,
) {
  return {
    rawSelectionText: wardrobe?.rawSelectionText || null,
    swimwearReasoning: wardrobe?.swimwearReasoning || null,
    swimwearRawSelectionText: wardrobe?.swimwearRawSelectionText || null,
  };
}

export function sortSeasonOptions(items: string[]) {
  return [...items].sort((left, right) => {
    const leftIndex = SEASON_DISPLAY_ORDER.indexOf(left);
    const rightIndex = SEASON_DISPLAY_ORDER.indexOf(right);
    const normalizedLeft =
      leftIndex === -1 ? SEASON_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight =
      rightIndex === -1 ? SEASON_DISPLAY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

export function normalizeOutfitSets(outfitSets: unknown): OutfitSetSnapshot[] {
  return Array.isArray(outfitSets)
    ? outfitSets
        .map((set) => ({
          itemIds: Array.isArray(set?.itemIds)
            ? set.itemIds.map((id) => String(id || "").trim()).filter(Boolean)
            : [],
          image:
            typeof set?.image === "string" && set.image.trim().length > 0
              ? set.image.trim()
              : null,
          imageObsolete: Boolean(set?.imageObsolete),
        }))
        .filter((set) => set.itemIds.length > 0)
    : [];
}

export function buildCapsuleStatus(capsule: CapsuleMeta | null | undefined) {
  if (!capsule) {
    return "new";
  }
  if (capsule.saved && !capsule.draft) {
    return "saved";
  }
  if (capsule.saved && capsule.draft) {
    return JSON.stringify(capsule.saved) === JSON.stringify(capsule.draft)
      ? "saved"
      : "modified";
  }
  return "new";
}

export function buildEmptyCapsuleDraft(): CapsuleDraft {
  return {
    filters: {
      sourceMode: "catalog_only",
      formalityLevel: "",
      style: null,
      occasions: [],
      season: [],
      audience: "",
      color: null,
      pattern: "solid",
      text: "",
      anchorWardrobeItemIds: [],
      anchorItemRefs: [],
    },
    data: {
      wardrobe: null,
      rejectedUrls: [],
    },
  };
}

export function getEffectiveCapsule(
  capsule: CapsuleMeta | null | undefined,
): CapsuleDraft | null {
  return capsule?.draft || capsule?.saved || null;
}

export function buildDraftSnapshotFromState({
  activeCapsuleMeta,
  profileItems,
  profileOutfitSets,
  rejectedUrls = null,
  selectedAudience,
  selectedColor,
  selectedFormalityLevel,
  selectedOccasions,
  selectedPattern,
  selectedSeason,
  selectedSourceMode,
  selectedStyle,
  selectedText,
  selectedAnchorItemRefs = [],
  selectedAnchorWardrobeItemIds = [],
  wardrobe,
}: {
  activeCapsuleMeta: CapsuleMeta | null;
  profileItems: WardrobeItem[] | null;
  profileOutfitSets: OutfitSetSnapshot[];
  rejectedUrls?: string[] | null;
  selectedAudience: string;
  selectedColor: string | null;
  selectedFormalityLevel: string;
  selectedOccasions: string[];
  selectedPattern: string;
  selectedSeason: string[];
  selectedSourceMode: CapsuleSourceMode;
  selectedStyle: string | null;
  selectedText: string;
  selectedAnchorItemRefs?: AnchorItemRef[];
  selectedAnchorWardrobeItemIds?: string[];
  wardrobe?:
    | CapsuleWardrobeData
    | { items: WardrobeItem[] | null; outfitSets: OutfitSetSnapshot[] }
    | null;
}): CapsuleDraft {
  const selectedWardrobe =
    wardrobe === undefined
      ? { items: profileItems, outfitSets: profileOutfitSets }
      : wardrobe;
  return {
    filters: {
      sourceMode: selectedSourceMode,
      formalityLevel: selectedFormalityLevel,
      style: selectedStyle,
      occasions: selectedOccasions,
      season: selectedSeason,
      audience: selectedAudience,
      color: selectedColor,
      pattern: selectedPattern,
      text: selectedText,
      anchorWardrobeItemIds: selectedAnchorWardrobeItemIds,
      anchorItemRefs: normalizeAnchorItemRefs(selectedAnchorItemRefs),
    },
    data: {
      wardrobe: selectedWardrobe
        ? {
            items: Array.isArray(selectedWardrobe.items)
              ? selectedWardrobe.items
              : [],
            outfitSets: normalizeOutfitSets(selectedWardrobe.outfitSets),
            ...getWardrobeMetadata(selectedWardrobe as CapsuleWardrobeData),
          }
        : null,
      rejectedUrls: Array.isArray(rejectedUrls)
        ? rejectedUrls
        : getEffectiveCapsule(activeCapsuleMeta)?.data?.rejectedUrls || [],
    },
  };
}

// eslint-disable-next-line complexity
function normalizeComparableFilters(filters: Partial<CapsuleFilters> = {}) {
  return {
    sourceMode:
      filters.sourceMode === "wardrobe_preferred" ||
      filters.sourceMode === "wardrobe_only"
        ? filters.sourceMode
        : "catalog_only",
    formalityLevel:
      typeof filters.formalityLevel === "string" ? filters.formalityLevel : "",
    style: filters.style ?? null,
    occasions: Array.isArray(filters.occasions)
      ? [...filters.occasions].sort()
      : [],
    season: Array.isArray(filters.season) ? [...filters.season].sort() : [],
    audience: typeof filters.audience === "string" ? filters.audience : "",
    color: filters.color ?? null,
    pattern:
      typeof filters.pattern === "string" && filters.pattern.trim().length > 0
        ? filters.pattern
        : "solid",
    text: typeof filters.text === "string" ? filters.text.trim() : "",
    anchorWardrobeItemIds: Array.isArray(filters.anchorWardrobeItemIds)
      ? [...filters.anchorWardrobeItemIds].sort()
      : [],
    anchorItemRefs: normalizeAnchorItemRefs(filters.anchorItemRefs).sort(
      (left, right) =>
        `${left.source}\u0000${left.url}`.localeCompare(
          `${right.source}\u0000${right.url}`,
        ),
    ),
  };
}

export function areFiltersEqual(
  left: Partial<CapsuleFilters>,
  right: Partial<CapsuleFilters>,
) {
  return (
    JSON.stringify(normalizeComparableFilters(left)) ===
    JSON.stringify(normalizeComparableFilters(right))
  );
}
