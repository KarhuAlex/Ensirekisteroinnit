import type { GroupedSeries } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { buildPeriodRows, toCsv } from './periodRows';
import { markIncompleteYear } from './stats';
import { buildSeriesView } from './seriesView';

const grouped: GroupedSeries = {
  bev: [30, 0],
  phev: [10, 0],
  petrol: [50, 0],
  diesel: [10, 0],
  other: [0, 0],
};

describe('buildPeriodRows', () => {
  const rows = buildPeriodRows(['2026-01', '2026-02'], grouped, [100, 0]);

  it('derives totals and shares per period', () => {
    expect(rows[0]).toMatchObject({ period: '2026-01', total: 100, bevShare: 30, plugShare: 40 });
  });
  it('leaves shares empty for periods without registrations', () => {
    expect(rows[1]).toMatchObject({ total: 0, bevShare: null, plugShare: null });
  });
});

describe('toCsv', () => {
  it('writes a header and one line per row with fixed decimals', () => {
    const csv = toCsv(buildPeriodRows(['2026-01', '2026-02'], grouped, [100, 0]));
    const [header, first, second] = csv.split('\n');
    expect(header).toBe('period,petrol,diesel,bev,phev,other,total,bev_share_pct,plugin_share_pct');
    expect(first).toBe('2026-01,50,10,30,10,0,100,30.00,40.00');
    expect(second).toBe('2026-02,0,0,0,0,0,0,,');
  });
});

describe('buildSeriesView', () => {
  it('groups fuels and sums years together with totals', () => {
    const view = buildSeriesView(
      { series: { bev: [1, 2, 4], petrol: [5, 5, 5], phev_petrol: [0, 1, 1] } },
      ['2025-11', '2025-12', '2026-01'],
    );
    expect(view.totals).toEqual([6, 8, 10]);
    expect(view.annual.years).toEqual(['2025', '2026']);
    expect(view.annual.totals).toEqual([14, 10]);
    expect(view.annual.grouped.phev).toEqual([1, 1]);
  });
});

describe('markIncompleteYear', () => {
  it('flags only the last year, and only when it is incomplete', () => {
    expect(markIncompleteYear(['2025', '2026'], true)).toEqual(['2025', '2026 *']);
    expect(markIncompleteYear(['2025', '2026'], false)).toEqual(['2025', '2026']);
  });
});
