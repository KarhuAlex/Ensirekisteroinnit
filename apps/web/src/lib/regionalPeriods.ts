import type { Period } from '@regs/core';
import type { PeriodSpan } from './regionalRanking';
import type { MonthRange } from './ranking';

export const spanOf = (months: readonly Period[], range: MonthRange): PeriodSpan => ({
  from: months[range.from] as Period,
  to: months[range.to] as Period,
});

/** The calendar years a span touches, which are the years of data to load. */
export function yearsOfSpans(...spans: (PeriodSpan | null)[]): string[] {
  const years = new Set<string>();
  for (const span of spans) {
    if (!span) continue;
    for (let y = Number(span.from.slice(0, 4)); y <= Number(span.to.slice(0, 4)); y++) {
      years.add(String(y));
    }
  }
  return [...years].sort();
}

/**
 * The part of a span the data covers, or `null` when none of it does. The regional data starts
 * later than the national data, so a long range is cut at the start instead of being refused.
 */
export function clampToStart(span: PeriodSpan, first: Period): PeriodSpan | null {
  if (span.to < first) return null;
  return { from: span.from < first ? first : span.from, to: span.to };
}
