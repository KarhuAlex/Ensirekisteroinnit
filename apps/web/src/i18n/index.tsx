import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { makeFormatters, type Formatters, type Lang } from '../lib/format';
import { en } from './en';
import { fi, type MessageKey } from './fi';

export type { Lang, MessageKey };

const dictionaries: Record<Lang, Record<MessageKey, string>> = { fi, en };

export type Params = Record<string, string | number>;

export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const template = dictionaries[lang][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function isLang(value: string | undefined): value is Lang {
  return value === 'fi' || value === 'en';
}

export function detectLang(): Lang {
  const preferred = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  return preferred.startsWith('fi') ? 'fi' : 'en';
}

interface I18n {
  lang: Lang;
  t: (key: MessageKey, params?: Params) => string;
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
