import {
  fetchStylePreferences,
  fetchWardrobeOccasions,
  fetchWardrobeSeasons,
  fetchWardrobeAudience
} from "./auth.js";

let cachedStyles = null;
let cachedOccasions = null;
let cachedSeasons = null;
let cachedAudience = null;
let inFlight = null;

async function loadProfileOptions() {
  if (cachedStyles && cachedOccasions && cachedSeasons && cachedAudience) {
    return {
      styles: cachedStyles,
      occasions: cachedOccasions,
      seasons: cachedSeasons,
      audience: cachedAudience
    };
  }

  if (!inFlight) {
    inFlight = Promise.all([
      fetchStylePreferences(),
      fetchWardrobeOccasions(),
      fetchWardrobeSeasons(),
      fetchWardrobeAudience()
    ])
      .then(([styles, occasions, seasons, audience]) => {
        cachedStyles = styles.items || [];
        cachedOccasions = occasions.items || [];
        cachedSeasons = seasons.items || [];
        cachedAudience = audience.items || [];
        return {
          styles: cachedStyles,
          occasions: cachedOccasions,
          seasons: cachedSeasons,
          audience: cachedAudience
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
  inFlight = null;
}

export { loadProfileOptions, clearProfileOptionsCache };
