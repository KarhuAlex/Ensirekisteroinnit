import type {
  EntitySeries,
  EntitySummary,
  LatestPointer,
  Manifest,
  Matrix,
  RegionalIndex,
  RegionalYear,
} from '@regs/core';

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

/** A dataset published beside the national one lives in a folder of its own, such as `used`. */
const folderUrl = (folder: string): string => (folder ? `${DATA_BASE}/${folder}` : DATA_BASE);

export async function loadCatalog(folder = ''): Promise<Catalog> {
  const latest = await getJson<LatestPointer>(`${folderUrl(folder)}/latest.json`);
  const base = `${folderUrl(folder)}/${latest.release}`;
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

export async function loadMatrix(
  release: string,
  months: readonly string[],
  folder = '',
): Promise<Matrix> {
  const matrix = await getJson<Matrix>(`${folderUrl(folder)}/${release}/matrix.json`);
  return checkMatrixMonths(matrix, months);
}

export function loadSeries(release: string, id: string): Promise<EntitySeries> {
  return getJson<EntitySeries>(`${DATA_BASE}/${release}/entities/${encodeURIComponent(id)}.json`);
}

export interface RegionalCatalog {
  release: string;
  index: RegionalIndex;
}

export async function loadRegionalCatalog(): Promise<RegionalCatalog> {
  const latest = await getJson<LatestPointer>(`${DATA_BASE}/regional/latest.json`);
  const index = await getJson<RegionalIndex>(`${DATA_BASE}/regional/${latest.release}/index.json`);
  return { release: latest.release, index };
}

export function loadRegionalYear(release: string, year: string): Promise<RegionalYear> {
  return getJson<RegionalYear>(`${DATA_BASE}/regional/${release}/years/${year}.json`);
}
