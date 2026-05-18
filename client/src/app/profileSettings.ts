import {
  DEFAULT_PROFILE_IMAGE_LLM,
  DEFAULT_PROFILE_LLM,
  DEFAULT_PROFILE_THEME,
} from "../../../shared/profileSettings.js";
import type { ProfileSettings } from "./appTypes";

function normalizedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedSetting(value: unknown, fallback: string) {
  const normalized = normalizedString(value);
  return normalized || fallback;
}

function normalizedLowerSetting(value: unknown, fallback: string) {
  return normalizedSetting(value, fallback).toLowerCase();
}

function normalizedImageLlm(profile: Partial<ProfileSettings>) {
  return normalizedSetting(profile.imageLlm, DEFAULT_PROFILE_IMAGE_LLM);
}

export function normalizeProfileSettings(
  profile: Partial<ProfileSettings> = {},
  email = "",
): ProfileSettings {
  return {
    email: normalizedString(profile.email) || normalizedString(email),
    locale: normalizedSetting(profile.locale, "en"),
    fullname: normalizedString(profile.fullname),
    theme: normalizedSetting(profile.theme, DEFAULT_PROFILE_THEME),
    llm: normalizedSetting(profile.llm, DEFAULT_PROFILE_LLM),
    imageLlm: normalizedImageLlm(profile),
  };
}

export function buildProfileSettingsPayload(
  nextSettings: Partial<ProfileSettings>,
  currentSettings: ProfileSettings,
  locale: string,
) {
  const nextLocale = nextSettings.locale || currentSettings.locale || locale;
  const nextTheme = nextSettings.theme || currentSettings.theme;
  const nextLlm = nextSettings.llm || currentSettings.llm;
  const nextImageLlm = nextSettings.imageLlm || currentSettings.imageLlm;

  return {
    locale: normalizedLowerSetting(nextLocale, "en"),
    theme: normalizedLowerSetting(nextTheme, DEFAULT_PROFILE_THEME),
    llm: normalizedSetting(nextLlm, DEFAULT_PROFILE_LLM),
    imageLlm: normalizedSetting(nextImageLlm, DEFAULT_PROFILE_IMAGE_LLM),
    fullname: normalizedString(nextSettings.fullname),
  };
}
