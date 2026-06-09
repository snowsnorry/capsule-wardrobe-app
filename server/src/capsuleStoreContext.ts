import type {
  BuildProfileCapsuleContextOptions,
  CapsuleContextProfile,
  CapsuleFilters,
  CapsuleRecord,
  CapsuleSnapshot,
  WardrobePayload,
} from "./capsuleStoreModel.js";
import {
  normalizeCapsulePattern,
  normalizeCapsuleSnapshot,
  getEffectiveCapsuleSnapshot,
} from "./capsuleStoreModel.js";

export function buildSnapshotFromProfile(
  _profile: CapsuleContextProfile | null = null,
): CapsuleSnapshot | null {
  return normalizeCapsuleSnapshot({
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
      anchorItemRefs: [],
    },
    data: {
      wardrobe: null,
      rejectedUrls: [],
      regeneration: null,
    },
  });
}

export function buildProfileCapsuleContext(
  profile: CapsuleContextProfile | null = null,
  capsule: CapsuleRecord | null = null,
  options: BuildProfileCapsuleContextOptions = {},
): Record<string, unknown> {
  const snapshot = getEffectiveCapsuleSnapshot(capsule);
  const filters = getProfileContextFilters(snapshot, profile);
  return {
    ...profile,
    ...buildProfileFilterContext(filters),
    pattern: normalizeCapsulePattern(filters?.pattern),
    locale: getProfileContextLocale(profile),
    items: getProfileContextWardrobe(snapshot, options),
    rejected: getProfileContextRejectedUrls(snapshot),
  };
}

const emptyProfileFilterContext = {
  sourceMode: "catalog_only",
  formalityLevel: "",
  style: null,
  occasions: [],
  season: [],
  audience: "",
  color: null,
  text: "",
  anchorItemRefs: [],
} as const;

function getProfileContextFilters(
  snapshot: CapsuleSnapshot | null,
  profile: CapsuleContextProfile | null,
): CapsuleFilters | null {
  return (
    snapshot?.filters ?? buildSnapshotFromProfile(profile)?.filters ?? null
  );
}

function getProfileContextLocale(
  profile: CapsuleContextProfile | null,
): string {
  return typeof profile?.locale === "string" && profile.locale
    ? profile.locale
    : "en";
}

function getProfileContextWardrobe(
  snapshot: CapsuleSnapshot | null,
  options: BuildProfileCapsuleContextOptions,
): WardrobePayload | null {
  return options.forceEmptyWardrobe ? null : (snapshot?.data?.wardrobe ?? null);
}

function getProfileContextRejectedUrls(
  snapshot: CapsuleSnapshot | null,
): string[] {
  return snapshot?.data?.rejectedUrls ?? [];
}

function buildProfileFilterContext(
  filters: CapsuleFilters | null,
): Record<string, unknown> {
  if (!filters) {
    return { ...emptyProfileFilterContext };
  }

  return {
    sourceMode: filters.sourceMode,
    formalityLevel: filters.formalityLevel,
    style: filters.style,
    occasions: filters.occasions,
    season: filters.season,
    audience: filters.audience,
    color: filters.color,
    text: filters.text,
    anchorItemRefs: filters.anchorItemRefs,
  };
}
