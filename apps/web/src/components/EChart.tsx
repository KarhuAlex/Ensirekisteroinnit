import { BarChart, LineChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { LegacyGridContainLabel } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  AriaComponent,
  LegacyGridContainLabel,
  CanvasRenderer,
]);

interface Props {
  option: EChartsCoreOption;
  height: number;
  ariaLabel: string;
  onHoverIndex?: (index: number | null) => void;
  /** Where to show the axis pointer for keyboard stepping; null hides it. */
  pointerIndex?: number | null;
}

/** Owns the ECharts instance: creates it, resizes it with its box and disposes it on unmount. */
export function EChart({ option, height, ariaLabel, onHoverIndex, pointerIndex }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const hoverRef = useRef(onHoverIndex);
  hoverRef.current = onHoverIndex;
  const lastFromChart = useRef<number | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const chart = echarts.init(el);
    instance.current = chart;
    chart.on('updateAxisPointer', (event) => {
      const info = (event as { axesInfo?: { value?: unknown }[] }).axesInfo?.[0];
      const value = info?.value;
      if (typeof value === 'number') {
        lastFromChart.current = Math.round(value);
        hoverRef.current?.(lastFromChart.current);
      }
    });
    chart.getZr().on('globalout', () => {
      lastFromChart.current = null;
      hoverRef.current?.(null);
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    instance.current?.setOption(option, { notMerge: true });
  }, [option]);

  useEffect(() => {
    const chart = instance.current;
    if (!chart || pointerIndex === undefined || pointerIndex === lastFromChart.current) return;
    if (pointerIndex === null) {
      lastFromChart.current = null;
      chart.dispatchAction({ type: 'hideTip' });
    } else chart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: pointerIndex });
  }, [pointerIndex, option]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={ariaLabel}
      className="chart-canvas"
      style={{ height }}
    />
  );
}
