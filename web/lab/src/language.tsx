import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'en' | 'sv';
const KEY = 'bizzjev.language';

function storedLanguage(): Language {
  try { return localStorage.getItem(KEY) === 'sv' ? 'sv' : 'en'; }
  catch { return 'en'; }
}

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({
  language: 'en', setLanguage: () => undefined
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(storedLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'sv' ? 'BizzJev · Semantiskt verksamhetslabb' : 'Semantic Operations Lab';
    try { localStorage.setItem(KEY, language); } catch { /* private browsing */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return <label className="language-switch">
    <span>{language === 'sv' ? 'Språk' : 'Language'}</span>
    <select aria-label={language === 'sv' ? 'Välj språk' : 'Choose language'} value={language}
      onChange={e => setLanguage(e.target.value as Language)}>
      <option value="en">English</option><option value="sv">Svenska</option>
    </select>
  </label>;
}

export function localized<T>(language: Language, english: T, swedish: T): T {
  return language === 'sv' ? swedish : english;
}
