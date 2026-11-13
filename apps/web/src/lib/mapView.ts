import type { GeoCollection } from '../data/geo';

/** West, south, east and north edge of a set of boundaries, in degrees. */
export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** What part of the map is shown: how far in, and which point of it is in the middle. */
export interface MapView {
  zoom: number;
  center: [number, number];
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 12;
/** The zoom of one press of a button, and of one notch of a mouse wheel. */
export const ZOOM_STEP = 1.6;
/** A zoom this close to the whole map counts as the whole map. */
const ZOOM_EPSILON = 1e-6;

/** Visits every [longitude, latitude] pair of a GeoJSON coordinate tree. */
function visitPositions(node: unknown, visit: (lon: number, lat: number) => void): void {
  if (!Array.isArray(node)) return;
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    visit(node[0], node[1]);
    return;
  }
  for (const child of node) visitPositions(child, visit);
}

/** The box around every boundary; a collection with no coordinates has an empty box at 0, 0. */
export function geoBounds(geo: GeoCollection): Bounds {
  const bounds: Bounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const feature of geo.features) {
    const geometry = feature.geometry as { coordinates?: unknown } | null;
    visitPositions(geometry?.coordinates, (lon, lat) => {
      bounds.west = Math.min(bounds.west, lon);
      bounds.east = Math.max(bounds.east, lon);
      bounds.south = Math.min(bounds.south, lat);
      bounds.north = Math.max(bounds.north, lat);
    });
  }
  return Number.isFinite(bounds.west) ? bounds : { west: 0, south: 0, east: 0, north: 0 };
}

export const boundsCentre = (b: Bounds): [number, number] => [
  (b.west + b.east) / 2,
  (b.south + b.north) / 2,
];

export const initialView = (bounds: Bounds): MapView => ({
  zoom: MIN_ZOOM,
  center: boundsCentre(bounds),
});

export const isZoomedIn = (view: MapView): boolean => view.zoom > MIN_ZOOM;

export const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * The view with its centre kept so that the shown part lies within the map. At a zoom of 4 the
 * view spans a quarter of the map each way, so the centre can go no nearer an edge than that.
 */
export function keepInside(view: MapView, bounds: Bounds): MapView {
  // Zooming in and out by the same factors rarely lands on exactly 1.
  if (view.zoom < MIN_ZOOM + ZOOM_EPSILON) return initialView(bounds);
  const zoom = Math.min(view.zoom, MAX_ZOOM);
  const halfWidth = (bounds.east - bounds.west) / (2 * zoom);
  const halfHeight = (bounds.north - bounds.south) / (2 * zoom);
  return {
    zoom,
    center: [
      clamp(view.center[0], bounds.west + halfWidth, bounds.east - halfWidth),
      clamp(view.center[1], bounds.south + halfHeight, bounds.north - halfHeight),
    ],
  };
}

/**
 * Zooms in (factor above 1) or out (below 1) so that the point `anchor` stays where it is on the
 * screen: the pointer for the wheel, the middle of the view for the buttons.
 */
export function zoomBy(
  view: MapView,
  factor: number,
  bounds: Bounds,
  anchor: readonly [number, number] = view.center,
): MapView {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const shrink = view.zoom / zoom;
  return keepInside(
    {
      zoom,
      center: [
        anchor[0] + (view.center[0] - anchor[0]) * shrink,
        anchor[1] + (view.center[1] - anchor[1]) * shrink,
      ],
    },
    bounds,
  );
}

/** The share of what is shown that one step of panning moves the map. */
const PAN_STEP = 0.25;

/** Moves the view by `dx` steps east and `dy` steps north. */
export const panBy = (view: MapView, dx: number, dy: number, bounds: Bounds): MapView => {
  const east = ((bounds.east - bounds.west) / view.zoom) * PAN_STEP * dx;
  const north = ((bounds.north - bounds.south) / view.zoom) * PAN_STEP * dy;
  return keepInside({ ...view, center: [view.center[0] + east, view.center[1] + north] }, bounds);
};

const SAME_VIEW_TOLERANCE = 1e-9;

/** Whether two views show the same part of the map. */
export const sameView = (a: MapView, b: MapView): boolean =>
  Math.abs(a.zoom - b.zoom) < SAME_VIEW_TOLERANCE &&
  Math.abs(a.center[0] - b.center[0]) < SAME_VIEW_TOLERANCE &&
  Math.abs(a.center[1] - b.center[1]) < SAME_VIEW_TOLERANCE;

/** The map series' view settings as ECharts reports them. */
export interface SeriesView {
  zoom: number;
  center?: [number, number];
}

/** The view of a series, or `null` while it has no centre. */
export function viewFromSeries(series: SeriesView | undefined): MapView | null {
  return series?.center ? { zoom: series.zoom, center: series.center } : null;
}
