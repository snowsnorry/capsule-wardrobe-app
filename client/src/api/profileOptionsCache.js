import { fetchWardrobeFilters } from "./auth.js";

let cachedStyles = null;
let cachedOccasions = null;
let cachedSeasons = null;
let cachedAudience = null;
let cachedPatterns = null;
let inFlight = null;

async function loadProfileOptions() {
  if (cachedStyles && cachedOccasions && cachedSeasons && cachedAudience && cachedPatterns) {
    return {
      styles: cachedStyles,
      occasions: cachedOccasions,
      seasons: cachedSeasons,
      audience: cachedAudience,
      patterns: cachedPatterns
    };
  }

  if (!inFlight) {
    inFlight = fetchWardrobeFilters()
      .then((filters) => {
        cachedStyles = {
          core: filters.formalityLevels || [],
          aesthetics: filters.styles || []
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
          patterns: cachedPatterns
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
