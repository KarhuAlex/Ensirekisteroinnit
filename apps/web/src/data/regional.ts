import type { RegionalYear } from '@regs/core';
import type { RegionalView } from '../lib/regionalRanking';
import { loadRegionalCatalog, loadRegionalYear, type RegionalCatalog } from './api';
import { once, oncePerKey, useRemote, type Remote } from './remote';

export interface RegionalSource {
  catalog(): Promise<RegionalCatalog>;
  year(catalog: RegionalCatalog, name: string): Promise<RegionalYear>;
}

const loadYearOnce = oncePerKey(loadRegionalYear, (release, name) => `${release}/${name}`);

const browserSource: RegionalSource = {
  catalog: once(loadRegionalCatalog),
  year: ({ release }, name) => loadYearOnce(release, name),
};

/** Loads the wanted years that the data has; years it does not have are skipped. */
export async function loadRegional(
  wanted: readonly string[],
  source: RegionalSource = browserSource,
): Promise<RegionalView> {
  const catalog = await source.catalog();
  const names = wanted.filter((year) => catalog.index.years.includes(year));
  const loaded = await Promise.all(names.map((name) => source.year(catalog, name)));
  return {
    index: catalog.index,
    years: new Map(names.map((name, i) => [name, loaded[i] as RegionalYear])),
  };
}

// A handful of year sets at most, so the loads are kept for the page visit.
const loads = new Map<string, () => Promise<RegionalView>>();

/**
 * The load for a set of years. Equal year lists get the same function, so `useRemote` treats them
 * as one request however often the array is rebuilt.
 */
export function regionalLoad(wanted: readonly string[]): () => Promise<RegionalView> {
  const key = wanted.join(',');
  let load = loads.get(key);
  if (!load) {
    const years = [...wanted];
    load = () => loadRegional(years);
    loads.set(key, load);
  }
  return load;
}

/** The regional data is split by year, so a page asks only for the years it shows. */
export const useRegional = (wanted: readonly string[]): Remote<RegionalView> =>
  useRemote(regionalLoad(wanted));
