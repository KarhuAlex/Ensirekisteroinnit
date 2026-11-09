import { groupSeries, totalSeries, type EntitySeries, type GroupedSeries } from '@regs/core';
import { aggregateByYear } from './stats';

export interface SeriesView {
  grouped: GroupedSeries;
  totals: number[];
  annual: { years: string[]; grouped: GroupedSeries; totals: number[] };
}

export function buildSeriesView(
  series: Pick<EntitySeries, 'series'>,
  months: readonly string[],
): SeriesView {
  const grouped = groupSeries(series, months.length);
  const annual = aggregateByYear(months, grouped);
  return {
    grouped,
    totals: totalSeries(grouped, months.length),
    annual: { ...annual, totals: totalSeries(annual.grouped, annual.years.length) },
  };
}
