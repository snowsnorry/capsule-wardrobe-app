import en from "./en.js";
import ru from "./ru.js";
import { normalizeColorSwatchKey } from "../colorSwatches.js";

const dictionaries = { en, ru };
const defaultLocale = "en";
const supportedLocales = ["en", "ru"];
type Locale = keyof typeof dictionaries;
type TranslationParams = Record<string, unknown>;
type TranslationDictionary = Record<string, unknown>;

function normalizeLocale(value = ""): string {
  return value.toLowerCase().split("-")[0];
}

function isSupportedLocale(value: string): value is Locale {
  return supportedLocales.includes(value);
}

function interpolate(template: string, params: TranslationParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

function resolveNextTranslationSegment(
  dictionary: TranslationDictionary,
  segments: readonly string[],
  startIndex: number
): { value: unknown; nextIndex: number } | null {
  for (let end = segments.length; end > startIndex; end -= 1) {
    const candidate = segments.slice(startIndex, end).join(".");
    if (Object.prototype.hasOwnProperty.call(dictionary, candidate)) {
      return { value: dictionary[candidate], nextIndex: end };
    }
  }

  return null;
}

function resolveTranslationValue(dictionary: unknown, key: string): unknown {
  if (!dictionary || typeof dictionary !== "object" || typeof key !== "string" || key.length === 0) {
    return undefined;
  }

  const root = dictionary as TranslationDictionary;
  if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
    return root[key];
  }

  const segments = key.split(".");
  let current: unknown = root;
  let index = 0;

  while (current && typeof current === "object" && index < segments.length) {
    const match = resolveNextTranslationSegment(current as TranslationDictionary, segments, index);
    if (!match) {
      return undefined;
    }
    current = match.value;
    index = match.nextIndex;
  }

  return index === segments.length ? current : undefined;
}

function t(key: string, params?: TranslationParams, locale: string = defaultLocale): string {
  const dictionary = isSupportedLocale(locale) ? dictionaries[locale] : dictionaries[defaultLocale];
  const value = resolveTranslationValue(dictionary, key);
  if (typeof value === "string") {
    return params ? interpolate(value, params) : value;
  }
  return key;
}

function humanizeOptionValue(value = "") {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function translateOption(group: string, value: string, locale: string = defaultLocale): string {
  const key = `options.${group}.${value}`;
  const translated = t(key, undefined, locale);
  if (translated !== key) {
    return translated;
  }

  if (group === "accentColors") {
    const normalizedValue = normalizeColorSwatchKey(value);
    const normalizedKey = `options.${group}.${normalizedValue}`;
    const normalizedTranslated = t(normalizedKey, undefined, locale);
    if (normalizedTranslated !== normalizedKey) {
      return normalizedTranslated;
    }
  }

  return humanizeOptionValue(value);
}

export { t, translateOption, defaultLocale, supportedLocales, normalizeLocale, isSupportedLocale, resolveTranslationValue };
