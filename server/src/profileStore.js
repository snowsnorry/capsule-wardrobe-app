import {
  createProfileRecord,
  deleteProfileByEmail,
  getDistinctProductPatterns,
  getProfileByEmail,
  hasProfileByEmail,
  updateProfileByEmail,
  updateProfileLocaleByEmail,
  updateProfileActiveCapsuleIdByEmail
} from "./db.js";
import { ACCENT_COLOR_OPTIONS } from "../../shared/accentColors.js";
import { buildCanonicalPatternOptions } from "../../shared/patternOptions.js";
import { CORE_STYLE_ORDER, normalizeStyleValue } from "../../shared/stylePreferences.js";
import {
  DEFAULT_PROFILE_LLM,
  DEFAULT_PROFILE_THEME,
  PROFILE_LLM_VALUES,
  PROFILE_THEME_VALUES
} from "../../shared/profileSettings.js";

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

const PROFILE_PATTERN_OPTIONS = buildCanonicalPatternOptions();

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
  return buildCanonicalPatternOptions(
    availablePatterns.map((value) => normalizeStyleValue(value)),
    normalizeStyleValue(currentPattern)
  );
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
    const values = await getDistinctProductPatterns();
    return buildPatternOptions(values);
  } catch (error) {
    console.error("[profile/patterns]", error);
    return buildPatternOptions([]);
  }
}

function getAudienceOptions() {
  return audienceOptions;
}

function normalizeProfileRecord(profile) {
  if (!profile) {
    return null;
  }

  const theme = String(profile.theme || "").trim().toLowerCase();
  const llm = String(profile.llm || "").trim();
  const fullname = typeof profile.fullname === "string" && profile.fullname.trim()
    ? profile.fullname.trim()
    : null;

  return {
    ...profile,
    fullname,
    activeCapsuleId: typeof profile.activeCapsuleId === "string" && profile.activeCapsuleId.trim()
      ? profile.activeCapsuleId.trim()
      : null,
    theme: PROFILE_THEME_VALUES.includes(theme) ? theme : DEFAULT_PROFILE_THEME,
    llm: PROFILE_LLM_VALUES.includes(llm) ? llm : DEFAULT_PROFILE_LLM
  };
}

async function getProfile(email) {
  return normalizeProfileRecord(await getProfileByEmail(email));
}

async function hasProfile(email) {
  return hasProfileByEmail(email);
}

async function createProfile(email, data) {
  return normalizeProfileRecord(await createProfileRecord({
    email,
    locale: data.locale || "en"
  }));
}

async function updateProfile(email, data) {
  return normalizeProfileRecord(await updateProfileByEmail({
    email,
    locale: data.locale || "en",
    fullname: typeof data.fullname === "string" && data.fullname.trim()
      ? data.fullname.trim()
      : null,
    theme: PROFILE_THEME_VALUES.includes(String(data.theme || "").trim().toLowerCase())
      ? String(data.theme || "").trim().toLowerCase()
      : DEFAULT_PROFILE_THEME,
    llm: PROFILE_LLM_VALUES.includes(String(data.llm || "").trim())
      ? String(data.llm || "").trim()
      : DEFAULT_PROFILE_LLM
  }));
}

async function updateProfileLocale(email, locale) {
  return normalizeProfileRecord(await updateProfileLocaleByEmail({ email, locale }));
}

async function deleteProfile(email) {
  return deleteProfileByEmail(email);
}

async function updateProfileActiveCapsuleId(email, activeCapsuleId) {
  return normalizeProfileRecord(await updateProfileActiveCapsuleIdByEmail({ email, activeCapsuleId }));
}

export {
  getProfile,
  hasProfile,
  createProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  updateProfileActiveCapsuleId,
  getFormalityLevels,
  getStyles,
  getOccasions,
  getSeasons,
  getAudienceOptions,
  getPatternOptions,
  buildPatternOptions,
  normalizeProfileRecord,
  normalizeFormalityLevel,
  normalizeStyle,
  normalizeAccentColor as normalizeColor,
  PROFILE_FORMALITY_LEVEL_OPTIONS,
  PROFILE_STYLE_OPTIONS,
  PROFILE_OCCASION_OPTIONS,
  PROFILE_SEASON_OPTIONS,
  PROFILE_PATTERN_OPTIONS
};
