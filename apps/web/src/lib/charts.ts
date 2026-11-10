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

export interface LinesOptions {
  colors: ThemeColors;
  fmt: Formatters;
  months: string[];
  series: { name: string; color: string; values: (number | null)[] }[];
  startIndex: number;
  reducedMotion: boolean;
}

export function shareLinesChart(o: LinesOptions): EChartsCoreOption {
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
        formatter: monthTick(n - o.startIndex),
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      interval: 25,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: o.colors.faint, fontSize: 12, formatter: (v: number) => `${v} %` },
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
