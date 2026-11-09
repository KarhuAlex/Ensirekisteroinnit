import { useEffect, useState } from 'react';

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
