import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Language = 'en' | 'pl';
export const LANGUAGE_KEY = 'learnmd-language';
export function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'en' || saved === 'pl') return saved;
  } catch {
    /* Language remains available when browser storage is restricted. */
  }
  return (navigator.languages?.[0] || navigator.language || 'en')
    .toLowerCase()
    .startsWith('pl')
    ? 'pl'
    : 'en';
}

const englishFallback = {
  language: 'en' as Language,
  setLanguage: (_language: Language) => {},
  t: (english: string, _polish: string) => english,
};
const I18nContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (english: string, polish: string) => string;
}>(englishFallback);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(initialLanguage);
  const setLanguage = useCallback((next: Language) => {
    if (next !== 'en' && next !== 'pl') return;
    updateLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      /* Keep the explicit choice for this session. */
    }
  }, []);
  const t = useCallback(
    (english: string, polish: string) => (language === 'pl' ? polish : english),
    [language],
  );
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
