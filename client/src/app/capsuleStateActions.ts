import {
  buildCapsuleStatus,
  buildEmptyCapsuleDraft,
  getEffectiveCapsule,
  normalizeOutfitSets,
} from "./capsuleState";
import { buildDisplayWardrobeItems } from "../../../shared/wardrobeMerge.js";
import type { CapsuleMeta, WardrobeItem } from "./appTypes";

type StateSetter<T> = (value: T) => void;

type ApplyCapsuleStateContext = {
  clearWardrobeProgressState: () => void;
  setActiveCapsuleId: StateSetter<string>;
  setActiveCapsuleMeta: StateSetter<CapsuleMeta | null>;
  setCapsuleList: StateSetter<CapsuleMeta[]>;
  setPendingImageSetIndexes: StateSetter<number[]>;
  setProfileItems: StateSetter<WardrobeItem[] | null>;
  setProfileOutfitSets: StateSetter<ReturnType<typeof normalizeOutfitSets>>;
  setSelectedAudience: StateSetter<string>;
  setSelectedColor: StateSetter<string | null>;
  setSelectedFormalityLevel: StateSetter<string>;
  setSelectedOccasions: StateSetter<string[]>;
  setSelectedPattern: StateSetter<string>;
  setSelectedSeason: StateSetter<string[]>;
  setSelectedStyle: StateSetter<string | null>;
  setSelectedText: StateSetter<string>;
};

function normalizePattern(pattern: unknown) {
  return typeof pattern === "string" && pattern.trim().length > 0
    ? pattern
    : "solid";
}

function fallbackString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function fallbackStringArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function fallbackNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function applyCapsuleFilters(
  context: ApplyCapsuleStateContext,
  capsule: CapsuleMeta,
) {
  const effective = getEffectiveCapsule(capsule) || buildEmptyCapsuleDraft();
  const filters: Partial<ReturnType<typeof buildEmptyCapsuleDraft>["filters"]> =
    effective.filters || {};
  context.setSelectedFormalityLevel(fallbackString(filters.formalityLevel));
  context.setSelectedStyle(fallbackNullableString(filters.style));
  context.setSelectedOccasions(fallbackStringArray(filters.occasions));
  context.setSelectedSeason(fallbackStringArray(filters.season));
  context.setSelectedAudience(fallbackString(filters.audience));
  context.setSelectedColor(fallbackNullableString(filters.color));
  context.setSelectedPattern(normalizePattern(filters.pattern));
  context.setSelectedText(fallbackString(filters.text));
  return effective;
}

export function applyCapsuleStateToApp(
  context: ApplyCapsuleStateContext,
  capsule: CapsuleMeta | null | undefined,
  { capsules = null as CapsuleMeta[] | null } = {},
) {
  if (!capsule) {
    return;
  }

  context.clearWardrobeProgressState();
  const effective = applyCapsuleFilters(context, capsule);
  context.setActiveCapsuleId(capsule.id || "");
  context.setActiveCapsuleMeta({
    ...capsule,
    status: capsule.status || buildCapsuleStatus(capsule),
  });
  context.setProfileItems(
    buildDisplayWardrobeItems(
      effective.data?.wardrobe?.items || [],
    ) as WardrobeItem[],
  );
  context.setProfileOutfitSets(
    normalizeOutfitSets(effective.data?.wardrobe?.outfitSets),
  );
  context.setPendingImageSetIndexes([]);

  if (Array.isArray(capsules)) {
    context.setCapsuleList(capsules);
  }
}
