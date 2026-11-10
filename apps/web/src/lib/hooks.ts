import { useEffect, useState } from 'react';
import type { RangeId } from './stats';

/** Subscribes to a CSS media query (for values that must reach JS, such as chart sizes). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export const useReducedMotion = (): boolean => useMediaQuery('(prefers-reduced-motion: reduce)');
export const useNarrow = (): boolean => useMediaQuery('(max-width: 640px)');

/** What charts over the same months share: the visible range and the month under the pointer. */
export interface Timeline {
  range: RangeId;
  setRange: (range: RangeId) => void;
  hover: number | null;
  setHover: (index: number | null) => void;
  /** The month shown while nothing is hovered; `null` means the last one. */
  rest: number | null;
}

/** `rest` is the month to show at rest, for data that ends before the last month. */
export function useTimeline(rest: number | null = null): Timeline {
  const [range, setRange] = useState<RangeId>('all');
  const [hover, setHover] = useState<number | null>(null);
  return { range, setRange, hover, setHover, rest };
}

/** The month under the pointer, or the resting month, kept inside the `count` months. */
export const focusIndex = ({ hover, rest }: Timeline, count: number): number =>
  Math.min(hover ?? rest ?? count - 1, count - 1);
