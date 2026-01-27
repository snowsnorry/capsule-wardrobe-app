import { useCallback } from "react";
import { t as translate, supportedLocales } from "./index.js";
import { useLocale } from "./LocaleProvider.jsx";

function useI18n() {
  const { locale, setLocale } = useLocale();
  const t = useCallback((key, params) => translate(key, params, locale), [locale]);

  return { locale, setLocale, supportedLocales, t };
}

export { useI18n };
