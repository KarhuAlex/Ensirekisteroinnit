import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildRobots,
  buildSitemap,
  emptySitemap,
  headTags,
  LANGS,
  normalizeBase,
  OG_IMAGE,
  PAGES,
  pagePaths,
  releaseDay,
  sitemapEntityIds,
  withHeadTags,
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

describe('sitemap lastmod', () => {
  it('dates every page with the day of the release when it is known', () => {
    const xml = buildSitemap('https://example.org', ['', '/about'], '2026-11-09');
    expect(xml.split('<lastmod>2026-11-09</lastmod>')).toHaveLength(5);
  });

  it('leaves the date out when it is not known', () => {
    expect(buildSitemap('https://example.org', [''])).not.toContain('lastmod');
  });
});

describe('releaseDay', () => {
  it('takes the day of a release timestamp and nothing from anything else', () => {
    expect(releaseDay('2026-11-09T11:05:41.531Z')).toBe('2026-11-09');
    expect(releaseDay('yesterday')).toBeUndefined();
    expect(releaseDay(undefined)).toBeUndefined();
  });
});

const PAGE = `<!doctype html><html lang="fi"><head>
    <title>Kauppa-sivusto | esimerkki</title>
    <meta name="application-name" content="Kauppa &amp; Kumppanit" />
    <meta name="description" content="Kuvaus &amp; lisää" />
  </head><body></body></html>`;

describe('headTags', () => {
  const tags = headTags('https://example.org', PAGE);

  it('takes the title, description and site name from the page, as written', () => {
    expect(tags).toContain('property="og:title" content="Kauppa-sivusto | esimerkki"');
    expect(tags).toContain('property="og:description" content="Kuvaus &amp; lisää"');
    expect(tags).toContain('property="og:site_name" content="Kauppa &amp; Kumppanit"');
  });

  it('gives the share image a size and a description', () => {
    expect(tags).toContain(`property="og:image:width" content="${OG_IMAGE.width}"`);
    expect(tags).toContain(`property="og:image:height" content="${OG_IMAGE.height}"`);
    expect(tags).toContain(`property="og:image:alt" content="${OG_IMAGE.alt}"`);
  });

  it('points the image at the site address', () => {
    expect(tags).toContain('property="og:image" content="https://example.org/og.png"');
    expect(tags).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('describes the site and its data as JSON-LD that cannot close its script tag', () => {
    const start = tags.indexOf('>', tags.indexOf('application/ld+json')) + 1;
    const json = tags.slice(start, tags.indexOf('</script>', start));
    const data = JSON.parse(json);
    expect(data['@graph'].map((n: { '@type': string }) => n['@type'])).toEqual([
      'WebSite',
      'Dataset',
    ]);
    expect(data['@graph'][1].license).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(json).not.toContain('</');
  });

  it('writes characters, not character references, into the structured data', () => {
    const json = tags.slice(tags.indexOf('application/ld+json'));
    expect(json).toContain('"name":"Kauppa & Kumppanit"');
    expect(json).toContain('"description":"Kuvaus & lisää"');
    expect(json).not.toContain('&amp;');
  });

  it('refuses a page without a title, description or site name', () => {
    expect(() => headTags('https://example.org', '<html></html>')).toThrow();
    const noName = PAGE.replace(/<meta name="application-name"[^>]*>/, '');
    expect(() => headTags('https://example.org', noName)).toThrow(/application-name/);
  });
});

describe('withHeadTags', () => {
  it('adds the tags before the end of the head, once', () => {
    const once = withHeadTags(PAGE, 'https://example.org');
    expect(once.indexOf('og:type')).toBeLessThan(once.indexOf('</head>'));
    expect(withHeadTags(once, 'https://example.org')).toBe(once);
  });
});

describe('the share image', () => {
  it('has the size the tags declare', () => {
    // A PNG starts with an 8 byte signature and the header chunk, whose width and height follow.
    const png = readFileSync(new URL(`../public${OG_IMAGE.path}`, import.meta.url));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([OG_IMAGE.width, OG_IMAGE.height]);
  });
});
