import { FUEL_GROUP_IDS } from '@regs/core';
import type { NamedRow } from './ranking';

const quote = (text: string): string =>
  /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

/** English header and decimal point, like the period table. */
export function rankingToCsv(rows: readonly NamedRow[], period: string): string {
  const header = [
    'rank',
    'name',
    'make',
    'period',
    'registrations',
    'share_pct',
    'previous',
    'change_pct',
    ...FUEL_GROUP_IDS,
  ];
  const lines = rows.map((row) => {
    const change =
      row.previous !== null && row.previous > 0
        ? (((row.count - row.previous) / row.previous) * 100).toFixed(2)
        : '';
    return [
      row.rank,
      quote(row.name),
      quote(row.make),
      period,
      row.count,
      row.share?.toFixed(2) ?? '',
      row.previous ?? '',
      change,
      ...FUEL_GROUP_IDS.map((group) => row.mix[group]),
    ].join(',');
  });
  return [header.join(','), ...lines].join('\n');
}
