import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildRobots,
  buildSitemap,
  emptySitemap,
  LANGS,
  normalizeBase,
  PAGES,
  pagePaths,
  sitemapEntityIds,
} from '../scripts/seo.mjs';

describe('normalizeBase', () => {
  it('keeps only the origin', () => {
    expect(normalizeBase('https://example.org/')).toBe('https://example.org');
    expect(normalizeBase('https://example.org/some/path?x=1')).toBe('https://example.org');
  });

  it('refuses addresses that are not http or https', () => {
    expect(() => normalizeBase('ftp://example.org')).toThrow();
    expect(() => normalizeBase('not an address')).toThrow();
  });
});

describe('pagePaths', () => {
  it('adds a page for each make and model, with the id made safe for a URL', () => {
    expect(pagePaths(['audi-a4', 'a b'])).toEqual([...PAGES, '/models/audi-a4', '/models/a%20b']);
  });
});

describe('buildSitemap', () => {
  const xml = buildSitemap('https://example.org', ['', '/about']);

  it('lists every page in every language', () => {
    for (const lang of LANGS) {
      expect(xml).toContain(`<loc>https://example.org/${lang}</loc>`);
      expect(xml).toContain(`<loc>https://example.org/${lang}/about</loc>`);
    }
  });

  it('points each page at its translations and a default', () => {
    expect(xml).toContain('hreflang="en" href="https://example.org/en/about"');
    expect(xml).toContain('hreflang="x-default" href="https://example.org/fi/about"');
  });

  it('is well-formed XML with the sitemap namespace', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('escapes characters that XML reserves', () => {
    expect(buildSitemap('https://example.org', ['/a&b'])).toContain('/fi/a&#38;b');
  });
});

describe('buildRobots', () => {
  it('points at the sitemap when the site address is known', () => {
    expect(buildRobots('https://example.org')).toContain(
      'Sitemap: https://example.org/sitemap.xml',
    );
  });

  it('still allows crawling without a site address', () => {
    const robots = buildRobots(null);
    expect(robots).toContain('Allow: /');
    expect(robots).not.toContain('Sitemap');
  });
});

describe('sitemapEntityIds', () => {
  const entities = [
    { id: 'total', kind: 'total', last12: 900 },
    { id: 'audi', kind: 'make', last12: 50 },
    { id: 'old-model', kind: 'model', last12: 0 },
    { id: 'cg-vag', kind: 'corporategroup', last12: 80 },
  ];

  it('lists makes and models with recent registrations only, never corporate groups', () => {
    expect(sitemapEntityIds(entities)).toEqual(['audi']);
  });
});

describe('emptySitemap', () => {
  it('is valid XML without any page', () => {
    const xml = emptySitemap();
    expect(xml).toContain('<urlset');
    expect(xml).not.toContain('<url>');
  });
});

describe('page list', () => {
  it('matches the routes the app declares', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const declared = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));
    for (const page of PAGES.filter((p) => p !== '')) {
      expect(declared.has(page.slice(1))).toBe(true);
    }
    expect(declared.has('models/:id')).toBe(true);
  });
});
