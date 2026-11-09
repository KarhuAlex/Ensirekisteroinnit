import { FUEL_GROUP_IDS, type FuelGroupId, type GroupedSeries } from '@regs/core';
import { percent } from './stats';

export interface PeriodRow extends Record<FuelGroupId, number> {
  period: string;
  total: number;
  bevShare: number | null;
  plugShare: number | null;
}

export function buildPeriodRows(
  periods: readonly string[],
  grouped: GroupedSeries,
  totals: readonly number[],
): PeriodRow[] {
  return periods.map((period, i) => {
    const count = (group: FuelGroupId) => grouped[group][i] ?? 0;
    const total = totals[i] ?? 0;
    return {
      period,
      bev: count('bev'),
      phev: count('phev'),
      petrol: count('petrol'),
      diesel: count('diesel'),
      other: count('other'),
      total,
      bevShare: percent(count('bev'), total),
      plugShare: percent(count('bev') + count('phev'), total),
    };
  });
}

/** The header is English on purpose (the file is data, not UI) and decimals use a point. */
export function toCsv(rows: readonly PeriodRow[]): string {
  const header = ['period', ...FUEL_GROUP_IDS, 'total', 'bev_share_pct', 'plugin_share_pct'];
  const lines = rows.map((row) =>
    [
      row.period,
      ...FUEL_GROUP_IDS.map((group) => row[group]),
      row.total,
      row.bevShare?.toFixed(2) ?? '',
      row.plugShare?.toFixed(2) ?? '',
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
