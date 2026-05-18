import { SUPPORTED_LOCALES } from "./appConfig.js";
import {
  DEFAULT_PROFILE_IMAGE_LLM,
  DEFAULT_PROFILE_LLM,
  DEFAULT_PROFILE_THEME,
  PROFILE_IMAGE_LLM_VALUES,
  PROFILE_LLM_VALUES,
  PROFILE_THEME_VALUES,
} from "../../shared/profileSettings.js";

type ProfileSettingsPayload = {
  locale: string;
  theme: string;
  llm: string;
  imageLlm: string;
  fullname: string | null;
};
function isProfileThemeValue(
  value: string,
): value is (typeof PROFILE_THEME_VALUES)[number] {
  return (PROFILE_THEME_VALUES as readonly string[]).includes(value);
}

function isProfileLlmValue(
  value: string,
): value is (typeof PROFILE_LLM_VALUES)[number] {
  return (PROFILE_LLM_VALUES as readonly string[]).includes(value);
}

function isProfileImageLlmValue(
  value: string,
): value is (typeof PROFILE_IMAGE_LLM_VALUES)[number] {
  return (PROFILE_IMAGE_LLM_VALUES as readonly string[]).includes(value);
}

function isProfileSettingsRecord(
  payload: unknown,
): payload is Record<string, unknown> {
  return Boolean(
    payload && typeof payload === "object" && !Array.isArray(payload),
  );
}

function getNormalizedProfileSettingsValues(record: Record<string, unknown>) {
  return {
    locale: String(record.locale || "")
      .trim()
      .toLowerCase(),
    theme: String(record.theme || "")
      .trim()
      .toLowerCase(),
    llm: String(record.llm || "").trim(),
    imageLlm: String(record.imageLlm || "").trim(),
  };
}

function hasValidProfileSettingsValues({
  locale,
  theme,
  llm,
  imageLlm,
}: ReturnType<typeof getNormalizedProfileSettingsValues>): boolean {
  return (
    SUPPORTED_LOCALES.has(locale) &&
    isProfileThemeValue(theme) &&
    isProfileLlmValue(llm) &&
    (!imageLlm || isProfileImageLlmValue(imageLlm))
  );
}

function normalizeFullnameValue(value: unknown): string | null | undefined {
  if (value !== null && value !== undefined && typeof value !== "string") {
    return undefined;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeProfileSettingsPayload(
  payload: unknown,
): ProfileSettingsPayload | null {
  if (!isProfileSettingsRecord(payload)) {
    return null;
  }

  const values = getNormalizedProfileSettingsValues(payload);
  const fullname = normalizeFullnameValue(payload.fullname);
  if (!hasValidProfileSettingsValues(values) || fullname === undefined) {
    return null;
  }

  return {
    locale: values.locale,
    theme: values.theme || DEFAULT_PROFILE_THEME,
    llm: values.llm || DEFAULT_PROFILE_LLM,
    imageLlm: values.imageLlm || DEFAULT_PROFILE_IMAGE_LLM,
    fullname,
  };
}

export function toProfileResponse(profile) {
  if (!profile || typeof profile !== "object") {
    return profile || null;
  }

  const { imageLlm, ...rest } = profile;
  return {
    ...rest,
    imageLlm:
      typeof imageLlm === "string" && imageLlm.trim()
        ? imageLlm.trim()
        : DEFAULT_PROFILE_IMAGE_LLM,
  };
}
