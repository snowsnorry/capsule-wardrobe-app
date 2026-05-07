import { fetchWardrobeFilters } from "./auth";

type WardrobeFiltersResponse = {
  formalityLevels?: string[] | null;
  styles?: string[] | null;
  occasions?: string[] | null;
  seasons?: string[] | null;
  audience?: string[] | null;
  patterns?: string[] | null;
};

type CachedProfileOptions = {
  styles: {
    core: string[];
    aesthetics: string[];
  };
  occasions: string[];
  seasons: string[];
  audience: string[];
  patterns: string[];
};

let cachedStyles: CachedProfileOptions["styles"] | null = null;
let cachedOccasions: string[] | null = null;
let cachedSeasons: string[] | null = null;
let cachedAudience: string[] | null = null;
let cachedPatterns: string[] | null = null;
let inFlight: Promise<CachedProfileOptions> | null = null;

async function loadProfileOptions(): Promise<CachedProfileOptions> {
  if (
    cachedStyles &&
    cachedOccasions &&
    cachedSeasons &&
    cachedAudience &&
    cachedPatterns
  ) {
    return {
      styles: cachedStyles,
      occasions: cachedOccasions,
      seasons: cachedSeasons,
      audience: cachedAudience,
      patterns: cachedPatterns,
    };
  }

  if (!inFlight) {
    inFlight = fetchWardrobeFilters()
      .then((filters: WardrobeFiltersResponse) => {
        cachedStyles = {
          core: filters.formalityLevels || [],
          aesthetics: filters.styles || [],
        };
        cachedOccasions = filters.occasions || [];
        cachedSeasons = filters.seasons || [];
        cachedAudience = filters.audience || [];
        cachedPatterns = filters.patterns || [];
        return {
          styles: cachedStyles,
          occasions: cachedOccasions,
          seasons: cachedSeasons,
          audience: cachedAudience,
          patterns: cachedPatterns,
        };
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

function clearProfileOptionsCache() {
  cachedStyles = null;
  cachedOccasions = null;
  cachedSeasons = null;
  cachedAudience = null;
  cachedPatterns = null;
  inFlight = null;
}

export { loadProfileOptions, clearProfileOptionsCache };
