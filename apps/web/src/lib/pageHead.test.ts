import type { EntitySummary } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { translate, type Translate } from '../i18n/translate';
import { makeFormatters, NBSP, type Lang } from './format';
import { pageHead, type FixedPage, type PageText } from './pageHead';

const textOf = (lang: Lang): PageText => {
  const t: Translate = (key, params) => translate(lang, key, params);
  return { t, fmt: makeFormatters(lang) };
};
const fi = textOf('fi');
const en = textOf('en');

const entity = (over: Partial<EntitySummary>): EntitySummary => ({
  id: 'x',
  label: 'X',
  kind: 'model',
  total: 0,
  last12: 0,
  bevLast12: 0,
  ...over,
});

const FIXED: FixedPage[] = [
  'overview',
  'models',
  'compare',
  'stock',
  'forecast',
  'table',
  'about',
  'notFound',
  'modelNotFound',
];

describe('pageHead', () => {
  it('names the site after every page title', () => {
    for (const page of FIXED.filter((p) => p !== 'modelNotFound')) {
      expect(pageHead({ page }, fi).title).toMatch(/Ensirekisteröinnit/);
      expect(pageHead({ page }, en).title).toMatch(/First registrations/);
    }
  });

  it('lets the missing make or model message stand alone as a sentence', () => {
    expect(pageHead({ page: 'modelNotFound' }, fi).title).toBe('Merkkiä tai mallia ei löytynyt.');
  });

  it('gives each page that people search for its own description', () => {
    const searched: FixedPage[] = ['overview', 'models', 'compare', 'stock', 'forecast', 'table'];
    const descriptions = searched.map((page) => pageHead({ page }, fi).description);
    expect(new Set(descriptions).size).toBe(searched.length);
  });

  it('describes the front page with what the site covers', () => {
    expect(pageHead({ page: 'overview' }, fi).title).toBe(
      'Ensirekisteröinnit – henkilöautot ja käyttövoimat Suomessa',
    );
  });

  it('shows the review period in the title and the heading', () => {
    const head = pageHead(
      { page: 'review', headline: 'Eniten ensirekisteröidyt mallit, lokakuu 2026' },
      fi,
    );
    expect(head.heading).toBe('Eniten ensirekisteröidyt mallit, lokakuu 2026');
    expect(head.title).toBe('Eniten ensirekisteröidyt mallit, lokakuu 2026 – Ensirekisteröinnit');
  });

  it('names a model in a readable case and tells its last 12 months', () => {
    const head = pageHead(
      { page: 'model', entity: entity({ label: 'TESLA MODEL Y', last12: 2000, bevLast12: 2000 }) },
      fi,
    );
    expect(head.title).toBe('Tesla Model Y – Ensirekisteröinnit');
    expect(head.description).toBe(
      'Tesla Model Y: ensirekisteröinnit Suomessa kuukausittain ja käyttövoimittain. Viimeisen 12 kuukauden ensirekisteröinnit: 2' +
        NBSP +
        '000, kaikki täyssähköisiä.',
    );
  });

  it('writes the electric share with a comma and a non-breaking space in Finnish', () => {
    const head = pageHead(
      {
        page: 'model',
        entity: entity({ label: 'AUDI', kind: 'make', last12: 1000, bevLast12: 253 }),
      },
      fi,
    );
    expect(head.description).toContain(`25,3${NBSP}%`);
  });

  it('calls the total all passenger cars', () => {
    const head = pageHead({ page: 'model', entity: entity({ kind: 'total', label: 'TOTAL' }) }, en);
    expect(head.heading).toBe('All passenger cars');
  });
});
