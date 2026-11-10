export const LANGS = ['fi', 'en'];
export const DEFAULT_LANG = 'fi';

/** Public pages under each language prefix. A test keeps this list in step with the router. */
export const PAGES = ['', '/review', '/models', '/table', '/about'];

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
  return entities.filter((e) => e.kind !== 'total' && e.last12 > 0).map((e) => e.id);
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

function urlEntry(base, lang, path) {
  return [
    '  <url>',
    `    <loc>${escapeXml(hrefOf(base, lang, path))}</loc>`,
    ...alternateLinks(base, path),
    '  </url>',
  ].join('\n');
}

/** One entry per language and page. */
export function buildSitemap(base, paths) {
  const entries = paths.flatMap((path) => LANGS.map((lang) => urlEntry(base, lang, path)));
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
