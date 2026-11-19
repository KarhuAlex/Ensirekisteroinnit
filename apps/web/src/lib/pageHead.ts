import type { EntitySummary } from '@regs/core';
import type { Translate } from '../i18n/translate';
import type { Formatters } from './format';
import { displayName } from './names';
import { modelStory, type ModelStory } from './stats';

/** The translator and formatters that head text is written with. */
export interface PageText {
  t: Translate;
  fmt: Formatters;
}

/** A page whose head text is fixed. */
export type FixedPage =
  | 'overview'
  | 'models'
  | 'compare'
  | 'stock'
  | 'forecast'
  | 'table'
  | 'about'
  | 'notFound'
  | 'modelNotFound';

/** The page a head is for, with whatever its text depends on. */
export type HeadRoute =
  | { page: FixedPage }
  | { page: 'review'; headline: string }
  | { page: 'model'; entity: EntitySummary };

/**
 * The text a page shows to search engines and in the browser tab. The app sets it while the page
 * runs, and the build writes the same text into each page's HTML, so both always agree.
 */
export interface PageHead {
  title: string;
  description: string;
  heading: string;
}

/** The name of a make or model as headings show it; the total has a name of its own. */
export function entityName(t: Translate, entity: Pick<EntitySummary, 'kind' | 'label'>): string {
  return entity.kind === 'total' ? t('entity.total') : displayName(entity.label);
}

/** One sentence on the last 12 months of a make or model. */
export function modelStoryText({ t, fmt }: PageText, story: ModelStory): string {
  switch (story.kind) {
    case 'none':
      return t('story.model.none');
    case 'all-electric':
      return t('story.model.all', { n: fmt.int(story.count) });
    case 'mixed':
      return t('story.model.mixed', { n: fmt.int(story.count), share: fmt.pct(story.bevShare) });
  }
}

/**
 * The sentence on the last 12 months of a make or model, from the release's summary of it. The page
 * and its description both use this, so they never give different numbers.
 */
export function entityStoryText(text: PageText, entity: EntitySummary): string {
  return modelStoryText(text, modelStory(entity.last12, entity.bevLast12));
}

function fixedHead(t: Translate, page: FixedPage): { heading: string; description: string } {
  const description = t('meta.description');
  switch (page) {
    case 'overview':
      return { heading: t('app.title'), description };
    case 'models':
      return { heading: t('models.title'), description: t('meta.models') };
    case 'compare':
      return { heading: t('compare.title'), description: t('meta.compare') };
    case 'stock':
      return { heading: t('fleet.title'), description: t('meta.stock') };
    case 'forecast':
      return { heading: t('forecast.title'), description: t('meta.forecast') };
    case 'table':
      return { heading: t('table.title'), description: t('meta.table') };
    case 'about':
      return { heading: t('about.title'), description: t('meta.about') };
    case 'notFound':
      return { heading: t('notfound.title'), description };
    case 'modelNotFound':
      return { heading: t('model.notFound'), description };
  }
}

const withSite = (t: Translate, heading: string) => `${heading} – ${t('app.title')}`;

export function pageHead(route: HeadRoute, text: PageText): PageHead {
  const { t } = text;
  switch (route.page) {
    case 'review':
      return {
        title: withSite(t, route.headline),
        description: t('meta.review'),
        heading: route.headline,
      };
    case 'model': {
      const { entity } = route;
      const name = entityName(t, entity);
      const story = entityStoryText(text, entity);
      return {
        title: withSite(t, name),
        description: t('meta.model', { name, story }),
        heading: name,
      };
    }
    case 'overview':
      return {
        title: `${t('app.title')} – ${t('meta.homeTitle')}`,
        ...fixedHead(t, route.page),
      };
    case 'modelNotFound': {
      // The message is a full sentence, so the title leaves out the site name.
      const head = fixedHead(t, route.page);
      return { title: head.heading, ...head };
    }
    default: {
      const head = fixedHead(t, route.page);
      return { title: withSite(t, head.heading), ...head };
    }
  }
}
