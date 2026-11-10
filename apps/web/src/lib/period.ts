import type { MonthRange } from './ranking';
import { MONTHS_PER_YEAR, yearOf } from './stats';

export const monthOf = (period: string): number => Number(period.slice(5, 7));

export function yearRange(months: readonly string[], year: string): MonthRange | null {
  const from = months.findIndex((m) => yearOf(m) === year);
  if (from < 0) return null;
  const to = months.findLastIndex((m) => yearOf(m) === year);
  return { from, to };
}

/** The months a table row stands for: one month for `2026-10`, the months of the year for `2026`. */
export function rangeOfPeriod(months: readonly string[], period: string): MonthRange | null {
  const index = months.indexOf(period);
  if (index >= 0) return { from: index, to: index };
  return yearRange(months, period);
}

export const yearsOf = (months: readonly string[]): string[] => [...new Set(months.map(yearOf))];

export type RangeKind =
  | { kind: 'month'; period: string }
  | { kind: 'year'; year: string; partial: boolean }
  | { kind: 'span'; from: string; to: string };

export function describeRange(months: readonly string[], range: MonthRange): RangeKind {
  const from = months[range.from] ?? '';
  const to = months[range.to] ?? '';
  if (range.from === range.to) return { kind: 'month', period: from };
  const year = yearRange(months, yearOf(from));
  if (year && year.from === range.from && year.to === range.to) {
    return { kind: 'year', year: yearOf(from), partial: monthOf(to) < MONTHS_PER_YEAR };
  }
  return { kind: 'span', from, to };
}

/** Steps by the range's own length, stopping at the edges of the data. */
export function stepRange(
  range: MonthRange,
  direction: -1 | 1,
  monthCount: number,
): MonthRange | null {
  const length = range.to - range.from + 1;
  const by =
    direction < 0 ? -Math.min(length, range.from) : Math.min(length, monthCount - 1 - range.to);
  return by === 0 ? null : { from: range.from + by, to: range.to + by };
}

export type PresetId = 'latest' | 'last3' | 'last12' | 'thisYear' | 'lastYear' | 'all';
export const PRESET_IDS: readonly PresetId[] = [
  'latest',
  'last3',
  'last12',
  'thisYear',
  'lastYear',
  'all',
];

export function presetRange(months: readonly string[], id: PresetId): MonthRange | null {
  const last = months.length - 1;
  if (last < 0) return null;
  switch (id) {
    case 'latest':
      return { from: last, to: last };
    case 'last3':
      return { from: Math.max(0, last - 2), to: last };
    case 'last12':
      return { from: Math.max(0, last - 11), to: last };
    case 'thisYear':
      return yearRange(months, yearOf(months[last]!));
    case 'lastYear':
      return yearRange(months, String(Number(yearOf(months[last]!)) - 1));
    case 'all':
      return { from: 0, to: last };
  }
}

/**
 * The same months in another list of months, or `null` when none of them is there. The review
 * picks its range from the national months; datasets that start or end at other months follow it.
 */
export function translateRange(
  from: readonly string[],
  to: readonly string[],
  range: MonthRange,
): MonthRange | null {
  const wanted = from.slice(range.from, range.to + 1);
  const found = wanted.map((month) => to.indexOf(month)).filter((index) => index >= 0);
  if (found.length === 0) return null;
  return { from: Math.min(...found), to: Math.max(...found) };
}
