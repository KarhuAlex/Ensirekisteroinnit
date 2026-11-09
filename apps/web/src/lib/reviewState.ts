import { FUEL_GROUP_IDS, type FuelGroupId } from '@regs/core';
import type { Level } from './entityLevel';
import { sameRange, type CompareMode, type MonthRange } from './ranking';

export interface ReviewState {
  range: MonthRange;
  level: Level;
  fuels: FuelGroupId[];
  compare: CompareMode;
}

const COMPARE_PARAM: Record<CompareMode, string> = {
  none: 'none',
  previous: 'prev',
  yearAgo: 'year',
};
const DEFAULT_COMPARE: CompareMode = 'yearAgo';

export function defaultState(monthCount: number): ReviewState {
  const last = Math.max(0, monthCount - 1);
  return {
    range: { from: last, to: last },
    level: 'model',
    fuels: [...FUEL_GROUP_IDS],
    compare: DEFAULT_COMPARE,
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
    level: params.get('level') === 'make' ? 'make' : 'model',
    fuels: fuels.length > 0 ? [...fuels] : base.fuels,
    compare,
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
  if (state.level !== base.level) params.set('level', state.level);
  if (state.fuels.length < FUEL_GROUP_IDS.length) params.set('fuels', state.fuels.join(','));
  if (state.compare !== base.compare) params.set('cmp', COMPARE_PARAM[state.compare]);
  return params;
}
