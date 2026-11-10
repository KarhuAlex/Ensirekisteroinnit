import { useMemo } from 'react';
import { useCatalog } from './DataProvider';

/** Releases built before corporate groups existed have none, so the level is not offered. */
export function useHasCorporateGroups(): boolean {
  const { entities } = useCatalog();
  return useMemo(() => entities.some((e) => e.kind === 'corporategroup'), [entities]);
}
