import {
  fetchStylePreferences,
  fetchWardrobeOccasions,
  fetchWardrobeSeasons,
  fetchWardrobeAudience,
  fetchPatternOptions
} from "./auth.js";

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
    inFlight = Promise.all([
      fetchStylePreferences(),
      fetchWardrobeOccasions(),
      fetchWardrobeSeasons(),
      fetchWardrobeAudience(),
      fetchPatternOptions()
    ])
      .then(([styles, occasions, seasons, audience, patterns]) => {
        cachedStyles = styles.items || [];
        cachedOccasions = occasions.items || [];
        cachedSeasons = seasons.items || [];
        cachedAudience = audience.items || [];
        cachedPatterns = patterns.items || [];
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
