import type { AreaRow } from './regionalRanking';
import { FUEL_GROUP_IDS } from '@regs/core';
import type { AreaMetric, ReviewState } from './reviewState';

/** The number a metric puts on the map and in the sort order; `null` means no value. */
export function metricValue(row: AreaRow, metric: AreaMetric): number | null {
  if (!row.reliable && metric !== 'count') return null;
  switch (metric) {
    case 'share':
      return row.share;
    case 'index':
      return row.index;
    case 'count':
      return row.count;
    case 'change':
      return row.shareChange;
  }
}

/** Index and change are centred on no difference, so the map colours them in two directions. */
export const isDiverging = (metric: AreaMetric): boolean =>
  metric === 'index' || metric === 'change';

export const divergingCentre = (metric: AreaMetric): number => (metric === 'index' ? 100 : 0);

export interface ColourScale {
  min: number;
  max: number;
}

/** A scale that covers the values; diverging scales are symmetric around their centre. */
export function colourScale(values: readonly (number | null)[], metric: AreaMetric): ColourScale {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) return { min: 0, max: 1 };
  if (!isDiverging(metric)) return { min: 0, max: Math.max(...present, Number.EPSILON) };
  const centre = divergingCentre(metric);
  const widest = Math.max(...present.map((v) => Math.abs(v - centre)), Number.EPSILON);
  // An index cannot go below zero, so its scale stops at 0 to 200 and larger values saturate.
  const reach = metric === 'index' ? Math.min(widest, centre) : widest;
  return { min: centre - reach, max: centre + reach };
}

/**
 * Without a make, model or fuel to narrow by, every area's share is all cars of all cars, which is
 * always 100 %. Only the count says anything then.
 */
export function isUnnarrowed(state: Pick<ReviewState, 'entity' | 'fuels'>): boolean {
  return state.entity === null && state.fuels.length === FUEL_GROUP_IDS.length;
}

export function effectiveMetric(state: ReviewState): AreaMetric {
  return isUnnarrowed(state) ? 'count' : state.areaMetric;
}
