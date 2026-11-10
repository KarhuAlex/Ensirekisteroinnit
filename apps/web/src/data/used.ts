import type { EntitySummary, Matrix } from '@regs/core';
import { useEffect, useState } from 'react';
import { HttpError, loadCatalog, loadMatrix, type Catalog } from './api';

const FOLDER = 'used';

export type UsedState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; matrix: Matrix; byId: ReadonlyMap<string, EntitySummary> };

export interface UsedSource {
  catalog(): Promise<Catalog>;
  matrix(catalog: Catalog): Promise<Matrix>;
}

/** Failures are not cached, so a retry can succeed. */
function remember<T>(promise: Promise<T>, forget: () => void): Promise<T> {
  promise.catch(forget);
  return promise;
}

let catalogPromise: Promise<Catalog> | null = null;
let matrixPromise: Promise<Matrix> | null = null;

const browserSource: UsedSource = {
  catalog() {
    catalogPromise ??= remember(loadCatalog(FOLDER), () => (catalogPromise = null));
    return catalogPromise;
  },
  matrix({ release, manifest }) {
    matrixPromise ??= remember(loadMatrix(release, manifest.months, FOLDER), () => {
      matrixPromise = null;
    });
    return matrixPromise;
  },
};

export async function loadUsedState(source: UsedSource = browserSource): Promise<UsedState> {
  try {
    const catalog = await source.catalog();
    const matrix = await source.matrix(catalog);
    return {
      status: 'ready',
      matrix,
      byId: new Map(catalog.entities.map((e) => [e.id, e])),
    };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return { status: 'unavailable' };
    return { status: 'error', error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/** Cars imported used are published apart from the national data and loaded only when asked for. */
export function useUsedImports(): UsedState {
  const [state, setState] = useState<UsedState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void loadUsedState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
