import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { defaultLocale, isSupportedLocale, normalizeLocale } from "./index.js";

const STORAGE_KEY = "locale";

const LocaleContext = createContext({
  locale: defaultLocale,
  setLocale: () => {}
});

const getInitialLocale = () => {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && isSupportedLocale(stored)) {
    return stored;
  }

  const browserLocale = window.navigator.language || window.navigator.languages?.[0];
  const normalized = normalizeLocale(browserLocale);
  if (isSupportedLocale(normalized)) {
    return normalized;
  }

  return defaultLocale;
};

function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  const setLocale = useCallback((nextLocale) => {
    const normalized = normalizeLocale(nextLocale);
    const value = isSupportedLocale(normalized) ? normalized : defaultLocale;
    setLocaleState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocale() {
  return useContext(LocaleContext);
}

export { LocaleProvider, useLocale };
