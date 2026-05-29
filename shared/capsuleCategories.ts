type CapsuleCategoryProfile = {
  audience?: unknown;
  season?: unknown;
};

type CapsuleCategoryItem = {
  category?: unknown;
  id?: unknown;
  processingStatus?: unknown;
};

type CapsuleCategoryShortfall = {
  category: string;
  required: number;
  available: number;
  missing: number;
};

const BASE_CAPSULE_CATEGORIES: Record<string, number> = {
  bottom: 3,
  top: 3,
  outerwear: 1,
  shoes: 2,
  belt: 1,
  bag: 2,
};

const MIDLAYER_SEASONS = new Set(["winter", "autumn", "spring"]);

function normalizeSeasons(season: unknown): string[] {
  if (Array.isArray(season)) {
    return season
      .map((value) =>
        String(value || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
  }

  if (typeof season === "string" && season.trim().length > 0) {
    return [season.trim().toLowerCase()];
  }

  return [];
}

function getCapsuleCategories(
  userProfile: CapsuleCategoryProfile | null = null,
): Record<string, number> {
  const categories = { ...BASE_CAPSULE_CATEGORIES };
  const audience = String(userProfile?.audience || "")
    .trim()
    .toLowerCase();
  const seasons = normalizeSeasons(userProfile?.season);
  const hasMidlayerSeason = seasons.some((season) =>
    MIDLAYER_SEASONS.has(season),
  );
  const hasSummer = seasons.includes("summer");

  if (audience === "woman") {
    categories.dress = hasSummer ? 2 : 1;
  }

  if (hasMidlayerSeason) {
    categories.midlayer = 2;
    categories.outerwear = 2;
  }

  return categories;
}

function getReadyWardrobeCapsuleItems(
  items: readonly CapsuleCategoryItem[] = [],
): CapsuleCategoryItem[] {
  return items.filter((item) => {
    const category =
      typeof item?.category === "string" ? item.category.trim() : "";
    return item?.processingStatus === "ready" && category.length > 0;
  });
}

function countReadyWardrobeItemsByCategory(
  items: readonly CapsuleCategoryItem[] = [],
): Record<string, number> {
  return getReadyWardrobeCapsuleItems(items).reduce<Record<string, number>>(
    (result, item) => {
      const category = String(item.category).trim();
      result[category] = (result[category] || 0) + 1;
      return result;
    },
    {},
  );
}

function countItemsByCategory(
  items: readonly CapsuleCategoryItem[] = [],
): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const category =
      typeof item?.category === "string" ? item.category.trim() : "";
    if (category.length > 0) {
      result[category] = (result[category] || 0) + 1;
    }
    return result;
  }, {});
}

function expandCapsuleCategoriesForAnchors(
  baseCategories: Record<string, number>,
  anchorItems: readonly CapsuleCategoryItem[] = [],
): Record<string, number> {
  const anchorCounts = countItemsByCategory(anchorItems);
  return Object.fromEntries(
    Object.entries({ ...baseCategories, ...anchorCounts }).map(
      ([category, baseCount]) => [
        category,
        Math.max(Number(baseCategories[category] || 0), Number(baseCount || 0)),
      ],
    ),
  );
}

function getCapsuleCategoryShortfalls({
  anchorItems = [],
  items,
  profile,
}: {
  anchorItems?: readonly CapsuleCategoryItem[];
  items: readonly CapsuleCategoryItem[];
  profile: CapsuleCategoryProfile;
}): CapsuleCategoryShortfall[] {
  const requiredCategories = expandCapsuleCategoriesForAnchors(
    getCapsuleCategories(profile),
    anchorItems,
  );
  const availableCategories = countReadyWardrobeItemsByCategory(items);

  return Object.entries(requiredCategories)
    .map(([category, required]) => {
      const available = availableCategories[category] || 0;
      return {
        category,
        required,
        available,
        missing: Math.max(0, required - available),
      };
    })
    .filter((item) => item.missing > 0);
}

export {
  expandCapsuleCategoriesForAnchors,
  getCapsuleCategories,
  getCapsuleCategoryShortfalls,
  getReadyWardrobeCapsuleItems,
};
export type { CapsuleCategoryShortfall };
