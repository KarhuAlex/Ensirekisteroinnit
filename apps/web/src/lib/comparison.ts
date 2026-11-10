import { TOTAL_ENTITY_ID, type FuelGroupId, type Matrix, type MatrixRow } from '@regs/core';
import { MONTHS_PER_YEAR, rollingShare, rollingSum } from './stats';

export const COMPARE_METRICS = ['rolling', 'monthly', 'share', 'bevShare'] as const;
export type CompareMetric = (typeof COMPARE_METRICS)[number];
export const DEFAULT_METRIC: CompareMetric = 'rolling';

/** Counts or percentages, which decides the axis and how values are written. */
export const metricUnit = (metric: CompareMetric): 'count' | 'pct' =>
  metric === 'share' || metric === 'bevShare' ? 'pct' : 'count';

export const MAX_COMPARED = 4;

/** The electric share of a make or model is left out while it rests on fewer cars than this. */
export const MIN_SHARE_BASE = 20;

export interface ComparedSeries {
  id: string;
  /** One value per month; `null` before the first registration and where a value is not reliable. */
  values: (number | null)[];
}

interface Monthly {
  total: number[];
  bev: number[];
}

/** The monthly registrations of a row: all fuels, and the battery-electric part. */
function monthlyOf(matrix: Matrix, row: MatrixRow): Monthly {
  const months = matrix.months.length;
  const bevIndex = matrix.groups.indexOf('bev' satisfies FuelGroupId);
  if (bevIndex < 0) throw new Error('The matrix has no battery-electric group');
  const total = new Array<number>(months).fill(0);
  const bev = new Array<number>(months).fill(0);
  for (let group = 0; group < matrix.groups.length; group++) {
    for (let m = 0; m < months; m++) {
      const count = row.counts[group * months + m] ?? 0;
      total[m] = (total[m] ?? 0) + count;
      if (group === bevIndex) bev[m] = count;
    }
  }
  return { total, bev };
}

interface MatrixIndex {
  rows: ReadonlyMap<string, MatrixRow>;
  /** Registrations of all new cars each month, the whole that a share is a share of. */
  market: number[];
}

/** Built once for each matrix, because the page asks for several measures of the same one. */
const indexes = new WeakMap<Matrix, MatrixIndex>();

function indexOf(matrix: Matrix): MatrixIndex {
  let index = indexes.get(matrix);
  if (!index) {
    const rows = new Map(matrix.rows.map((row) => [row.id, row]));
    const market = rows.get(TOTAL_ENTITY_ID);
    if (!market) throw new Error('The matrix has no row for all cars');
    index = { rows, market: monthlyOf(matrix, market).total };
    indexes.set(matrix, index);
  }
  return index;
}

/** Months before the first registration have no value, so a new model's line starts late. */
function fromFirstRegistration(values: (number | null)[], total: readonly number[]) {
  const first = total.findIndex((count) => count > 0);
  return values.map((value, m) => (first >= 0 && m >= first ? value : null));
}

/** The chosen measure for each id; ids the matrix does not have are left out. */
export function compareSeries(
  matrix: Matrix,
  ids: readonly string[],
  metric: CompareMetric,
): ComparedSeries[] {
  const { rows, market } = indexOf(matrix);
  return ids.flatMap((id) => {
    const row = rows.get(id);
    if (!row) return [];
    const { total, bev } = monthlyOf(matrix, row);
    const values = valuesFor(metric, { total, bev }, market);
    return [{ id, values: fromFirstRegistration(values, total) }];
  });
}

function valuesFor(
  metric: CompareMetric,
  { total, bev }: Monthly,
  market: readonly number[],
): (number | null)[] {
  switch (metric) {
    case 'monthly':
      return total;
    case 'rolling':
      return rollingSum(total, MONTHS_PER_YEAR);
    case 'share':
      return rollingShare(total, market, MONTHS_PER_YEAR);
    case 'bevShare': {
      const shares = rollingShare(bev, total, MONTHS_PER_YEAR);
      const base = rollingSum(total, MONTHS_PER_YEAR);
      return shares.map((share, m) => ((base[m] ?? 0) >= MIN_SHARE_BASE ? share : null));
    }
  }
}

/** One slot for each line of a comparison: its colour and its dash. */
export const SERIES_SLOTS = MAX_COMPARED;

function hashOf(id: string): number {
  let hash = 5381;
  for (const char of id) hash = (hash * 33 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash;
}

/**
 * Gives each id a slot that follows the id itself, so removing one thing does not recolour the
 * others. An id takes the slot its name points to, or the next free one if that is taken.
 */
export function seriesSlots(ids: readonly string[]): Map<string, number> {
  const taken = new Set<number>();
  const slots = new Map<string, number>();
  for (const id of ids) {
    let slot = hashOf(id) % SERIES_SLOTS;
    while (taken.has(slot) && taken.size < SERIES_SLOTS) slot = (slot + 1) % SERIES_SLOTS;
    taken.add(slot);
    slots.set(id, slot);
  }
  return slots;
}

export interface Summary {
  id: string;
  /** Registrations in the last 12 months. */
  last12: number;
  /** The same a year earlier; `null` if the thing had no registrations yet. */
  yearAgo: number | null;
  /** Percent of all new cars in the last 12 months. */
  share: number | null;
  bevShare: number | null;
}

/** The last 12 months of each id, for the summary table. */
export function summarize(matrix: Matrix, ids: readonly string[]): Summary[] {
  const last = matrix.months.length - 1;
  const rolling = compareSeries(matrix, ids, 'rolling');
  const share = compareSeries(matrix, ids, 'share');
  const bev = compareSeries(matrix, ids, 'bevShare');
  return rolling.map((series, i) => ({
    id: series.id,
    last12: series.values[last] ?? 0,
    yearAgo: series.values[last - MONTHS_PER_YEAR] ?? null,
    share: share[i]?.values[last] ?? null,
    bevShare: bev[i]?.values[last] ?? null,
  }));
}
