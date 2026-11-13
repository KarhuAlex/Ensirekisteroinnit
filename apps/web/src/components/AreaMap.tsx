import { MapChart } from 'echarts/charts';
import { TooltipComponent, VisualMapComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import type { GeoCollection } from '../data/geo';
import { useI18n } from '../i18n';
import { mapViewOption } from '../lib/charts';
import { panDirection, wheelFactor, wheelZooms } from '../lib/mapInput';
import {
  MAX_ZOOM,
  isZoomedIn,
  sameView,
  viewFromSeries,
  type MapView,
  type SeriesView,
} from '../lib/mapView';
import { MapZoomControls } from './MapZoomControls';
import { useMapZoom } from './useMapZoom';

echarts.use([MapChart, TooltipComponent, VisualMapComponent, CanvasRenderer]);

type EChartsGeoJson = Parameters<typeof echarts.registerMap>[1];

/** Our boundary files are plain GeoJSON; ECharts types its input more narrowly than it needs. */
function registerBoundaries(name: string, geo: GeoCollection): void {
  echarts.registerMap(name, geo as unknown as EChartsGeoJson);
}

/** The part of the map that the chart shows now, or `null` before it has drawn one. */
function shownView(chart: echarts.ECharts): MapView | null {
  const [series] = (chart.getOption() as { series: SeriesView[] }).series;
  return viewFromSeries(series);
}

/** The longitude and latitude under a mouse event, or `undefined` where the map has none. */
function pointerPosition(
  chart: echarts.ECharts,
  el: HTMLElement,
  event: MouseEvent,
): [number, number] | undefined {
  const box = el.getBoundingClientRect();
  const position = chart.convertFromPixel({ seriesIndex: 0 }, [
    event.clientX - box.left,
    event.clientY - box.top,
  ]);
  const [lon, lat] = Array.isArray(position) ? position : [];
  return lon === undefined || lat === undefined ? undefined : [lon, lat];
}

interface Props {
  mapName: string;
  geo: GeoCollection;
  option: EChartsCoreOption;
  height: number;
  ariaLabel: string;
  /** Called with the id of the area that was clicked or tapped. */
  onSelect?: (id: string) => void;
}

/** Owns the map instance. The table beside it always has the same figures. */
export function AreaMap({ mapName, geo, option, height, ariaLabel, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const { t } = useI18n();
  const hintId = useId();
  const { view, zoom, zoomIn, zoomOut, pan, reset, adopt } = useMapZoom(geo);
  // The handlers bound once below read the latest callbacks and view from here.
  const latest = useRef({ select: onSelect, zoom, adopt, view });
  latest.current = { select: onSelect, zoom, adopt, view };

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const chart = echarts.init(el);
    instance.current = chart;
    chart.on('click', (event) => {
      if (typeof event.name === 'string') latest.current.select?.(event.name);
    });
    chart.on('georoam', () => {
      const dragged = shownView(chart);
      if (dragged) latest.current.adopt(dragged);
    });
    const onWheel = (event: WheelEvent) => {
      if (!wheelZooms(event)) return;
      event.preventDefault();
      latest.current.zoom(wheelFactor(event), pointerPosition(chart, el, event));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      el.removeEventListener('wheel', onWheel);
      observer.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    registerBoundaries(mapName, geo);
    // Drawn on the next frame, so the whole map is never seen between the two calls.
    instance.current?.setOption(option, { notMerge: true, lazyUpdate: true });
    instance.current?.setOption(mapViewOption(latest.current.view));
  }, [mapName, geo, option]);

  useEffect(() => {
    const chart = instance.current;
    if (!chart) return;
    // A drag has moved the chart already; only a different view needs telling to it.
    const shown = shownView(chart);
    if (!shown || !sameView(shown, view)) chart.setOption(mapViewOption(view));
  }, [view]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = panDirection(event.key);
    // Buttons inside keep their own keys, and a map that is not zoomed in has nowhere to go.
    if (!direction || event.target !== event.currentTarget || !isZoomedIn(view)) return;
    event.preventDefault();
    pan(direction[0], direction[1]);
  };

  return (
    <div
      className="map-frame"
      role="group"
      aria-label={ariaLabel}
      aria-describedby={hintId}
      tabIndex={isZoomedIn(view) ? 0 : undefined}
      onKeyDown={onKeyDown}
    >
      <div
        ref={container}
        role="img"
        aria-label={ariaLabel}
        className={isZoomedIn(view) ? 'chart-canvas area-map is-zoomed' : 'chart-canvas area-map'}
        style={{ height }}
      />
      <MapZoomControls
        canZoomIn={view.zoom < MAX_ZOOM}
        canZoomOut={isZoomedIn(view)}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={reset}
      />
      <p id={hintId} className="map-hint">
        {t('map.hint')}
      </p>
    </div>
  );
}
