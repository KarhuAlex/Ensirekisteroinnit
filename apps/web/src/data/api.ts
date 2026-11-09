import type { EntitySeries, EntitySummary, LatestPointer, Manifest } from '@regs/core';

/** Root of the published data. Production builds set VITE_DATA_BASE_URL to the storage endpoint. */
export const DATA_BASE = (import.meta.env.VITE_DATA_BASE_URL || '/data').replace(/\/+$/, '');

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return (await res.json()) as T;
}

export interface Catalog {
  release: string;
  manifest: Manifest;
  entities: EntitySummary[];
}

export async function loadCatalog(): Promise<Catalog> {
  const latest = await getJson<LatestPointer>(`${DATA_BASE}/latest.json`);
  const base = `${DATA_BASE}/${latest.release}`;
  const [manifest, entities] = await Promise.all([
    getJson<Manifest>(`${base}/manifest.json`),
    getJson<EntitySummary[]>(`${base}/entities.json`),
  ]);
  return { release: latest.release, manifest, entities };
}

export function loadSeries(release: string, id: string): Promise<EntitySeries> {
  return getJson<EntitySeries>(`${DATA_BASE}/${release}/entities/${encodeURIComponent(id)}.json`);
}
