import { fetchWardrobeFilters } from "./auth";
import type {
  ProfileOptionsResult,
  WardrobeFiltersResponse,
} from "../app/appTypes";

type CachedProfileOptions = ProfileOptionsResult;

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
      .then((filters: WardrobeFiltersResponse) =>
        primeProfileOptionsCache(filters),
      )
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

function primeProfileOptionsCache(
  filters: WardrobeFiltersResponse,
): CachedProfileOptions {
  inFlight = null;
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
}

function clearProfileOptionsCache() {
  cachedStyles = null;
  cachedOccasions = null;
  cachedSeasons = null;
  cachedAudience = null;
  cachedPatterns = null;
  inFlight = null;
}

export {
  loadProfileOptions,
  primeProfileOptionsCache,
  clearProfileOptionsCache,
};
