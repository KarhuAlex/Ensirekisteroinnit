import { describe, expect, it } from 'vitest';
import { compareLinesChart, priceLinesChart, shareLinesChart } from './charts';
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
  series: ['#a00', '#0a0', '#00a', '#aa0'],
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

describe('compareLinesChart', () => {
  const build = (unit: 'count' | 'pct') =>
    compareLinesChart({
      ...base,
      unit,
      series: [
        { name: 'A', slot: 2, values: [null, 10, 1234] },
        { name: 'B', slot: 0, values: [5, 6, 7] },
      ],
    }) as unknown as Built & {
      series: (LineSeries & { lineStyle: { color: string; type: unknown } })[];
    };

  it('starts the axis at zero and keeps the label width shared with the other line charts', () => {
    expect(build('count').yAxis.min).toBe(0);
    expect(build('count').yAxis.axisLabel.width).toBe(price().yAxis.axisLabel.width);
  });

  it('gives each line its own colour and its own dash', () => {
    const [a, b] = build('count').series;
    expect(a!.lineStyle.color).not.toBe(b!.lineStyle.color);
    expect(a!.lineStyle.type).not.toEqual(b!.lineStyle.type);
  });

  it('leaves the months before a line starts empty, not zero', () => {
    expect(build('count').series[0]!.data[0]).toBeNull();
  });

  it('leaves the values to the readout instead of labelling the line ends', () => {
    expect(build('count').series[0]).not.toHaveProperty('endLabel');
  });

  it("keeps a line's colour with its slot, whatever its place in the list", () => {
    const [a, b] = build('count').series;
    expect(a!.lineStyle.color).toBe('#00a');
    expect(b!.lineStyle.color).toBe('#a00');
  });
});
