import type { EntitySummary, Manifest } from '@regs/core';
import { LANGS, modelPagePath, PAGES, sitemapEntityIds } from '../scripts/seo.mjs';
import { translate, type Translate } from './i18n/translate';
import { canonicalHref } from './lib/canonical';
import { isListed } from './lib/entityLevel';
import { makeFormatters, type Lang } from './lib/format';
import {
  entityName,
  pageHead,
  type FixedPage,
  type HeadRoute,
  type PageText,
} from './lib/pageHead';
import { rangeLabel, reviewHeadline } from './lib/reviewHeadline';
import { defaultState } from './lib/reviewState';
import { renderStaticPage, type StaticLink, type StaticSection } from './lib/staticPage';

/**
 * Build-time entry: one HTML file for every fixed page and every make and model page, each with its
 * own title, description, canonical link and a plain body of headings and links. `vite build --ssr`
 * bundles it for Node, and scripts/write-seo-files.mjs runs it.
 *
 * Makes and models outside the sitemap get a file too, so a model that stops selling is rewritten
 * with each deploy instead of keeping the file from the last deploy that listed it.
 */

/** The route of each fixed page. A test keeps this in step with the sitemap's pages. */
export const PAGE_ROUTES: Readonly<Record<string, FixedPage | 'review'>> = {
  '': 'overview',
  '/review': 'review',
  '/models': 'models',
  '/compare': 'compare',
  '/stock': 'stock',
  '/forecast': 'forecast',
  '/table': 'table',
  '/about': 'about',
};

export interface PrerenderInput {
  /** The built index.html, before any per-site tags are added. */
  template: string;
  /** The site's origin, without a trailing slash. */
  base: string;
  manifest: Manifest;
  entities: EntitySummary[];
}

export interface PrerenderedPage {
  /** The address of the page, such as `/fi/models/audi`. */
  path: string;
  /** A language's front page, which also describes the site as a whole. */
  home: boolean;
  html: string;
}

interface Context {
  lang: Lang;
  text: PageText;
  input: PrerenderInput;
  /** The makes and models in the sitemap, most registered first. */
  sitemapped: readonly EntitySummary[];
  /** Every make and model with a page, most registered first. */
  withPages: readonly EntitySummary[];
}

const entityLinks = ({ lang, text }: Context, entities: readonly EntitySummary[]): StaticLink[] =>
  entities.map((e) => ({ href: `/${lang}${modelPagePath(e.id)}`, label: entityName(text.t, e) }));

function reviewRoute({ text, input }: Context): HeadRoute {
  const { months } = input.manifest;
  const state = defaultState(months.length);
  const { label } = rangeLabel(text.t, text.fmt, months, state.range);
  return { page: 'review', headline: reviewHeadline(text.t, state, undefined, label) };
}

/** The links a page offers beyond the navigation, so every make and model can be reached. */
function sections(ctx: Context, route: HeadRoute): StaticSection[] {
  const { t } = ctx.text;
  if (route.page === 'models') {
    return [{ heading: t('models.caption'), links: entityLinks(ctx, ctx.sitemapped) }];
  }
  if (route.page !== 'model') return [];
  const { entity } = route;
  if (entity.kind === 'make') {
    const models = ctx.withPages.filter((e) => e.makeId === entity.id);
    return [{ heading: t('meta.linksModels'), links: entityLinks(ctx, models) }];
  }
  const make = ctx.withPages.find((e) => e.id === entity.makeId);
  return make ? [{ heading: t('meta.linksMake'), links: entityLinks(ctx, [make]) }] : [];
}

function render(ctx: Context, path: string, route: HeadRoute): PrerenderedPage {
  const { lang, text, input } = ctx;
  const { t } = text;
  const address = `/${lang}${path}`;
  const other: Lang = lang === 'fi' ? 'en' : 'fi';
  const html = renderStaticPage(input.template, {
    lang,
    head: pageHead(route, text),
    canonical: canonicalHref(input.base, address) ?? address,
    nav: {
      label: t('nav.main'),
      links: [
        { href: `/${lang}`, label: t('app.title') },
        { href: `/${lang}/models`, label: t('nav.models') },
        { href: `/${other}${path}`, label: t('lang.switch'), lang: other },
      ],
    },
    sections: sections(ctx, route),
  });
  return { path: address, home: path === '', html };
}

export function prerenderPages(input: PrerenderInput): PrerenderedPage[] {
  const withPages = input.entities
    .filter((e) => isListed(e.kind))
    .sort((a, b) => b.last12 - a.last12);
  const sitemapIds = new Set(sitemapEntityIds(input.entities));
  const sitemapped = withPages.filter((e) => sitemapIds.has(e.id));

  return LANGS.flatMap((lang) => {
    const t: Translate = (key, params) => translate(lang, key, params);
    const ctx: Context = {
      lang,
      text: { t, fmt: makeFormatters(lang) },
      input,
      sitemapped,
      withPages,
    };
    const fixed = PAGES.map((path) => {
      const page = PAGE_ROUTES[path];
      if (!page) throw new Error(`No route for the sitemap page "${path}"`);
      return render(ctx, path, page === 'review' ? reviewRoute(ctx) : { page });
    });
    const models = withPages.map((entity) =>
      render(ctx, modelPagePath(entity.id), { page: 'model', entity }),
    );
    return [...fixed, ...models];
  });
}
