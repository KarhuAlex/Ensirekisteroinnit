import { describe, expect, it } from 'vitest';
import { priceLinesChart, shareLinesChart } from './charts';
import { makeFormatters } from './format';
import type { ThemeColors } from './theme';

const colors: ThemeColors = {
  ink: '#000',
  muted: '#333',
  faint: '#666',
  rule: '#ccc',
  ground: '#fff',
  fuel: { bev: '#0a0', phev: '#00a', petrol: '#fa0', diesel: '#444', other: '#888' },
  hatch: '#fff',
};
const fmt = makeFormatters('fi');
const months = ['2026-08', '2026-09', '2026-10'];
const base = { colors, fmt, months, startIndex: 0, reducedMotion: true };

interface LineSeries {
  name: string;
  data: (number | null)[];
  lineStyle: { width: number };
  endLabel?: { formatter: (p: { value: unknown }) => string };
}
interface Built {
  yAxis: { min: number; axisLabel: { width: number } };
  series: LineSeries[];
}

const price = (): Built =>
  priceLinesChart({
    ...base,
    series: [
      { name: 'Diesel', color: '#444', monthly: [2.4, 2.45, 2.49], average: [null, null, 2.4] },
      { name: 'Bensiini', color: '#fa0', monthly: [2.2, 2.25, 2.28], average: [null, null, 2.2] },
    ],
  }) as unknown as Built;

describe('priceLinesChart', () => {
  it('starts the price axis at zero', () => {
    expect(price().yAxis.min).toBe(0);
  });

  it('draws a thin monthly line and a thicker average line for each fuel', () => {
    const { series } = price();
    expect(series.map((s) => s.name)).toEqual([
      'Diesel',
      'Diesel (12)',
      'Bensiini',
      'Bensiini (12)',
    ]);
    expect(series[1]!.lineStyle.width).toBeGreaterThan(series[0]!.lineStyle.width);
    expect(series[1]!.data).toEqual([null, null, 2.4]);
  });

  it('labels the end of the monthly line with the latest price and leaves a gap empty', () => {
    const label = price().series[0]!.endLabel!.formatter;
    expect(label({ value: 2.49 })).toBe('2,49');
    expect(label({ value: null })).toBe('');
  });
});

describe('stacked line charts', () => {
  it('give their value labels the same width so the months line up', () => {
    const share = shareLinesChart({
      ...base,
      series: [{ name: 'bev', color: '#0a0', values: [50, 51, 52] }],
    }) as unknown as Built;
    expect(share.yAxis.axisLabel.width).toBe(price().yAxis.axisLabel.width);
  });
});
