import { fetchStylePreferences, fetchWardrobeOccasions } from "./auth.js";

let cachedStyles = null;
let cachedOccasions = null;
let inFlight = null;

async function loadProfileOptions() {
  if (cachedStyles && cachedOccasions) {
    return { styles: cachedStyles, occasions: cachedOccasions };
  }

  if (!inFlight) {
    inFlight = Promise.all([fetchStylePreferences(), fetchWardrobeOccasions()])
      .then(([styles, occasions]) => {
        cachedStyles = styles.items || [];
        cachedOccasions = occasions.items || [];
        return { styles: cachedStyles, occasions: cachedOccasions };
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
  inFlight = null;
}

export { loadProfileOptions, clearProfileOptionsCache };
