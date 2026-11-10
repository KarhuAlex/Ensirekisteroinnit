import type { RegionalIndex, RegionalYear } from '@regs/core';
import { useEffect, useState } from 'react';
import { HttpError, loadRegionalCatalog, loadRegionalYear, type RegionalCatalog } from './api';

export type RegionalState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; error: Error }
  | {
      status: 'ready';
      /** The years this state was loaded for, so a stale state is never read as the current one. */
      key: string;
      index: RegionalIndex;
      years: ReadonlyMap<string, RegionalYear>;
    };

export interface RegionalSource {
  catalog(): Promise<RegionalCatalog>;
  year(catalog: RegionalCatalog, name: string): Promise<RegionalYear>;
}

/** Failures are not cached, so a retry can succeed. */
function remember<T>(promise: Promise<T>, forget: () => void): Promise<T> {
  promise.catch(forget);
  return promise;
}

let catalogPromise: Promise<RegionalCatalog> | null = null;
const yearPromises = new Map<string, Promise<RegionalYear>>();

const browserSource: RegionalSource = {
  catalog() {
    catalogPromise ??= remember(loadRegionalCatalog(), () => (catalogPromise = null));
    return catalogPromise;
  },
  year({ release }, name) {
    const key = `${release}/${name}`;
    let promise = yearPromises.get(key);
    if (!promise) {
      promise = remember(loadRegionalYear(release, name), () => yearPromises.delete(key));
      yearPromises.set(key, promise);
    }
    return promise;
  },
};

export const yearsKey = (wanted: readonly string[]): string => wanted.join(',');

/** Loads the wanted years that the data has; years it does not have are skipped. */
export async function loadRegionalState(
  wanted: readonly string[],
  source: RegionalSource = browserSource,
): Promise<RegionalState> {
  try {
    const catalog = await source.catalog();
    const names = wanted.filter((year) => catalog.index.years.includes(year));
    const loaded = await Promise.all(names.map((name) => source.year(catalog, name)));
    return {
      status: 'ready',
      key: yearsKey(wanted),
      index: catalog.index,
      years: new Map(names.map((name, i) => [name, loaded[i] as RegionalYear])),
    };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return { status: 'unavailable' };
    return { status: 'error', error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/** A ready state only counts for the years it was loaded for; for any other it is still loading. */
export function currentRegionalState(state: RegionalState, key: string): RegionalState {
  return state.status === 'ready' && state.key !== key ? { status: 'loading' } : state;
}

/** The regional data is split by year, so a page asks only for the years it shows. */
export function useRegional(wanted: readonly string[]): RegionalState {
  const [state, setState] = useState<RegionalState>({ status: 'loading' });
  const key = yearsKey(wanted);

  useEffect(() => {
    let cancelled = false;
    void loadRegionalState(key === '' ? [] : key.split(',')).then(
      (next) => !cancelled && setState(next),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  return currentRegionalState(state, key);
}
