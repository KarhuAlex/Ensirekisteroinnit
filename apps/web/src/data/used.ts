import type { EntitySummary, Matrix } from '@regs/core';
import { loadCatalog, loadMatrix, type Catalog } from './api';
import { once, useRemote, type Remote } from './remote';

const FOLDER = 'used';

export interface UsedData {
  matrix: Matrix;
  byId: ReadonlyMap<string, EntitySummary>;
}

export interface UsedSource {
  catalog(): Promise<Catalog>;
  matrix(catalog: Catalog): Promise<Matrix>;
}

const browserSource: UsedSource = {
  catalog: () => loadCatalog(FOLDER),
  matrix: ({ release, manifest }) => loadMatrix(release, manifest.months, FOLDER),
};

export async function loadUsed(source: UsedSource = browserSource): Promise<UsedData> {
  const catalog = await source.catalog();
  const matrix = await source.matrix(catalog);
  return { matrix, byId: new Map(catalog.entities.map((e) => [e.id, e])) };
}

const loadUsedOnce = once(() => loadUsed());

/** Cars imported used are published apart from the national data and loaded only when asked for. */
export const useUsedImports = (): Remote<UsedData> => useRemote(loadUsedOnce);
