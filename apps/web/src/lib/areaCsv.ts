import { FUEL_GROUP_IDS } from '@regs/core';
import type { AreaRow } from './regionalRanking';

export interface AreaCsvRow extends AreaRow {
  region: string;
}

const quote = (text: string): string =>
  /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

const fixed = (value: number | null): string => (value === null ? '' : value.toFixed(2));

/** English header and decimal point, like the other exports. */
export function areaToCsv(rows: readonly AreaCsvRow[], period: string): string {
  const header = [
    'area_id',
    'area',
    'region',
    'period',
    'registrations',
    'area_total',
    'share_pct',
    'index',
    'previous_registrations',
    'share_change_pp',
    ...FUEL_GROUP_IDS,
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      quote(row.name),
      quote(row.region),
      period,
      row.count,
      row.total,
      fixed(row.share),
      fixed(row.index),
      row.previousCount ?? '',
      fixed(row.shareChange),
      ...FUEL_GROUP_IDS.map((group) => row.mix[group]),
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
