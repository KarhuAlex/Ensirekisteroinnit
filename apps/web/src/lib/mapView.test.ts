import { describe, expect, it } from 'vitest';
import type { GeoCollection } from '../data/geo';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  geoBounds,
  initialView,
  isZoomedIn,
  keepInside,
  panBy,
  sameView,
  viewFromSeries,
  zoomBy,
} from './mapView';

const geo: GeoCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: '1', name: 'A' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [20, 60],
            [30, 60],
            [30, 70],
            [20, 60],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: '2', name: 'B' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [25, 59],
              [26, 62],
              [32, 61],
            ],
          ],
        ],
      },
    },
  ],
};
const bounds = geoBounds(geo);

describe('geoBounds', () => {
  it('covers every polygon of every feature', () => {
    expect(bounds).toEqual({ west: 20, south: 59, east: 32, north: 70 });
  });
});

describe('geoBounds, without boundaries', () => {
  it('is an empty box rather than infinite', () => {
    expect(geoBounds({ type: 'FeatureCollection', features: [] })).toEqual({
      west: 0,
      south: 0,
      east: 0,
      north: 0,
    });
  });
});

describe('zoomBy', () => {
  it('starts out and shows the whole map', () => {
    const view = initialView(bounds);
    expect(view).toEqual({ zoom: MIN_ZOOM, center: [26, 64.5] });
    expect(isZoomedIn(view)).toBe(false);
  });

  it('zooms in by a step and out again to the whole map', () => {
    const closer = zoomBy(initialView(bounds), ZOOM_STEP, bounds);
    expect(closer.zoom).toBeCloseTo(ZOOM_STEP);
    expect(isZoomedIn(closer)).toBe(true);
    expect(zoomBy(closer, 1 / ZOOM_STEP, bounds)).toEqual(initialView(bounds));
  });

  it('returns to exactly the whole map after the same number of steps in and out', () => {
    let view = initialView(bounds);
    for (let i = 0; i < 3; i++) view = zoomBy(view, ZOOM_STEP, bounds);
    for (let i = 0; i < 3; i++) view = zoomBy(view, 1 / ZOOM_STEP, bounds);
    expect(view).toEqual(initialView(bounds));
    expect(isZoomedIn(view)).toBe(false);
  });

  it('does not zoom out past the whole map or in past the limit', () => {
    expect(zoomBy(initialView(bounds), 1 / ZOOM_STEP, bounds).zoom).toBe(MIN_ZOOM);
    expect(zoomBy({ zoom: MAX_ZOOM, center: [26, 64] }, ZOOM_STEP, bounds).zoom).toBe(MAX_ZOOM);
  });
});

describe('keepInside', () => {
  it('pulls a centre that was dragged off the map back until the view fits the map', () => {
    expect(keepInside({ zoom: 4, center: [50, 10] }, bounds).center).toEqual([30.5, 60.375]);
  });

  it('leaves a centre on the map alone', () => {
    const view = { zoom: 4, center: [25, 64] as [number, number] };
    expect(keepInside(view, bounds)).toEqual(view);
  });

  it('recentres the whole map, which cannot be panned', () => {
    expect(keepInside({ zoom: 1, center: [30, 60] }, bounds)).toEqual(initialView(bounds));
  });
});

describe('viewFromSeries', () => {
  it('takes the zoom and centre of the series', () => {
    expect(viewFromSeries({ zoom: 3, center: [25, 64] })).toEqual({ zoom: 3, center: [25, 64] });
  });

  it('gives nothing when the series has no centre', () => {
    expect(viewFromSeries({ zoom: 3 })).toBeNull();
    expect(viewFromSeries(undefined)).toBeNull();
  });
});

describe('zoomBy around a point', () => {
  const whole = initialView(bounds);

  it('keeps the point under the pointer where it was', () => {
    const anchor: [number, number] = [30, 68];
    const closer = zoomBy(whole, 2, bounds, anchor);
    // The point is the same share of the way from the centre to the edge as before.
    const before = (anchor[0] - whole.center[0]) * whole.zoom;
    const after = (anchor[0] - closer.center[0]) * closer.zoom;
    expect(after).toBeCloseTo(before);
  });

  it('zooms toward the middle without an anchor', () => {
    expect(zoomBy(whole, 2, bounds).center).toEqual(whole.center);
  });

  it('keeps the shown part on the map when the point is by an edge', () => {
    const closer = zoomBy(whole, 4, bounds, [32, 70]);
    expect(closer.center).toEqual([30.5, 68.625]);
  });

  it('zooms out to the whole map from anywhere', () => {
    const closer = zoomBy(whole, 4, bounds, [31, 69]);
    expect(zoomBy(closer, 0.1, bounds, [20, 59])).toEqual(whole);
  });
});

describe('panBy', () => {
  const zoomed: { zoom: number; center: [number, number] } = { zoom: 2, center: [26, 64.5] };

  it('moves by a quarter of what is shown', () => {
    expect(panBy(zoomed, 1, 0, bounds).center).toEqual([27.5, 64.5]);
    expect(panBy(zoomed, 0, -1, bounds).center).toEqual([26, 64.5 - 1.375]);
  });

  it('stops at the edge of the map', () => {
    expect(panBy({ zoom: 2, center: [29, 64.5] }, 1, 0, bounds).center[0]).toBe(29);
  });

  it('leaves the whole map where it is', () => {
    expect(panBy(initialView(bounds), 1, 1, bounds)).toEqual(initialView(bounds));
  });
});

describe('sameView', () => {
  it('tells views that show the same part from ones that do not', () => {
    expect(sameView({ zoom: 2, center: [25, 64] }, { zoom: 2, center: [25, 64] })).toBe(true);
    expect(sameView({ zoom: 2, center: [25, 64] }, { zoom: 2, center: [25, 65] })).toBe(false);
    expect(sameView({ zoom: 2, center: [25, 64] }, { zoom: 3, center: [25, 64] })).toBe(false);
  });
});
