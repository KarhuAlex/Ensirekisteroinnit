import { FUEL_GROUP_IDS, type FuelGroupId, type GroupedSeries } from '@regs/core';

export const MONTHS_PER_YEAR = 12;

export const yearOf = (period: string): string => period.slice(0, 4);

export function aggregateByYear(
  months: readonly string[],
  grouped: GroupedSeries,
): { years: string[]; grouped: GroupedSeries } {
  const years = [...new Set(months.map(yearOf))];
  const yearIndex = new Map(years.map((y, i) => [y, i]));
  const out = Object.fromEntries(
    FUEL_GROUP_IDS.map((g) => [g, new Array<number>(years.length).fill(0)]),
  ) as GroupedSeries;
  months.forEach((month, i) => {
    const yi = yearIndex.get(yearOf(month));
    if (yi === undefined) return;
    for (const g of FUEL_GROUP_IDS) out[g][yi] = (out[g][yi] ?? 0) + (grouped[g][i] ?? 0);
  });
  return { years, grouped: out };
}

/** Share of trailing-window sums in percent; `null` until a full window exists. */
export function rollingShare(
  part: readonly number[],
  whole: readonly number[],
  window: number,
): (number | null)[] {
  const out: (number | null)[] = [];
  let p = 0;
  let w = 0;
  for (let i = 0; i < whole.length; i++) {
    p += part[i] ?? 0;
    w += whole[i] ?? 0;
    if (i >= window) {
      p -= part[i - window] ?? 0;
      w -= whole[i - window] ?? 0;
    }
    out.push(i >= window - 1 && w > 0 ? (p / w) * 100 : null);
  }
  return out;
}

export function sumRange(values: readonly number[], from: number, to: number): number {
  let acc = 0;
  for (let i = Math.max(0, from); i < Math.min(values.length, to); i++) acc += values[i] ?? 0;
  return acc;
}

export const percent = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

/** Stack order from the bottom: electric first, so its growth is easy to read. */
export const STACK_ORDER: readonly FuelGroupId[] = ['bev', 'phev', 'petrol', 'diesel', 'other'];

export type RangeId = 'all' | '5y' | '2y' | '1y';
export const RANGE_IDS: readonly RangeId[] = ['all', '5y', '2y', '1y'];
const RANGE_MONTHS: Record<RangeId, number | null> = { all: null, '5y': 60, '2y': 24, '1y': 12 };

export function rangeStart(monthCount: number, range: RangeId): number {
  const months = RANGE_MONTHS[range];
  return months === null ? 0 : Math.max(0, monthCount - months);
}

export type ModelStory =
  | { kind: 'none' }
  | { kind: 'all-electric'; count: number }
  | { kind: 'mixed'; count: number; bevShare: number };

export function modelStory(last12: number, bevLast12: number): ModelStory {
  if (last12 <= 0) return { kind: 'none' };
  if (bevLast12 >= last12) return { kind: 'all-electric', count: last12 };
  return { kind: 'mixed', count: last12, bevShare: (bevLast12 / last12) * 100 };
}

/** Marks the last year with an asterisk while it is incomplete; a footnote explains it. */
export function markIncompleteYear(years: readonly string[], incomplete: boolean): string[] {
  return years.map((year, i) => (incomplete && i === years.length - 1 ? `${year} *` : year));
}

export type Tone = 'positive' | 'negative' | 'neutral';

export function toneOf(change: number | null): Tone {
  if (change === null || change === 0) return 'neutral';
  return change > 0 ? 'positive' : 'negative';
}
