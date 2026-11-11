export const LANGS = ['fi', 'en'];
export const DEFAULT_LANG = 'fi';

/** Public pages under each language prefix. A test keeps this list in step with the router. */
export const PAGES = ['', '/review', '/models', '/compare', '/stock', '/table', '/about'];

const escapeXml = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The origin of a site address, without a trailing slash; anything that is not http(s) is refused. */
export function normalizeBase(address) {
  const url = new URL(address);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`SITE_URL must be an http(s) address, got ${address}`);
  }
  return url.origin;
}

/** Only entities with registrations in the last 12 months get a page worth listing. */
export function sitemapEntityIds(entities) {
  return entities
    .filter((e) => e.kind !== 'total' && e.kind !== 'corporategroup' && e.last12 > 0)
    .map((e) => e.id);
}

/** A valid sitemap with no pages, which replaces an old one when the site address is not set. */
export function emptySitemap() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>\n';
}

/** The fixed pages plus one page for each make and model. */
export function pagePaths(entityIds = []) {
  return [...PAGES, ...entityIds.map((id) => `/models/${encodeURIComponent(id)}`)];
}

const hrefOf = (base, lang, path) => `${base}/${lang}${path}`;

/** Links from a page to each of its translations, so search engines pair them. */
function alternateLinks(base, path) {
  const link = (hreflang, lang) =>
    `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(hrefOf(base, lang, path))}"/>`;
  return [...LANGS.map((lang) => link(lang, lang)), link('x-default', DEFAULT_LANG)];
}

function urlEntry(base, lang, path, lastmod) {
  return [
    '  <url>',
    `    <loc>${escapeXml(hrefOf(base, lang, path))}</loc>`,
    ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
    ...alternateLinks(base, path),
    '  </url>',
  ].join('\n');
}

/** One entry per language and page. `lastmod` is the day the data was last published, if known. */
export function buildSitemap(base, paths, lastmod) {
  const entries = paths.flatMap((path) => LANGS.map((lang) => urlEntry(base, lang, path, lastmod)));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

/** Everything may be crawled. The sitemap line is added only when the site address is known. */
export function buildRobots(base) {
  const lines = ['User-agent: *', 'Allow: /'];
  if (base) lines.push('', `Sitemap: ${base}/sitemap.xml`);
  return `${lines.join('\n')}\n`;
}

/** The day of a release timestamp such as `2026-11-09T11:05:41.531Z`, or `undefined` for anything else. */
export function releaseDay(generatedAt) {
  return /^\d{4}-\d{2}-\d{2}/.test(generatedAt ?? '') ? generatedAt.slice(0, 10) : undefined;
}

/** The share image in public/, drawn by og-image.ps1. Its size is written into the tags, so a test checks it. */
export const OG_IMAGE = {
  path: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Käyttövoimien osuudet renkaana ja sivuston nimi',
};

/** JSON-LD sits in a script tag, so a less-than sign is written as an escape that cannot close it. */
const LESS_THAN_ESCAPED = String.fromCharCode(92) + 'u003c';
const LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/';

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** The text of an HTML attribute with its character references turned back into characters. */
function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const hex = name[1].toLowerCase() === 'x';
      const code = hex ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** The `content` of the page's `<meta name="...">` tag, as written in the page. */
const metaContent = (html, name) =>
  new RegExp(String.raw`<meta\s+name="${name}"\s+content="([^"]*)"`).exec(html)?.[1];

/** The title, description and site name the page declares, as written in the page. */
function pageText(html) {
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
  const description = metaContent(html, 'description');
  const siteName = metaContent(html, 'application-name');
  if (!title || !description || !siteName) {
    throw new Error('index.html needs a title, a description and an application-name');
  }
  return { title, description, siteName };
}

/** The site and its data as JSON-LD, with the text as plain characters. */
function structuredData(base, { title, description, siteName }) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: decodeEntities(siteName), url: base, inLanguage: LANGS },
      {
        '@type': 'Dataset',
        name: decodeEntities(title),
        description: decodeEntities(description),
        url: base,
        inLanguage: LANGS,
        license: LICENCE_URL,
        isAccessibleForFree: true,
        spatialCoverage: 'Finland',
      },
    ],
  };
  return JSON.stringify(data).replace(/</g, LESS_THAN_ESCAPED);
}

/**
 * The tags that make a shared link and a search result readable without running the page: Open
 * Graph and Twitter cards, and structured data. The title, the description and the site name come
 * from the page itself, so they are written in one place. Meta tags keep the text as written.
 */
export function headTags(base, html) {
  const text = pageText(html);
  const meta = (attribute, name, content) =>
    '    <meta ' + attribute + '="' + name + '" content="' + content + '" />';
  return [
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', text.siteName),
    meta('property', 'og:title', text.title),
    meta('property', 'og:description', text.description),
    meta('property', 'og:image', escapeXml(base + OG_IMAGE.path)),
    meta('property', 'og:image:width', String(OG_IMAGE.width)),
    meta('property', 'og:image:height', String(OG_IMAGE.height)),
    meta('property', 'og:image:alt', escapeXml(OG_IMAGE.alt)),
    meta('name', 'twitter:card', 'summary_large_image'),
    '    <script type="application/ld+json">' + structuredData(base, text) + '</script>',
  ].join('\n');
}

/** The page with the tags added before the end of its head; a page that already has them is left alone. */
export function withHeadTags(html, base) {
  if (html.includes('property="og:type"')) return html;
  return html.replace('</head>', `${headTags(base, html).trimStart()}\n  </head>`);
}
