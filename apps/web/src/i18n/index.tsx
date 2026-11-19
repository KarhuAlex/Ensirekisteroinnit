import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { makeFormatters, type Formatters } from '../lib/format';
import { translate, type Lang, type MessageKey, type Translate } from './translate';

export type { Lang, MessageKey, Translate };
export { isLang, translate, type Params } from './translate';

export function detectLang(): Lang {
  const preferred = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  return preferred.startsWith('fi') ? 'fi' : 'en';
}

interface I18n {
  lang: Lang;
  t: Translate;
  fmt: Formatters;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<I18n>(
    () => ({ lang, t: (key, params) => translate(lang, key, params), fmt: makeFormatters(lang) }),
    [lang],
  );
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
