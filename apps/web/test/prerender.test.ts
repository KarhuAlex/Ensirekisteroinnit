import type { EntitySummary, Manifest } from '@regs/core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES } from '../scripts/seo.mjs';
import { PAGE_ROUTES, prerenderPages, type PrerenderedPage } from '../src/prerender';

const TEMPLATE = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const manifest = { months: ['2026-09', '2026-10'], latestMonth: '2026-10' } as Manifest;

const summary = (over: Partial<EntitySummary> & Pick<EntitySummary, 'id'>): EntitySummary => ({
  label: over.id.toUpperCase(),
  kind: 'model',
  total: 10,
  last12: 10,
  bevLast12: 0,
  ...over,
});

const entities: EntitySummary[] = [
  summary({ id: 'total', kind: 'total', label: 'TOTAL', last12: 999 }),
  summary({ id: 'audi', kind: 'make', label: 'AUDI', last12: 50 }),
  summary({ id: 'audi-a4', makeId: 'audi', label: 'AUDI A4', last12: 20 }),
  summary({ id: 'audi-q4', makeId: 'audi', label: 'AUDI Q4 E-TRON', last12: 30, bevLast12: 30 }),
  summary({ id: 'audi-80', makeId: 'audi', label: 'AUDI 80', last12: 0 }),
  summary({ id: 'vag', kind: 'corporategroup', label: 'VAG', last12: 500 }),
];

const pages = prerenderPages({
  template: TEMPLATE,
  base: 'https://example.org',
  manifest,
  entities,
});
const page = (path: string): PrerenderedPage => {
  const found = pages.find((p) => p.path === path);
  if (!found) throw new Error(`No page ${path}`);
  return found;
};
const titleOf = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1];

describe('prerenderPages', () => {
  it('has a route for every fixed page in the sitemap', () => {
    expect(Object.keys(PAGE_ROUTES).sort()).toEqual([...PAGES].sort());
  });

  it('writes every fixed page and every make and model page in both languages, and only those', () => {
    const models = ['audi', 'audi-a4', 'audi-q4', 'audi-80'].map((id) => `/models/${id}`);
    const expected = ['fi', 'en'].flatMap((lang) =>
      [...PAGES, ...models].map((path) => `/${lang}${path}`),
    );
    expect(pages.map((p) => p.path).sort()).toEqual(expected.sort());
  });

  it('gives every page a title of its own', () => {
    const titles = pages.map((p) => titleOf(p.html));
    expect(new Set(titles).size).toBe(pages.length);
  });

  it('points each page at itself as canonical', () => {
    expect(page('/en/models/audi').html).toContain(
      '<link rel="canonical" href="https://example.org/en/models/audi" />',
    );
    expect(page('/fi').html).toContain('<link rel="canonical" href="https://example.org/fi" />');
  });

  it('marks only the front pages as standing for the whole site', () => {
    expect(pages.filter((p) => p.home).map((p) => p.path)).toEqual(['/fi', '/en']);
  });

  it('shows the latest month in the review title, as the review opens on it', () => {
    expect(titleOf(page('/fi/review').html)).toBe(
      'Eniten ensirekisteröidyt mallit, lokakuu 2026 – Ensirekisteröinnit',
    );
  });

  it('links the makes and models list to every make and model page, most registered first', () => {
    const html = page('/fi/models').html;
    const links = [...html.matchAll(/href="\/fi\/models\/([^"]+)"/g)].map((m) => m[1]);
    expect(links).toEqual(['audi', 'audi-q4', 'audi-a4']);
  });

  it('keeps a page file for a model that has left the sitemap, so no old one is left behind', () => {
    expect(titleOf(page('/fi/models/audi-80').html)).toBe('Audi 80 – Ensirekisteröinnit');
  });

  it('links a make to its models and a model to its make', () => {
    expect(page('/fi/models/audi').html).toContain('<a href="/fi/models/audi-a4">Audi A4</a>');
    expect(page('/fi/models/audi').html).toContain('<a href="/fi/models/audi-80">Audi 80</a>');
    expect(page('/en/models/audi-a4').html).toContain('<a href="/en/models/audi">Audi</a>');
  });

  it('links each page to the same page in the other language', () => {
    expect(page('/fi/models/audi').html).toContain(
      '<a href="/en/models/audi" hreflang="en" lang="en">English</a>',
    );
  });

  it('writes the page in its own language', () => {
    expect(page('/en/about').html).toContain('<html lang="en">');
    expect(page('/fi/about').html).toContain('<html lang="fi">');
  });
});
