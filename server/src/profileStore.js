import {
  createProfileRecord,
  deleteProfileByEmail,
  getDistinctProductPatterns,
  getProfileByEmail,
  getProfilePdfByEmail,
  hasProfileByEmail,
  updateProfileRecord,
  updateProfilePdfByEmail,
  updateProfileLocaleByEmail,
  updateProfileItemsByEmail
} from "./db.js";
import { ACCENT_COLOR_OPTIONS } from "../../shared/accentColors.js";
import { CORE_STYLE_ORDER, normalizeStyleValue } from "../../shared/stylePreferences.js";

const PROFILE_FORMALITY_LEVEL_OPTIONS = [
  "casual",
  "smart_casual",
  "formal"
];

const PROFILE_STYLE_OPTIONS = [
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
  "sporty"
];

const PROFILE_OCCASION_OPTIONS = [
  "office",
  "brunch_in_the_city",
  "date_night",
  "school_drop-off",
  "weekend_with_family"
];

const PROFILE_SEASON_OPTIONS = ["spring", "summer", "autumn", "winter"];

const PROFILE_PATTERN_OPTIONS = [
  "solid",
  "stripe",
  "check",
  "floral",
  "leopard",
  "zebra",
  "snake",
  "paisley",
  "polka_dot",
  "herringbone",
  "dogtooth",
  "marble",
  "abstract",
  "lace",
  "corduroy"
];

const audienceOptions = ["man", "woman", "any"];

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

function buildPatternOptions(availablePatterns = [], currentPattern = null) {
  const available = new Set(
    dedupeStrings(availablePatterns.map((value) => normalizeStyleValue(value)))
  );
  const current = normalizeStyleValue(currentPattern);
  return PROFILE_PATTERN_OPTIONS.filter((value) => available.has(value) || value === current);
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

  const color = String(value || "").trim().toLowerCase();
  if (!color) {
    return null;
  }

  return ACCENT_COLOR_OPTIONS.includes(color) ? color : null;
}

function normalizeFormalityLevel(value) {
  const formalityLevel = normalizeStyleValue(value);
  return CORE_STYLE_ORDER.includes(formalityLevel) ? formalityLevel : null;
}

function normalizeStyle(value) {
  const style = normalizeStyleValue(value);
  return style || null;
}

async function getFormalityLevels(email) {
  return [...PROFILE_FORMALITY_LEVEL_OPTIONS];
}

async function getStyles(email) {
  return [...PROFILE_STYLE_OPTIONS];
}

async function getOccasions(email) {
  return [...PROFILE_OCCASION_OPTIONS];
}

async function getSeasons(email) {
  return [...PROFILE_SEASON_OPTIONS];
}

async function getPatternOptions(email) {
  try {
    const profile = email ? await getProfile(email) : null;
    const values = await getDistinctProductPatterns();
    return buildPatternOptions(values, profile?.pattern || null);
  } catch (error) {
    console.error("[profile/patterns]", error);
    const profile = email ? await getProfile(email).catch(() => null) : null;
    return buildPatternOptions([], profile?.pattern || null);
  }
}

function getAudienceOptions() {
  return audienceOptions;
}

async function getProfile(email) {
  const profile = await getProfileByEmail(email);
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    formalityLevel: normalizeFormalityLevel(profile.formalityLevel),
    style: normalizeStyle(profile.style),
    audience: normalizeWardrobeAudience(profile.audience),
    color: normalizeAccentColor(profile.color),
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
    formalityLevel: normalizeFormalityLevel(data.formalityLevel),
    style: normalizeStyle(data.style),
    occasions: data.occasions || [],
    season: data.season || [],
    audience: normalizeWardrobeAudience(data.audience),
    color: null,
    pattern: null,
    locale: data.locale || "en"
  });
}

async function updateProfile(email, data) {
  return updateProfileRecord({
    email,
    formalityLevel: normalizeFormalityLevel(data.formalityLevel),
    style: normalizeStyle(data.style),
    occasions: data.occasions || [],
    season: data.season || [],
    audience: normalizeWardrobeAudience(data.audience),
    color: normalizeAccentColor(data.color),
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

async function updateProfileItems(email, items) {
  return updateProfileItemsByEmail({ email, items });
}

async function getProfilePdf(email) {
  return getProfilePdfByEmail(email);
}

async function updateProfilePdf(email, pdf) {
  return updateProfilePdfByEmail({ email, pdf });
}

export {
  getProfile,
  hasProfile,
  createProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  updateProfileItems,
  getProfilePdf,
  updateProfilePdf,
  getFormalityLevels,
  getStyles,
  getOccasions,
  getSeasons,
  getAudienceOptions,
  getPatternOptions,
  buildPatternOptions,
  normalizeFormalityLevel,
  normalizeStyle,
  normalizeAccentColor as normalizeColor,
  PROFILE_FORMALITY_LEVEL_OPTIONS,
  PROFILE_STYLE_OPTIONS,
  PROFILE_OCCASION_OPTIONS,
  PROFILE_SEASON_OPTIONS,
  PROFILE_PATTERN_OPTIONS
};
