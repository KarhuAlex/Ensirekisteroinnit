import { totalSeries, type FuelGroupId, type GroupedSeries } from '@regs/core';
import type { EChartsCoreOption } from 'echarts/core';
import type { Formatters } from './format';
import { STACK_ORDER } from './stats';
import type { ThemeColors } from './theme';

/** Hatch patterns back up the fuel colours on yearly bars, which are wide enough to show them. */
function decalFor(group: FuelGroupId, colors: ThemeColors): object | undefined {
  const color = colors.hatch;
  switch (group) {
    case 'phev':
      return {
        symbol: 'rect',
        color,
        dashArrayX: [1, 0],
        dashArrayY: [2, 4],
        rotation: -Math.PI / 4,
      };
    case 'petrol':
      return { symbol: 'circle', symbolSize: 0.9, color, dashArrayX: 6, dashArrayY: 6 };
    case 'diesel':
      return { symbol: 'rect', color, dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: 0 };
    case 'other':
      return { symbol: 'triangle', symbolSize: 0.9, color, dashArrayX: 7, dashArrayY: 7 };
    default:
      return undefined;
  }
}

/** Room under the axis labels, so their last pixel row is not cut off by the canvas edge. */
const GRID_BOTTOM = 14;

function monthTick(visibleMonths: number) {
  return (value: string): string => {
    if (visibleMonths <= 26) {
      const [year, month] = value.split('-');
      return month === '01' ? (year ?? '') : String(Number(month));
    }
    return value.endsWith('-01') ? value.slice(0, 4) : '';
  };
}

/** Points a quarter apart, labelled by the month the quarter ends in: the year at the first one. */
function quarterTick(visibleQuarters: number) {
  return (value: string): string => {
    const [year, month] = value.split('-');
    if (month === '03') return year ?? '';
    return visibleQuarters <= 12 ? `Q${Number(month) / 3}` : '';
  };
}

export interface BarsOptions {
  colors: ThemeColors;
  fmt: Formatters;
  categories: string[];
  grouped: GroupedSeries;
  mode: 'share' | 'count';
  /** Categories are months (`YYYY-MM`), not years. */
  monthly: boolean;
  /** Areas read better for long dense series (no seams), columns for sparse or yearly data. */
  shape: 'bars' | 'area';
  hidden: ReadonlySet<FuelGroupId>;
  startIndex: number;
  reducedMotion: boolean;
}

export function fuelBarsChart(o: BarsOptions): EChartsCoreOption {
  const n = o.categories.length;
  const totals = totalSeries(o.grouped, n);
  const isShare = o.mode === 'share';
  const valuesFor = (group: FuelGroupId): number[] =>
    isShare
      ? o.grouped[group].map((v, i) =>
          (totals[i] ?? 0) > 0 ? (v / (totals[i] as number)) * 100 : 0,
        )
      : o.grouped[group];
  const groups = STACK_ORDER.filter((g) => !o.hidden.has(g) && o.grouped[g].some((v) => v > 0));

  return {
    animation: !o.reducedMotion,
    animationDuration: 320,
    aria: { decal: { show: !o.monthly } },
    grid: { left: 0, right: 4, top: 10, bottom: GRID_BOTTOM, containLabel: true },
    tooltip: {
      trigger: 'axis',
      showContent: false,
      axisPointer: { type: 'line', lineStyle: { color: o.colors.ink, width: 1.25 } },
    },
    xAxis: {
      type: 'category',
      data: o.categories,
      boundaryGap: o.shape === 'bars',
      axisLine: { lineStyle: { color: o.colors.rule } },
      axisTick: { show: false },
      axisLabel: {
        color: o.colors.faint,
        fontSize: 12,
        interval: 0,
        hideOverlap: true,
        ...(o.monthly ? { formatter: monthTick(n - o.startIndex) } : {}),
      },
    },
    yAxis: {
      type: 'value',
      ...(isShare ? { max: 100, interval: 25 } : {}),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: o.colors.faint,
        fontSize: 12,
        formatter: (v: number) => (isShare ? `${v} %` : o.fmt.int(v)),
      },
      splitLine: { lineStyle: { color: o.colors.rule } },
    },
    dataZoom: [
      {
        type: 'inside',
        startValue: o.startIndex,
        endValue: n - 1,
        minValueSpan: 6,
        zoomOnMouseWheel: 'ctrl',
        moveOnMouseWheel: false,
        moveOnMouseMove: false,
      },
    ],
    series: groups.map((group) =>
      o.shape === 'area'
        ? {
            name: group,
            type: 'line',
            stack: 'all',
            data: valuesFor(group),
            symbol: 'none',
            lineStyle: { width: 1.5, color: o.colors.ground },
            itemStyle: { color: o.colors.fuel[group] },
            areaStyle: { opacity: 1, color: o.colors.fuel[group] },
            emphasis: { disabled: true },
          }
        : {
            name: group,
            type: 'bar',
            stack: 'all',
            data: valuesFor(group),
            barCategoryGap: o.monthly ? '0%' : '34%',
            barGap: '0%',
            itemStyle: {
              color: o.colors.fuel[group],
              ...(o.monthly ? {} : { decal: decalFor(group, o.colors) }),
            },
            emphasis: { disabled: true },
          },
    ),
  };
}

