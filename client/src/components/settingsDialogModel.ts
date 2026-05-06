import { PROFILE_IMAGE_LLM_VALUES, PROFILE_LLM_VALUES, PROFILE_THEME_VALUES } from "../../../shared/profileSettings.js";

export const SETTINGS_SECTIONS = ["general", "ai", "account"] as const;
export const LANGUAGE_OPTIONS = ["en", "ru"] as const;
export const PROFILE_THEME_OPTIONS = [...PROFILE_THEME_VALUES];
export const PROFILE_LLM_OPTIONS = [...PROFILE_LLM_VALUES];
export const PROFILE_IMAGE_LLM_OPTIONS = [...PROFILE_IMAGE_LLM_VALUES];

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export type SettingsLocale = (typeof LANGUAGE_OPTIONS)[number];
export type SettingsTheme = (typeof PROFILE_THEME_VALUES)[number];
export type SettingsLlm = (typeof PROFILE_LLM_VALUES)[number];
export type SettingsImageLlm = (typeof PROFILE_IMAGE_LLM_VALUES)[number];

export type SettingsProfile = {
  fullname?: string | null;
  email?: string | null;
  locale?: string | null;
  theme?: string | null;
  llm?: string | null;
  imageLlm?: string | null;
  image_llm?: string | null;
};

export type SettingsDraft = {
  fullname: string;
  email: string;
  locale: SettingsLocale;
  theme: SettingsTheme;
  llm: SettingsLlm;
  imageLlm: SettingsImageLlm;
};

export type SettingsSavePayload = {
  fullname: string;
  locale: SettingsLocale;
  theme: SettingsTheme;
  llm: SettingsLlm;
  image_llm: SettingsImageLlm;
};

export type PasskeyMetadata = {
  id: string;
  name?: string | null;
  deviceType?: string | null;
  backedUp?: boolean | null;
  transports?: string[] | null;
  createdAt?: string | null;
  lastUsedAt?: string | null;
};

export type SettingsDialogProps = {
  open: boolean;
  settings: SettingsProfile;
  onClose: () => void;
  onSave: (settings: SettingsSavePayload) => Promise<void> | void;
};

function isOneOf<T extends string>(options: readonly T[], value: string | null | undefined): value is T {
  return typeof value === "string" && options.some((option) => option === value);
}

export function normalizeLocaleValue(value: string): SettingsLocale {
  return isOneOf(LANGUAGE_OPTIONS, value) ? value : "en";
}

export function normalizeThemeValue(value: string): SettingsTheme {
  return isOneOf(PROFILE_THEME_OPTIONS, value) ? value : "system";
}

export function normalizeLlmValue(value: string): SettingsLlm {
  return isOneOf(PROFILE_LLM_OPTIONS, value) ? value : "openai:gpt-5.5";
}

export function normalizeImageLlmValue(value: string): SettingsImageLlm {
  return isOneOf(PROFILE_IMAGE_LLM_OPTIONS, value) ? value : "openai:gpt-image-2";
}

export function normalizeSettingsDraft(settings: SettingsProfile = {}, fallbackEmail = ""): SettingsDraft {
  return {
    fullname: typeof settings.fullname === "string" ? settings.fullname : "",
    email: String(settings.email || fallbackEmail || "").trim(),
    locale: isOneOf(LANGUAGE_OPTIONS, settings.locale) ? settings.locale : "en",
    theme: normalizeThemeValue(String(settings.theme || "")),
    llm: normalizeLlmValue(String(settings.llm || "")),
    imageLlm: normalizeImageLlmValue(String(settings.imageLlm || settings.image_llm || ""))
  };
}

export function formatPasskeyCreatedAt(createdAt: string | null | undefined, locale: string): { date: string; time: string } | null {
  if (!createdAt) {
    return null;
  }

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) {
    return null;
  }

  return {
    date: new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(createdDate),
    time: new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(createdDate)
  };
}
