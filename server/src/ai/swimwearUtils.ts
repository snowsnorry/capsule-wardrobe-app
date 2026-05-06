import type { SwimwearCandidate, UserProfileLike } from "./types.js";

function normalizeSeasonList(season: UserProfileLike["season"]) {
  if (Array.isArray(season)) {
    return season
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof season === "string" && season.trim().length > 0) {
    return [season.trim().toLowerCase()];
  }

  return [];
}

function shouldGenerateSwimwear(userProfile: UserProfileLike | null = null) {
  return normalizeSeasonList(userProfile?.season).includes("summer");
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function getItemColors(items: SwimwearCandidate[], category: string) {
  return dedupeStrings(
    items
      .filter((item) => item?.category === category)
      .flatMap((item) => Array.isArray(item?.color_base) ? item.color_base : [])
      .map((value) => String(value || "").trim().toLowerCase())
  );
}

function formatItemColor(item: SwimwearCandidate) {
  const colorParts = [];

  if (Array.isArray(item?.color_base) && item.color_base.length > 0) {
    colorParts.push(item.color_base.join(", "));
  }

  if (typeof item?.pattern === "string" && item.pattern.trim().length > 0) {
    colorParts.push(item.pattern.trim());
  }

  if (item?.is_neutral) {
    colorParts.push("neutral");
  }

  return colorParts.join(", ") || "not specified";
}

function sanitizeProductRow(item: unknown): SwimwearCandidate | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const normalized = { ...(item as Record<string, unknown>) } as Record<string, unknown>;
  delete normalized.embedding;
  delete normalized.distance;
  return normalized;
}

function getItemValue(item: SwimwearCandidate, key: keyof SwimwearCandidate, fallback: unknown = "") {
  return item?.[key] ?? fallback;
}

function toWardrobeUiItem(item: SwimwearCandidate) {
  return {
    id: getItemValue(item, "id", null),
    url: getItemValue(item, "url"),
    name: getItemValue(item, "name"),
    category: getItemValue(item, "category"),
    image_url: getItemValue(item, "image_url"),
    audience: getItemValue(item, "audience")
  };
}

export {
  dedupeStrings,
  formatItemColor,
  getItemColors,
  sanitizeProductRow,
  shouldGenerateSwimwear,
  toWardrobeUiItem
};
