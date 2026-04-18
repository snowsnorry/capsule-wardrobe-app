const _CATEGORIES: Record<string, number> = {
  bottom: 3,
  top: 3,
  outerwear: 1,
  shoes: 2,
  belt: 1,
  bag: 2
};

const MIDLAYER_SEASONS = new Set(["winter", "autumn", "spring"]);

function normalizeSeasons(season) {
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

function getCapsuleCategories(userProfile = null) {
  const categories = { ..._CATEGORIES };
  const audience = String(userProfile?.audience || "").trim().toLowerCase();
  const seasons = normalizeSeasons(userProfile?.season);
  const hasMidlayerSeason = seasons.some((season) => MIDLAYER_SEASONS.has(season));
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

export { getCapsuleCategories };
