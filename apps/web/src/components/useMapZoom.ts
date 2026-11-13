import { useCallback, useMemo, useState } from 'react';
import type { GeoCollection } from '../data/geo';
import {
  ZOOM_STEP,
  geoBounds,
  initialView,
  keepInside,
  panBy,
  zoomBy,
  type MapView,
} from '../lib/mapView';

/** The part of a map that is shown. Another set of boundaries starts again from the whole map. */
export function useMapZoom(geo: GeoCollection) {
  const bounds = useMemo(() => geoBounds(geo), [geo]);
  const [view, setView] = useState<MapView>(() => initialView(bounds));
  const [viewFor, setViewFor] = useState(geo);
  if (viewFor !== geo) {
    setViewFor(geo);
    setView(initialView(bounds));
  }

  const zoom = useCallback(
    (factor: number, anchor?: readonly [number, number]) =>
      setView((current) => zoomBy(current, factor, bounds, anchor)),
    [bounds],
  );
  const zoomIn = useCallback(() => zoom(ZOOM_STEP), [zoom]);
  const zoomOut = useCallback(() => zoom(1 / ZOOM_STEP), [zoom]);
  const pan = useCallback(
    (dx: number, dy: number) => setView((current) => panBy(current, dx, dy, bounds)),
    [bounds],
  );
  const reset = useCallback(() => setView(initialView(bounds)), [bounds]);
  /** Takes a view the map itself changed, such as by dragging, and keeps it on the map. */
  const adopt = useCallback((next: MapView) => setView(keepInside(next, bounds)), [bounds]);

  return { view, zoom, zoomIn, zoomOut, pan, reset, adopt };
}
