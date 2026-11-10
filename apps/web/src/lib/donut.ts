import type { FuelGroupId } from '@regs/core';
import { STACK_ORDER } from './stats';

/** A ring is drawn on a path 100 units long, so a share in percent is also its length. */
export interface DonutSegment {
  group: FuelGroupId;
  /** Where the segment starts along the path. */
  start: number;
  /** The visible length, a little shorter than the share so neighbours do not touch. */
  dash: number;
  index: number;
}

const GAP = 0.6;
/** Segments this small are left whole; a gap would swallow them. */
const MIN_FOR_GAP = 2;
const MIN_DASH = 0.01;

export function donutSegments(mix: Record<FuelGroupId, number>): DonutSegment[] {
  let start = 0;
  return STACK_ORDER.filter((group) => mix[group] > 0).map((group, index) => {
    const share = mix[group];
    const segment = {
      group,
      start,
      dash: Math.max(share > MIN_FOR_GAP ? share - GAP : share, MIN_DASH),
      index,
    };
    start += share;
    return segment;
  });
}
