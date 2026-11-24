import type { Path } from 'react-router-dom';
import { DEFAULT_LANG } from '../i18n/translate';

/**
 * The same page in the default language, for an address without a language prefix: `/models/audi`
 * opens `/fi/models/audi`, and a page that does not exist shows the not-found page.
 */
export function withDefaultLang({ pathname, search, hash }: Path): string {
  const path = pathname === '/' ? '' : pathname;
  return `/${DEFAULT_LANG}${path}${search}${hash}`;
}
