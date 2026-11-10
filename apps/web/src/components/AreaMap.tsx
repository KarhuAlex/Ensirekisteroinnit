import { MapChart } from 'echarts/charts';
import { TooltipComponent, VisualMapComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { GeoCollection } from '../data/geo';

echarts.use([MapChart, TooltipComponent, VisualMapComponent, CanvasRenderer]);

type EChartsGeoJson = Parameters<typeof echarts.registerMap>[1];

/** Our boundary files are plain GeoJSON; ECharts types its input more narrowly than it needs. */
function registerBoundaries(name: string, geo: GeoCollection): void {
  echarts.registerMap(name, geo as unknown as EChartsGeoJson);
}

interface Props {
  mapName: string;
  geo: GeoCollection;
  option: EChartsCoreOption;
  height: number;
  ariaLabel: string;
}

/** Owns the map instance. The table beside it always has the same figures. */
export function AreaMap({ mapName, geo, option, height, ariaLabel }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const chart = echarts.init(el);
    instance.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    registerBoundaries(mapName, geo);
    instance.current?.setOption(option, { notMerge: true });
  }, [mapName, geo, option]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={ariaLabel}
      className="chart-canvas area-map"
      style={{ height }}
    />
  );
}
