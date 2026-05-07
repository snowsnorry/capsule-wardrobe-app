import {
  DEFAULT_CAPSULE_NAME,
  normalizeCapsuleSnapshot,
  type CapsuleFilters,
  type CapsuleSnapshot,
  type SharedCapsuleOgMetadata,
} from "./capsuleStoreModel.js";
import { t, translateOption } from "../../shared/i18n/helpers.js";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
