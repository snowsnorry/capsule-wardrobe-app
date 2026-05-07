import { useCallback } from "react";
import { t as translate, supportedLocales } from "./index";
import { useLocale } from "./LocaleProvider";

type TranslationParams = Record<string, unknown> | undefined;

type UseI18nResult = {
  locale: string;
  setLocale: (nextLocale: string) => void;
  supportedLocales: string[];
  t: (key: string, params?: TranslationParams) => string;
};

function useI18n(): UseI18nResult {
  const { locale, setLocale } = useLocale();
  const t = useCallback(
    (key, params) => translate(key, params, locale),
    [locale],
  );

  return { locale, setLocale, supportedLocales, t };
}

export { useI18n };
