import type { Lang } from './format';
import type { PageHead } from './pageHead';

export interface StaticLink {
  href: string;
  label: string;
  /** Set when the link leads to a page in another language. */
  lang?: Lang;
}

export interface StaticSection {
  heading: string;
  links: StaticLink[];
}

/**
 * One page as plain HTML, for search engines and readers without scripts. The app replaces the body
 * when it mounts, so the body says nothing the app does not.
 */
export interface StaticPage {
  lang: Lang;
  head: PageHead;
  canonical: string;
  nav: { label: string; links: StaticLink[] };
  sections: StaticSection[];
}

/** Wraps the plain body. A browser that runs scripts hides it until the app replaces it (styles/base.css). */
export const STATIC_PAGE_CLASS = 'static-page';

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const link = ({ href, label, lang }: StaticLink) =>
  `<a href="${escapeHtml(href)}"${lang ? ` hreflang="${lang}" lang="${lang}"` : ''}>${escapeHtml(label)}</a>`;

const list = (links: readonly StaticLink[]) =>
  `<ul>${links.map((l) => `<li>${link(l)}</li>`).join('')}</ul>`;

function body(page: StaticPage): string {
  const sections = page.sections
    .filter((s) => s.links.length > 0)
    .map((s) => `<section><h2>${escapeHtml(s.heading)}</h2>${list(s.links)}</section>`);
  return [
    `<div class="${STATIC_PAGE_CLASS}">`,
    `<nav aria-label="${escapeHtml(page.nav.label)}">${list(page.nav.links)}</nav>`,
    '<main>',
    `<h1>${escapeHtml(page.head.heading)}</h1>`,
    `<p>${escapeHtml(page.head.description)}</p>`,
    ...sections,
    '</main>',
    '</div>',
  ].join('');
}

/** Replaces the one match of `pattern` in `html`; a template without exactly one match is refused. */
function replaceOnce(html: string, pattern: RegExp, replacement: string, what: string): string {
  const matches = html.match(new RegExp(pattern.source, `${pattern.flags}g`))?.length ?? 0;
  if (matches !== 1)
    throw new Error(`The page template needs exactly one ${what}, found ${matches}`);
  // A function keeps `$` in the replacement literal.
  return html.replace(pattern, () => replacement);
}

/** The built index.html with the page's language, title, description, canonical link and body. */
export function renderStaticPage(template: string, page: StaticPage): string {
  const { head } = page;
  let html = replaceOnce(
    template,
    /<html lang="[^"]*">/,
    `<html lang="${page.lang}">`,
    '<html lang>',
  );
  html = replaceOnce(
    html,
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(head.title)}</title>`,
    '<title>',
  );
  html = replaceOnce(
    html,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(head.description)}" />`,
    'description',
  );
  html = replaceOnce(
    html,
    /<\/head>/,
    `  <link rel="canonical" href="${escapeHtml(page.canonical)}" />\n  </head>`,
    '</head>',
  );
  return replaceOnce(html, /<div id="root"><\/div>/, `<div id="root">${body(page)}</div>`, 'root');
}