interface TimeAxisOptions {
  colors: ThemeColors;
  months: string[];
  startIndex: number;
  reducedMotion: boolean;
  /** The points are quarters, named by the month they end in, rather than every month. */
  quarterly?: boolean;
}

/** What the line charts over the months share: grid, pointer, month axis and zoom window. */
function timeChartBase(o: TimeAxisOptions) {
  const n = o.months.length;
  return {
    animation: !o.reducedMotion,
    animationDuration: 320,
    grid: { left: 0, right: 48, top: 10, bottom: GRID_BOTTOM, containLabel: true },
    tooltip: {
      trigger: 'axis',
      showContent: false,
      axisPointer: { type: 'line', lineStyle: { color: o.colors.ink, width: 1.25 } },
    },
    xAxis: {
      type: 'category',
      data: o.months,
      boundaryGap: false,
      axisLine: { lineStyle: { color: o.colors.rule } },
      axisTick: { show: false },
      axisLabel: {
        color: o.colors.faint,
        fontSize: 12,
        interval: 0,
        hideOverlap: true,
        formatter: (o.quarterly ? quarterTick : monthTick)(n - o.startIndex),
      },
    },
    dataZoom: [
      {
        type: 'inside',
        startValue: o.startIndex,
        endValue: n - 1,
        minValueSpan: 6,
        zoomOnMouseWheel: 'ctrl',
        moveOnMouseWheel: false,
        moveOnMouseMove: false,
      },
    ],
  };
}

/** Both charts of a stacked pair give their value labels the same width, so their months line up. */
const Y_LABEL_WIDTH = 44;

const quietAxis = (colors: ThemeColors) => ({
  axisLine: { show: false },
  axisTick: { show: false },
  splitLine: { lineStyle: { color: colors.rule } },
});

const yLabels = (colors: ThemeColors, formatter: (v: number) => string) => ({
  color: colors.faint,
  fontSize: 12,
  width: Y_LABEL_WIDTH,
  align: 'right',
  formatter,
});

/** The top of a share axis that fits the highest value: a fifth, two fifths or the whole scale. */
export function shareAxisMax(values: readonly (number | null)[]): number {
  const highest = Math.max(0, ...values.map((v) => v ?? 0));
  return [20, 40].find((max) => highest <= max) ?? 100;
}

export interface LinesOptions extends TimeAxisOptions {
  fmt: Formatters;
  series: { name: string; color: string; values: (number | null)[] }[];
  /** Top of the share axis in percent; the whole scale, 100, when left out. */
  yMax?: number;
}

export function shareLinesChart(o: LinesOptions): EChartsCoreOption {
  const max = o.yMax ?? 100;
  return {
    ...timeChartBase(o),
    yAxis: {
      type: 'value',
      min: 0,
      max,
      interval: max / 4,
      ...quietAxis(o.colors),
      axisLabel: yLabels(o.colors, (v) => `${v} %`),
    },
    series: o.series.map((s) => ({
      name: s.name,
      type: 'line',
      data: s.values,
      symbol: 'none',
      connectNulls: false,
      lineStyle: { width: 2.75, color: s.color },
      itemStyle: { color: s.color },
      endLabel: {
        show: true,
        color: s.color,
        fontWeight: 700,
        fontSize: 13,
        formatter: (p: { value: unknown }) =>
          typeof p.value === 'number' ? o.fmt.pct(p.value) : '',
      },
      emphasis: { disabled: true },
    })),
  };
}

export interface CompareLinesOptions extends TimeAxisOptions {
  fmt: Formatters;
  unit: 'count' | 'pct';
  /** `slot` picks the line's colour and dash, and stays with the thing when others are removed. */
  series: { name: string; slot: number; values: (number | null)[] }[];
}

