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

function t(key, params, locale = defaultLocale) {
  const dictionary = dictionaries[locale] || dictionaries[defaultLocale];
  const value = key.split(".").reduce((acc, part) => acc?.[part], dictionary);
  if (typeof value === "string") {
    return params ? interpolate(value, params) : value;
  }
  return key;
}

export { t, defaultLocale, supportedLocales, normalizeLocale, isSupportedLocale };
