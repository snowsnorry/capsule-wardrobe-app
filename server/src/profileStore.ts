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
import { logError } from "./logger.js";
import {
  DEFAULT_PROFILE_LLM,
  DEFAULT_PROFILE_IMAGE_LLM,
  DEFAULT_PROFILE_THEME,
  PROFILE_IMAGE_LLM_VALUES,
  PROFILE_LLM_VALUES,
  PROFILE_THEME_VALUES
} from "../../shared/profileSettings.js";

type ProfileTheme = (typeof PROFILE_THEME_VALUES)[number];
type ProfileLlm = (typeof PROFILE_LLM_VALUES)[number];
type ProfileImageLlm = (typeof PROFILE_IMAGE_LLM_VALUES)[number];
type ProfileOccasion = (typeof PROFILE_OCCASION_OPTIONS)[number];
type ProfileSeason = (typeof PROFILE_SEASON_OPTIONS)[number];

type ProfileRecord = {
  email: string;
  locale?: string;
  fullname?: string | null;
  activeCapsuleId?: string | null;
  theme?: string | null;
  llm?: string | null;
  imageLlm?: string | null;
  [key: string]: unknown;
};

type NormalizedProfileRecord = Omit<ProfileRecord, "fullname" | "activeCapsuleId" | "theme" | "llm" | "imageLlm"> & {
  fullname: string | null;
  activeCapsuleId: string | null;
  theme: ProfileTheme;
  llm: ProfileLlm;
  imageLlm: ProfileImageLlm;
};

type ProfilePayload = {
  locale?: string | null;
  fullname?: string | null;
  theme?: string | null;
  llm?: string | null;
  imageLlm?: string | null;
};

const PROFILE_FORMALITY_LEVEL_OPTIONS = [
  "casual",
  "smart_casual",
  "formal"
] as const;

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
] as const;

const PROFILE_OCCASION_OPTIONS = [
  "office",
  "brunch_in_the_city",
  "date_night",
  "everyday_errands"
] as const;

function normalizeOccasion(value: unknown): ProfileOccasion | null {
  const occasion = normalizeStyleValue(value);
  return PROFILE_OCCASION_OPTIONS.includes(occasion as ProfileOccasion) ? (occasion as ProfileOccasion) : null;
}

function normalizeOccasionList(values: unknown): ProfileOccasion[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => normalizeOccasion(value)).filter(Boolean))] as ProfileOccasion[];
}

const PROFILE_SEASON_OPTIONS = ["spring", "summer", "autumn", "winter"] as const;

const PROFILE_PATTERN_OPTIONS = buildCanonicalPatternOptions();

const audienceOptions = ["man", "woman", "any"] as const;

function buildPatternOptions(availablePatterns: readonly unknown[] = [], currentPattern: unknown = null): string[] {
  return buildCanonicalPatternOptions(
    availablePatterns.map((value) => normalizeStyleValue(value)),
    normalizeStyleValue(currentPattern)
  );
}

function normalizeAccentColor(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const color = String(value || "").trim().toLowerCase();
  if (!color) {
    return null;
  }

  return ACCENT_COLOR_OPTIONS.includes(color) ? color : null;
}

function normalizeFormalityLevel(value: unknown): string | null {
  const formalityLevel = normalizeStyleValue(value);
  return (CORE_STYLE_ORDER as readonly string[]).includes(formalityLevel) ? formalityLevel : null;
}

function normalizeStyle(value: unknown): string | null {
  const style = normalizeStyleValue(value);
  return style || null;
}

async function getFormalityLevels(_email: string): Promise<string[]> {
  return [...PROFILE_FORMALITY_LEVEL_OPTIONS];
}

async function getStyles(_email: string): Promise<string[]> {
  return [...PROFILE_STYLE_OPTIONS];
}

async function getOccasions(_email: string): Promise<ProfileOccasion[]> {
  return [...PROFILE_OCCASION_OPTIONS];
}

async function getSeasons(_email: string): Promise<ProfileSeason[]> {
  return [...PROFILE_SEASON_OPTIONS];
}

