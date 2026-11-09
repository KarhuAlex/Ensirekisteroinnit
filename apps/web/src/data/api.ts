import type { EntitySeries, EntitySummary, LatestPointer, Manifest, Matrix } from '@regs/core';

/** Root of the published data. Production builds set VITE_DATA_BASE_URL to the storage endpoint. */
export const DATA_BASE = (import.meta.env.VITE_DATA_BASE_URL || '/data').replace(/\/+$/, '');

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`Request failed (${status}): ${url}`);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(res.status, url);
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

export function checkMatrixMonths(matrix: Matrix, months: readonly string[]): Matrix {
  const same =
    matrix.months.length === months.length && matrix.months.every((m, i) => m === months[i]);
  if (!same) throw new Error('matrix.json and manifest.json list different months');
  return matrix;
}

export async function loadMatrix(release: string, months: readonly string[]): Promise<Matrix> {
  return checkMatrixMonths(await getJson<Matrix>(`${DATA_BASE}/${release}/matrix.json`), months);
}

export function loadSeries(release: string, id: string): Promise<EntitySeries> {
  return getJson<EntitySeries>(`${DATA_BASE}/${release}/entities/${encodeURIComponent(id)}.json`);
}
