import type { Lang } from '../lib/format';
import { en } from './en';
import { fi, type MessageKey } from './fi';

export type { Lang, MessageKey };

const dictionaries: Record<Lang, Record<MessageKey, string>> = { fi, en };

export type Params = Record<string, string | number>;

export type Translate = (key: MessageKey, params?: Params) => string;

export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const template = dictionaries[lang][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function isLang(value: string | undefined): value is Lang {
  return value === 'fi' || value === 'en';
}