async function getPatternOptions(_email: string): Promise<string[]> {
  try {
    const values = await getDistinctProductPatterns();
    return buildPatternOptions(values);
  } catch (error) {
    logError("[profile/patterns]", error);
    return buildPatternOptions([]);
  }
}

function getAudienceOptions(): readonly string[] {
  return audienceOptions;
}

function normalizeProfileRecord(profile: ProfileRecord | null): NormalizedProfileRecord | null {
  if (!profile) {
    return null;
  }

  const theme = String(profile.theme || "").trim().toLowerCase();
  const llm = String(profile.llm || "").trim();
  const imageLlm = String(profile.imageLlm || "").trim();
  const fullname = typeof profile.fullname === "string" && profile.fullname.trim()
    ? profile.fullname.trim()
    : null;

  return {
    ...profile,
    fullname,
    activeCapsuleId: typeof profile.activeCapsuleId === "string" && profile.activeCapsuleId.trim()
      ? profile.activeCapsuleId.trim()
      : null,
    theme: (PROFILE_THEME_VALUES as readonly string[]).includes(theme) ? (theme as ProfileTheme) : DEFAULT_PROFILE_THEME,
    llm: (PROFILE_LLM_VALUES as readonly string[]).includes(llm) ? (llm as ProfileLlm) : DEFAULT_PROFILE_LLM,
    imageLlm: (PROFILE_IMAGE_LLM_VALUES as readonly string[]).includes(imageLlm)
      ? (imageLlm as ProfileImageLlm)
      : DEFAULT_PROFILE_IMAGE_LLM
  };
}

async function getProfile(email: string): Promise<NormalizedProfileRecord | null> {
  return normalizeProfileRecord(await getProfileByEmail(email));
}

async function hasProfile(email: string): Promise<boolean> {
  return hasProfileByEmail(email);
}

async function createProfile(email: string, data: ProfilePayload): Promise<NormalizedProfileRecord | null> {
  return normalizeProfileRecord(await createProfileRecord({
    email,
    locale: data.locale || "en"
  }));
}

async function updateProfile(email: string, data: ProfilePayload): Promise<NormalizedProfileRecord | null> {
  return normalizeProfileRecord(await updateProfileByEmail({
    email,
    locale: data.locale || "en",
    fullname: normalizeProfileFullname(data.fullname),
    theme: normalizeProfileTheme(data.theme),
    llm: normalizeProfileLlm(data.llm),
    imageLlm: normalizeProfileImageLlm(data.imageLlm)
  }));
}

function normalizeProfileFullname(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeProfileTheme(value: unknown): ProfileTheme {
  const theme = String(value || "").trim().toLowerCase();
  return (PROFILE_THEME_VALUES as readonly string[]).includes(theme) ? (theme as ProfileTheme) : DEFAULT_PROFILE_THEME;
}

function normalizeProfileLlm(value: unknown): ProfileLlm {
  const llm = String(value || "").trim();
  return (PROFILE_LLM_VALUES as readonly string[]).includes(llm) ? (llm as ProfileLlm) : DEFAULT_PROFILE_LLM;
}

function normalizeProfileImageLlm(value: unknown): ProfileImageLlm {
  const imageLlm = String(value || "").trim();
  return (PROFILE_IMAGE_LLM_VALUES as readonly string[]).includes(imageLlm)
    ? (imageLlm as ProfileImageLlm)
    : DEFAULT_PROFILE_IMAGE_LLM;
}

async function updateProfileLocale(email: string, locale: string): Promise<NormalizedProfileRecord | null> {
  return normalizeProfileRecord(await updateProfileLocaleByEmail({ email, locale }));
}

async function deleteProfile(email: string): Promise<boolean> {
  return deleteProfileByEmail(email);
}

async function updateProfileActiveCapsuleId(
  email: string,
  activeCapsuleId: string | null
): Promise<NormalizedProfileRecord | null> {
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
  normalizeOccasion,
  normalizeOccasionList,
  normalizeAccentColor as normalizeColor,
  PROFILE_FORMALITY_LEVEL_OPTIONS,
  PROFILE_STYLE_OPTIONS,
  PROFILE_OCCASION_OPTIONS,
  PROFILE_SEASON_OPTIONS,
  PROFILE_PATTERN_OPTIONS
};
