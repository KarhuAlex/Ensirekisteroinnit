import { describe, expect, it } from 'vitest';
import {
  areaMapOption,
  compareLinesChart,
  mapViewOption,
  priceLinesChart,
  shareAxisMax,
  shareLinesChart,
} from './charts';
import { makeFormatters } from './format';
import type { MapView } from './mapView';
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

describe('quarterly time axis', () => {
  const quarters = ['2025-03', '2025-06', '2025-09', '2025-12', '2026-03'];
  const label = (count: number, startIndex = 0) => {
    const chart = shareLinesChart({
      ...base,
      months: quarters.slice(0, count),
      startIndex,
      quarterly: true,
      series: [{ name: 'bev', color: '#0a0', values: [1, 2, 3, 4, 5].slice(0, count) }],
    }) as unknown as { xAxis: { axisLabel: { formatter: (value: string) => string } } };
    return chart.xAxis.axisLabel.formatter;
  };

  it('names the year at the first quarter and the quarter number on a short span', () => {
    const short = label(5);
    expect(short('2025-03')).toBe('2025');
    expect(short('2025-09')).toBe('Q3');
  });

  it('leaves the quarters between the years unlabelled on a long span', () => {
    const many = Array.from(
      { length: 40 },
      (_, i) => `${2010 + Math.floor(i / 4)}-${String((i % 4) * 3 + 3).padStart(2, '0')}`,
    );
    const chart = shareLinesChart({
      ...base,
      months: many,
      quarterly: true,
      series: [{ name: 'bev', color: '#0a0', values: many.map(() => 1) }],
    }) as unknown as { xAxis: { axisLabel: { formatter: (value: string) => string } } };
    expect(chart.xAxis.axisLabel.formatter('2012-03')).toBe('2012');
    expect(chart.xAxis.axisLabel.formatter('2012-09')).toBe('');
  });
});

describe('shareAxisMax', () => {
  it('picks the smallest scale that holds the highest value', () => {
    expect(shareAxisMax([null, 3, 14.6])).toBe(20);
    expect(shareAxisMax([20.5])).toBe(40);
    expect(shareAxisMax([55, 63])).toBe(100);
  });

  it('keeps the smallest scale for a series without values', () => {
    expect(shareAxisMax([])).toBe(20);
    expect(shareAxisMax([null, null])).toBe(20);
  });

  it('sets the axis of a share chart in quarters of its top', () => {
    const chart = shareLinesChart({
      ...base,
      yMax: 20,
      series: [{ name: 'bev', color: '#0a0', values: [1, 2, 3] }],
    }) as unknown as { yAxis: { max: number; interval: number } };
    expect(chart.yAxis).toMatchObject({ max: 20, interval: 5 });
  });
});

describe('areaMapOption', () => {
  /** Mainland Finland spans about 11 degrees of longitude and 10 degrees of latitude. */
  const SPAN = { longitude: 11.1, latitude: 10.3 };

  it('draws Finland taller than wide, the way it is', () => {
    const option = areaMapOption({
      colors,
      mapName: 'area',
      data: [],
      scale: { min: 0, max: 10 },
      diverging: false,
      formatValue: String,
      noDataColor: '#ddd',
    }) as unknown as { series: { aspectScale: number }[] };
    const drawnWidth = SPAN.longitude * option.series[0]!.aspectScale;
    expect(drawnWidth / SPAN.latitude).toBeLessThan(0.55);
    expect(drawnWidth / SPAN.latitude).toBeGreaterThan(0.35);
  });
});

describe('areaMapOption, the chosen area', () => {
  const build = (selectedId?: string | null) =>
    areaMapOption({
      colors,
      mapName: 'area',
      data: [
        { id: 'a', value: 1, tooltip: [] },
        { id: 'b', value: 2, tooltip: [] },
        { id: 'c', value: 3, tooltip: [] },
      ],
      scale: { min: 0, max: 10 },
      diverging: false,
      formatValue: String,
      noDataColor: '#ddd',
      ...(selectedId === undefined ? {} : { selectedId }),
    }) as unknown as {
      series: { data: { name: string; itemStyle?: { borderWidth: number } }[] }[];
    };

  it('outlines the chosen area and draws it last, over its neighbours', () => {
    const data = build('a').series[0]!.data;
    expect(data.map((d) => d.name)).toEqual(['b', 'c', 'a']);
    expect(data.filter((d) => d.itemStyle)).toHaveLength(1);
    expect(data.at(-1)?.itemStyle?.borderWidth).toBeGreaterThan(1);
  });

  it('outlines nothing when no area is chosen', () => {
    for (const selectedId of [undefined, null]) {
      const data = build(selectedId).series[0]!.data;
      expect(data.map((d) => d.name)).toEqual(['a', 'b', 'c']);
      expect(data.some((d) => d.itemStyle)).toBe(false);
    }
  });
});

describe('mapViewOption', () => {
  const series = (view: MapView) =>
    (mapViewOption(view) as unknown as { series: Record<string, unknown>[] }).series[0];

  it('keeps the whole map in place', () => {
    expect(series({ zoom: 1, center: [25, 65] })).toEqual({
      roam: false,
      zoom: 1,
      center: [25, 65],
    });
  });

  it('lets a zoomed-in map be dragged', () => {
    expect(series({ zoom: 2.5, center: [27, 63] })).toEqual({
      roam: 'move',
      zoom: 2.5,
      center: [27, 63],
    });
  });
});
