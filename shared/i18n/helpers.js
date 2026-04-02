import en from "./en.js";
import ru from "./ru.js";

const dictionaries = { en, ru };
const defaultLocale = "en";
const supportedLocales = ["en", "ru"];

function normalizeLocale(value = "") {
  return value.toLowerCase().split("-")[0];
}

function isSupportedLocale(value) {
  return supportedLocales.includes(value);
}

function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

function resolveTranslationValue(dictionary, key) {
  if (!dictionary || typeof dictionary !== "object" || typeof key !== "string" || key.length === 0) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
    return dictionary[key];
  }

  const segments = key.split(".");
  let current = dictionary;
  let index = 0;

  while (current && typeof current === "object" && index < segments.length) {
    let matched = false;

    for (let end = segments.length; end > index; end -= 1) {
      const candidate = segments.slice(index, end).join(".");
      if (!Object.prototype.hasOwnProperty.call(current, candidate)) {
        continue;
      }

      current = current[candidate];
      index = end;
      matched = true;
      break;
    }

    if (!matched) {
      return undefined;
    }
  }

  return index === segments.length ? current : undefined;
}

function t(key, params, locale = defaultLocale) {
  const dictionary = dictionaries[locale] || dictionaries[defaultLocale];
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

function translateOption(group, value, locale = defaultLocale) {
  const key = `options.${group}.${value}`;
  const translated = t(key, undefined, locale);
  return translated === key ? humanizeOptionValue(value) : translated;
}

export { t, translateOption, defaultLocale, supportedLocales, normalizeLocale, isSupportedLocale, resolveTranslationValue };
