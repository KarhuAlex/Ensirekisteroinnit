import { useCallback, useEffect, useState } from 'react';
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

/** How far from the screen an element still counts as near it, so that its data is in time. */
const NEAR_SCREEN = '400px';

/**
 * Tells once an element has come near the screen, and then stays true. Use it to hold back data
 * for something far down a page. Where the browser cannot tell, the element counts as seen.
 */
export function useSeen<T extends Element>(): { ref: (element: T | null) => void; seen: boolean } {
  const [element, setElement] = useState<T | null>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  const ref = useCallback((next: T | null) => setElement(next), []);
  useEffect(() => {
    if (seen || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin: NEAR_SCREEN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, seen]);
  return { ref, seen };
}

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
