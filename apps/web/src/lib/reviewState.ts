import { FUEL_GROUP_IDS, type FuelGroupId } from '@regs/core';
import type { EntityLevel } from './entityLevel';
import type { Lang } from './format';
import { rangeOfPeriod } from './period';
import { sameRange, type CompareMode, type MonthRange } from './ranking';

export type Level = EntityLevel | 'area';
export type AreaLevel = 'municipality' | 'region';
export type AreaMetric = 'share' | 'index' | 'count' | 'change';
/** New cars, or cars imported used. */
export type Source = 'new' | 'used';

/** The review page is a function of this, and all of it lives in the URL. */
export interface ReviewState {
  range: MonthRange;
  source: Source;
  level: Level;
  fuels: FuelGroupId[];
  compare: CompareMode;
  areaLevel: AreaLevel;
  areaMetric: AreaMetric;
  /** The make or model whose areas are ranked; `null` means all cars. */
  entity: string | null;
}

const COMPARE_PARAM: Record<CompareMode, string> = {
  none: 'none',
  previous: 'prev',
  yearAgo: 'year',
};
const DEFAULT_COMPARE: CompareMode = 'yearAgo';
const AREA_LEVELS: readonly AreaLevel[] = ['region', 'municipality'];
const AREA_METRICS: readonly AreaMetric[] = ['share', 'index', 'count', 'change'];
const LEVELS: readonly Level[] = ['model', 'make', 'area'];
const SOURCES: readonly Source[] = ['new', 'used'];

const oneOf = <T extends string>(options: readonly T[], value: string | null): T =>
  options.find((option) => option === value) ?? (options[0] as T);

export function defaultState(monthCount: number): ReviewState {
  const last = Math.max(0, monthCount - 1);
  return {
    range: { from: last, to: last },
    source: 'new',
    level: 'model',
    fuels: [...FUEL_GROUP_IDS],
    compare: DEFAULT_COMPARE,
    areaLevel: 'region',
    areaMetric: 'share',
    entity: null,
  };
}

export function parseState(params: URLSearchParams, months: readonly string[]): ReviewState {
  const base = defaultState(months.length);
  const index = (value: string | null) => (value === null ? -1 : months.indexOf(value));

  const from = index(params.get('from'));
  const to = index(params.get('to'));
  let range = base.range;
  if (from >= 0 && to >= 0) range = { from: Math.min(from, to), to: Math.max(from, to) };
  else if (from >= 0) range = { from, to: from };
  else if (to >= 0) range = { from: to, to };

  const wanted = new Set(params.get('fuels')?.split(','));
  const fuels = FUEL_GROUP_IDS.filter((group) => wanted.has(group));

  const cmp = params.get('cmp');
  const compare =
    (Object.keys(COMPARE_PARAM) as CompareMode[]).find((mode) => COMPARE_PARAM[mode] === cmp) ??
    base.compare;

  return {
    range,
    source: oneOf(SOURCES, params.get('source')),
    level: oneOf(LEVELS, params.get('level')),
    fuels: fuels.length > 0 ? [...fuels] : base.fuels,
    compare,
    areaLevel: oneOf(AREA_LEVELS, params.get('by')),
    areaMetric: oneOf(AREA_METRICS, params.get('metric')),
    entity: params.get('entity') || null,
  };
}

/** Defaults are left out so the plain page keeps a clean URL. */
export function toSearchParams(state: ReviewState, months: readonly string[]): URLSearchParams {
  const base = defaultState(months.length);
  const params = new URLSearchParams();
  if (!sameRange(state.range, base.range)) {
    params.set('from', months[state.range.from] ?? '');
    params.set('to', months[state.range.to] ?? '');
  }
  if (state.source !== base.source) params.set('source', state.source);
  if (state.level !== base.level) params.set('level', state.level);
  if (state.fuels.length < FUEL_GROUP_IDS.length) params.set('fuels', state.fuels.join(','));
  if (state.compare !== base.compare) params.set('cmp', COMPARE_PARAM[state.compare]);
  if (state.areaLevel !== base.areaLevel) params.set('by', state.areaLevel);
  if (state.areaMetric !== base.areaMetric) params.set('metric', state.areaMetric);
  if (state.entity) params.set('entity', state.entity);
  return params;
}

/** Cars imported used are known by make only, so that is the one level that applies to them. */
export function levelAvailable(source: Source, level: Level): boolean {
  return source === 'new' || level === 'make';
}

export function effectiveLevel(state: Pick<ReviewState, 'source' | 'level'>): Level {
  return levelAvailable(state.source, state.level) ? state.level : 'make';
}

/** The query string that opens the review on a period and nothing else; empty for the default. */
export function reviewSearch(months: readonly string[], range: MonthRange): string {
  const query = toSearchParams({ ...defaultState(months.length), range }, months).toString();
  return query ? `?${query}` : '';
}

/** The review page for a table period (a month or a year); `null` if the data lacks it. */
export function reviewPath(lang: Lang, months: readonly string[], period: string): string | null {
  const range = rangeOfPeriod(months, period);
  return range ? `/${lang}/review${reviewSearch(months, range)}` : null;
}
