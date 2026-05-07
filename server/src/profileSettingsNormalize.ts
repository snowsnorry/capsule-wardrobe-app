import {
  DEFAULT_PROFILE_IMAGE_LLM,
  DEFAULT_PROFILE_LLM,
  DEFAULT_PROFILE_THEME,
  PROFILE_IMAGE_LLM_VALUES,
  PROFILE_LLM_VALUES,
  PROFILE_THEME_VALUES,
} from "../../shared/profileSettings.js";

type ProfileTheme = (typeof PROFILE_THEME_VALUES)[number];
type ProfileLlm = (typeof PROFILE_LLM_VALUES)[number];
type ProfileImageLlm = (typeof PROFILE_IMAGE_LLM_VALUES)[number];

export function normalizeProfileFullname(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeProfileTheme(value: unknown): ProfileTheme {
  const theme = String(value || "")
    .trim()
    .toLowerCase();
  return (PROFILE_THEME_VALUES as readonly string[]).includes(theme)
    ? (theme as ProfileTheme)
    : DEFAULT_PROFILE_THEME;
}

export function normalizeProfileLlm(value: unknown): ProfileLlm {
  const llm = String(value || "").trim();
  return (PROFILE_LLM_VALUES as readonly string[]).includes(llm)
    ? (llm as ProfileLlm)
    : DEFAULT_PROFILE_LLM;
}

export function normalizeProfileImageLlm(value: unknown): ProfileImageLlm {
  const imageLlm = String(value || "").trim();
  return (PROFILE_IMAGE_LLM_VALUES as readonly string[]).includes(imageLlm)
    ? (imageLlm as ProfileImageLlm)
    : DEFAULT_PROFILE_IMAGE_LLM;
}

export type { ProfileTheme, ProfileLlm, ProfileImageLlm };
