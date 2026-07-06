import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultLocale, isSupportedLocale, normalizeLocale } from "./index";

const STORAGE_KEY = "locale";

type LocaleValue = "en" | "ru";

type LocaleContextValue = {
  locale: string;
  setLocale: (nextLocale: string) => void;
};

type LocaleProviderProps = {
  children: ReactNode;
};

const noopSetLocale: LocaleContextValue["setLocale"] = () => {};

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: noopSetLocale,
});

function readStoredLocale(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredLocale(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Locale persistence is optional; keep the in-memory state.
  }
}

const getInitialLocale = (): LocaleValue => {
  if (typeof window === "undefined") {
    return defaultLocale as LocaleValue;
  }

  const stored = readStoredLocale();
  if (stored && isSupportedLocale(stored)) {
    return stored as LocaleValue;
  }

  const browserLocale =
    window.navigator.language || window.navigator.languages?.[0];
  const normalized = normalizeLocale(browserLocale);
  if (isSupportedLocale(normalized)) {
    return normalized as LocaleValue;
  }

  return defaultLocale as LocaleValue;
};

function LocaleProvider({ children }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<string>(getInitialLocale);

  const setLocale = useCallback((nextLocale: string) => {
    const normalized = normalizeLocale(nextLocale);
    const value = isSupportedLocale(normalized) ? normalized : defaultLocale;
    setLocaleState(value);
    if (typeof window !== "undefined") {
      writeStoredLocale(value);
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

export { LocaleProvider, useLocale };
