import type { GroupedSeries } from '@regs/core';
import { MONTHS_PER_YEAR, percent, rollingShare, sumRange } from './stats';

/**
 * Figures behind the overview headline and key figures. Deltas compare with a year earlier, in
 * percent for registrations and in percentage points for shares. The 12-month figures compare the
 * last 12 months with the 12 before.
 */
export interface ElectrificationSummary {
  regsNow: number;
  regsDelta: number | null;
  bevNow: number | null;
  bevDelta: number | null;
  bev12: number | null;
  bev12Delta: number | null;
  plug12: number | null;
  plug12Delta: number | null;
  /** Rolling 12-month shares over the whole period, for the trend chart. */
  bevSeries: (number | null)[];
  plugSeries: (number | null)[];
}

const difference = (a: number | null, b: number | null): number | null =>
  a !== null && b !== null ? a - b : null;

export function summarizeElectrification(
  grouped: GroupedSeries,
  totals: readonly number[],
): ElectrificationSummary {
  const n = totals.length;
  const last = n - 1;
  const yearAgo = n - 1 - MONTHS_PER_YEAR;
  const plug = grouped.bev.map((v, i) => v + (grouped.phev[i] ?? 0));

  const monthShare = (part: readonly number[], i: number) =>
    i >= 0 ? percent(part[i] ?? 0, totals[i] ?? 0) : null;
  const windowShare = (part: readonly number[], from: number, to: number) =>
    percent(sumRange(part, from, to), sumRange(totals, from, to));

  const bevNow = monthShare(grouped.bev, last);
  const bev12 = windowShare(grouped.bev, n - MONTHS_PER_YEAR, n);
  const plug12 = windowShare(plug, n - MONTHS_PER_YEAR, n);
  const earlier = { from: n - 2 * MONTHS_PER_YEAR, to: n - MONTHS_PER_YEAR };

  const regsNow = totals[last] ?? 0;
  const regsThen = yearAgo >= 0 ? (totals[yearAgo] ?? 0) : 0;

  return {
    regsNow,
    regsDelta: regsThen > 0 ? (regsNow / regsThen - 1) * 100 : null,
    bevNow,
    bevDelta: difference(bevNow, monthShare(grouped.bev, yearAgo)),
    bev12,
    bev12Delta: difference(bev12, windowShare(grouped.bev, earlier.from, earlier.to)),
    plug12,
    plug12Delta: difference(plug12, windowShare(plug, earlier.from, earlier.to)),
    bevSeries: rollingShare(grouped.bev, totals, MONTHS_PER_YEAR),
    plugSeries: rollingShare(plug, totals, MONTHS_PER_YEAR),
  };
}
