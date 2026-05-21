const CATEGORY_OPTIONS = [
  "bag",
  "belt",
  "bottom",
  "dress",
  "midlayer",
  "other",
  "outerwear",
  "shoes",
  "swimwear",
  "top",
] as const;
const SEASON_OPTIONS = ["autumn", "spring", "summer", "winter"] as const;
const FORMALITY_LEVEL_OPTIONS = ["casual", "formal", "smart_casual"] as const;
const STYLE_OPTIONS = [
  "minimalistic",
  "street_style",
  "romantic",
  "preppy",
  "retro",
  "boho",
  "nautical",
  "safari",
  "equestrian",
  "military",
  "grunge",
  "sporty",
] as const;
const OCCASION_OPTIONS = [
  "brunch_in_the_city",
  "date_night",
  "everyday_errands",
  "office",
] as const;
const AUDIENCE_OPTIONS = ["woman", "man", "all"] as const;
const COLOR_OPTIONS = [
  "beige",
  "black",
  "blue",
  "brown",
  "burgundy",
  "denim",
  "green",
  "grey",
  "khaki",
  "light blue",
  "metallic",
  "multicolor",
  "navy",
  "orange",
  "pink",
  "purple",
  "red",
  "white",
  "yellow",
] as const;
const PATTERN_OPTIONS = [
  "abstract",
  "argyle",
  "cable",
  "camo",
  "check",
  "color_block",
  "corduroy",
  "crocodile",
  "floral",
  "graphic",
  "herringbone",
  "houndstooth",
  "jacquard",
  "lace",
  "leopard",
  "logo",
  "marble",
  "paisley",
  "polka_dot",
  "quilted",
  "ribbed",
  "snake",
  "solid",
  "stripe",
  "tie_dye",
  "waffle",
  "zebra",
] as const;
const SILHOUETTE_OPTIONS = [
  "a_line",
  "asymmetric",
  "balloon",
  "barrel",
  "belted",
  "boxy",
  "cocoon",
  "cropped",
  "draped",
  "fit_and_flare",
  "flare",
  "peplum",
  "straight",
  "tapered",
  "wide_leg",
  "wrap",
] as const;
const FIT_OPTIONS = [
  "loose",
  "oversized",
  "regular",
  "relaxed",
  "skinny",
  "slim",
] as const;
const CLOSURE_TYPE_OPTIONS = [
  "buckle",
  "button",
  "drawstring",
  "elastic",
  "hook_and_eye",
  "lace_up",
  "magnetic",
  "snap",
  "tie_belt",
  "toggle",
  "velcro",
  "zipper",
] as const;

const FALLBACK_SEARCH_SCHEMA_OPTIONS = {
  audience: AUDIENCE_OPTIONS,
  category: CATEGORY_OPTIONS,
  season: SEASON_OPTIONS,
  formalityLevel: FORMALITY_LEVEL_OPTIONS,
  style: STYLE_OPTIONS,
  occasions: OCCASION_OPTIONS,
  color: COLOR_OPTIONS,
  pattern: PATTERN_OPTIONS,
  silhouette: SILHOUETTE_OPTIONS,
  fit: FIT_OPTIONS,
  closureType: CLOSURE_TYPE_OPTIONS,
} as const;

export type SearchSchemaOptions = {
  [Key in keyof typeof FALLBACK_SEARCH_SCHEMA_OPTIONS]: readonly string[];
};

type SearchSchemaOptionsLoader = {
  profileEmail: string;
  getSearchOptionsImpl: (email: string) => Promise<Record<string, unknown>>;
};

const searchSchemaOptionsCache = new Map<
  string,
  Promise<SearchSchemaOptions>
>();

function toSearchSchemaOptions(options: Record<string, unknown>) {
  return {
    audience: getOptionValues(options.audience, AUDIENCE_OPTIONS),
    category: getOptionValues(options.categories, CATEGORY_OPTIONS),
    season: getOptionValues(options.seasons, SEASON_OPTIONS),
    formalityLevel: getOptionValues(
      options.formalityLevels,
      FORMALITY_LEVEL_OPTIONS,
    ),
    style: getOptionValues(options.styles, STYLE_OPTIONS),
    occasions: getOptionValues(options.occasions, OCCASION_OPTIONS),
    color: getOptionValues(options.colors, COLOR_OPTIONS),
    pattern: getOptionValues(options.patterns, PATTERN_OPTIONS),
    silhouette: getOptionValues(options.silhouettes, SILHOUETTE_OPTIONS),
    fit: getOptionValues(options.fits, FIT_OPTIONS),
    closureType: getOptionValues(options.closureTypes, CLOSURE_TYPE_OPTIONS),
  } satisfies SearchSchemaOptions;
}

function getOptionValues(
  values: unknown,
  fallback: readonly string[],
): readonly string[] {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const normalized = [
    ...new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  ];
  return normalized.length > 0 ? normalized : fallback;
}

export async function getCachedSearchSchemaOptions({
  getSearchOptionsImpl,
  profileEmail,
}: SearchSchemaOptionsLoader): Promise<SearchSchemaOptions> {
  const cached = searchSchemaOptionsCache.get(profileEmail);
  if (cached) {
    return cached;
  }

  const pending = getSearchOptionsImpl(profileEmail)
    .then(toSearchSchemaOptions)
    .catch(() => {
      searchSchemaOptionsCache.delete(profileEmail);
      return FALLBACK_SEARCH_SCHEMA_OPTIONS;
    });
  searchSchemaOptionsCache.set(profileEmail, pending);
  return pending;
}