/** How each line is drawn besides its colour, so the lines also differ without colour vision. */
const LINE_DASHES: (number[] | 'solid')[] = ['solid', [10, 5], [2, 4], [10, 4, 2, 4]];

/**
 * The things being compared as lines; a line has no value before the thing's first month. Lines
 * carry no end labels, because those collide when lines end close together; the readout above
 * the chart gives the values instead.
 */
export function compareLinesChart(o: CompareLinesOptions): EChartsCoreOption {
  return {
    ...timeChartBase(o),
    yAxis: {
      type: 'value',
      min: 0,
      ...quietAxis(o.colors),
      axisLabel: yLabels(o.colors, (v) => (o.unit === 'pct' ? `${v} %` : o.fmt.int(v))),
    },
    series: o.series.map((s) => {
      const color = o.colors.series[s.slot % o.colors.series.length] ?? o.colors.ink;
      return {
        name: s.name,
        type: 'line',
        data: s.values,
        symbol: 'none',
        connectNulls: false,
        lineStyle: { width: 2.5, color, type: LINE_DASHES[s.slot % LINE_DASHES.length] },
        itemStyle: { color },
        emphasis: { disabled: true },
      };
    }),
  };
}

export interface PriceLinesOptions extends TimeAxisOptions {
  fmt: Formatters;
  series: {
    name: string;
    color: string;
    monthly: (number | null)[];
    average: (number | null)[];
  }[];
}

/** Each price as a thin monthly line with its 12-month average on top. The axis starts at zero. */
export function priceLinesChart(o: PriceLinesOptions): EChartsCoreOption {
  return {
    ...timeChartBase(o),
    yAxis: {
      type: 'value',
      min: 0,
      ...quietAxis(o.colors),
      axisLabel: yLabels(o.colors, (v) => o.fmt.decimal(v)),
    },
    series: o.series.flatMap((s) => [
      {
        name: s.name,
        type: 'line',
        data: s.monthly,
        symbol: 'none',
        connectNulls: false,
        lineStyle: { width: 1.25, color: s.color, opacity: 0.55 },
        itemStyle: { color: s.color },
        endLabel: {
          show: true,
          color: s.color,
          fontWeight: 700,
          fontSize: 13,
          formatter: (p: { value: unknown }) =>
            typeof p.value === 'number' ? o.fmt.decimal2(p.value) : '',
        },
        emphasis: { disabled: true },
      },
      {
        name: `${s.name} (12)`,
        type: 'line',
        data: s.average,
        symbol: 'none',
        connectNulls: false,
        lineStyle: { width: 2.75, color: s.color },
        itemStyle: { color: s.color },
        emphasis: { disabled: true },
      },
    ]),
  };
}

export interface MapDatum {
  /** Matches the `id` property of the boundary features. */
  id: string;
  value: number | null;
  tooltip: string[];
}

interface MapOptions {
  colors: ThemeColors;
  mapName: string;
  data: readonly MapDatum[];
  scale: { min: number; max: number };
  diverging: boolean;
  formatValue: (value: number) => string;
  noDataColor: string;
}

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A choropleth where areas without a value keep a neutral colour. */
export function areaMapOption(o: MapOptions): EChartsCoreOption {
  const tooltips = new Map(o.data.map((d) => [d.id, d.tooltip]));
  const colours = o.diverging
    ? [o.colors.fuel.phev, o.colors.ground, o.colors.fuel.bev]
    : [o.colors.ground, o.colors.fuel.bev];
  return {
    animation: false,
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (params: { name: string }) => {
        const lines = tooltips.get(params.name) ?? [];
        const [title = '', ...rest] = lines;
        return `<strong>${escapeHtml(title)}</strong>${rest.map((l) => `<br/>${escapeHtml(l)}`).join('')}`;
      },
    },
    visualMap: {
      min: o.scale.min,
      max: o.scale.max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 14,
      itemHeight: 160,
      text: [o.formatValue(o.scale.max), o.formatValue(o.scale.min)],
      textStyle: { color: o.colors.muted },
      inRange: { color: colours },
    },
    series: [
      {
        type: 'map',
        map: o.mapName,
        nameProperty: 'id',
        roam: false,
        selectedMode: false,
        label: { show: false },
        itemStyle: { areaColor: o.noDataColor, borderColor: o.colors.rule, borderWidth: 0.5 },
        emphasis: {
          label: { show: false },
          itemStyle: { borderColor: o.colors.ink, borderWidth: 1.5 },
        },
        data: o.data.map((d) => ({ name: d.id, value: d.value })),
      },
    ],
  };
}
