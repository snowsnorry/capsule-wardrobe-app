import {
  createProfileRecord,
  deleteProfileByEmail,
  getDistinctProductFormalityLevels,
  getDistinctProductOccasions,
  getDistinctProductPatterns,
  getDistinctProductSeasons,
  getProfileByEmail,
  hasProfileByEmail,
  updateProfileRecord,
  updateProfileLocaleByEmail,
  updateProfileWardrobeItemsByEmail
} from "./db.js";
import { ACCENT_COLOR_OPTIONS } from "../../shared/accentColors.js";

const FALLBACK_STYLE_PREFERENCES = [
  "casual",
  "formal",
  "romantic",
  "minimal",
  "sporty",
  "classic",
  "boho",
  "streetwear"
];

const FALLBACK_WARDROBE_OCCASIONS = [
  "office",
  "city_walk",
  "school_dropoff",
  "party",
  "travel",
  "weekend",
  "date_night",
  "outdoor"
];

const FALLBACK_WARDROBE_SEASONS = ["spring", "summer", "autumn", "winter"];

const wardrobeAudience = ["man", "woman", "any"];

function dedupeStrings(items) {
  return [...new Set(items.filter((item) => typeof item === "string" && item.trim()))];
}

function mergeOptionValues(primaryItems, fallbackItems, extraItems = []) {
  const sourceItems = Array.isArray(primaryItems) && primaryItems.length > 0 ? primaryItems : fallbackItems;
  return dedupeStrings([...sourceItems, ...extraItems]);
}

async function getDynamicOptions(loadValues, fallbackItems, extraItems = []) {
  try {
    const values = await loadValues();
    return mergeOptionValues(values, fallbackItems, extraItems);
  } catch (error) {
    console.error("[profile/options]", error);
    return mergeOptionValues([], fallbackItems, extraItems);
  }
}

function normalizeWardrobeAudience(value) {
  const audience = String(value || "").trim().toLowerCase();
  if (audience === "man" || audience === "woman" || audience === "any") {
    return audience;
  }
  return "any";
}

function normalizeAccentColor(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const accentColor = String(value || "").trim().toLowerCase();
  if (!accentColor) {
    return null;
  }

  return ACCENT_COLOR_OPTIONS.includes(accentColor) ? accentColor : null;
}

async function getStylePreferences(email) {
  try {
    const profile = email ? await getProfile(email) : null;
    return await getDynamicOptions(
      getDistinctProductFormalityLevels,
      FALLBACK_STYLE_PREFERENCES,
      profile?.stylePreferences || []
    );
  } catch (error) {
    console.error("[profile/style-preferences]", error);
    return [...FALLBACK_STYLE_PREFERENCES];
  }
}

async function getWardrobeOccasions(email) {
  try {
    const profile = email ? await getProfile(email) : null;
    return await getDynamicOptions(
      getDistinctProductOccasions,
      FALLBACK_WARDROBE_OCCASIONS,
      profile?.wardrobeOccasions || []
    );
  } catch (error) {
    console.error("[profile/wardrobe-occasions]", error);
    return [...FALLBACK_WARDROBE_OCCASIONS];
  }
}

async function getWardrobeSeasons(email) {
  try {
    const profile = email ? await getProfile(email) : null;
    return await getDynamicOptions(
      getDistinctProductSeasons,
      FALLBACK_WARDROBE_SEASONS,
      profile?.wardrobeSeasons || []
    );
  } catch (error) {
    console.error("[profile/wardrobe-seasons]", error);
    return [...FALLBACK_WARDROBE_SEASONS];
  }
}

async function getPatternOptions(email) {
  try {
    const profile = email ? await getProfile(email) : null;
    return await getDynamicOptions(getDistinctProductPatterns, [], profile?.pattern ? [profile.pattern] : []);
  } catch (error) {
    console.error("[profile/patterns]", error);
    return [];
  }
}

function getWardrobeAudience() {
  return wardrobeAudience;
}

async function getProfile(email) {
  const profile = await getProfileByEmail(email);
  if (!profile) {
    return null;
  }
  return {
    ...profile,
    wardrobeAudience: normalizeWardrobeAudience(profile.wardrobeAudience),
    accentColor: normalizeAccentColor(profile.accentColor),
    pattern: typeof profile.pattern === "string" && profile.pattern.trim()
      ? profile.pattern.trim().toLowerCase()
      : null
  };
}

async function hasProfile(email) {
  return hasProfileByEmail(email);
}

async function createProfile(email, data) {
  return createProfileRecord({
    email,
    stylePreferences: data.stylePreferences || [],
    wardrobeOccasions: data.wardrobeOccasions || [],
    wardrobeSeasons: data.wardrobeSeasons || [],
    wardrobeAudience: normalizeWardrobeAudience(data.wardrobeAudience),
    accentColor: null,
    pattern: null,
    locale: data.locale || "en"
  });
}

async function updateProfile(email, data) {
  return updateProfileRecord({
    email,
    stylePreferences: data.stylePreferences || [],
    wardrobeOccasions: data.wardrobeOccasions || [],
    wardrobeSeasons: data.wardrobeSeasons || [],
    wardrobeAudience: normalizeWardrobeAudience(data.wardrobeAudience),
    accentColor: normalizeAccentColor(data.accentColor),
    pattern: typeof data.pattern === "string" && data.pattern.trim() ? data.pattern.trim().toLowerCase() : null,
    locale: data.locale || "en"
  });
}

async function updateProfileLocale(email, locale) {
  return updateProfileLocaleByEmail({ email, locale });
}

async function deleteProfile(email) {
  return deleteProfileByEmail(email);
}

async function updateProfileWardrobeItems(email, wardrobeItems) {
  return updateProfileWardrobeItemsByEmail({ email, wardrobeItems });
}

export {
  getProfile,
  hasProfile,
  createProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  updateProfileWardrobeItems,
  getStylePreferences,
  getWardrobeOccasions,
  getWardrobeSeasons,
  getWardrobeAudience,
  getPatternOptions
};
