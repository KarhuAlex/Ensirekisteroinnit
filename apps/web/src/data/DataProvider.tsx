import type { EntitySeries, EntitySummary, Manifest, Matrix } from '@regs/core';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadCatalog, loadMatrix, loadSeries, type Catalog } from './api';
import { once, oncePerKey, useRemote, type Remote } from './remote';

export interface CatalogValue {
  manifest: Manifest;
  entities: EntitySummary[];
  byId: ReadonlyMap<string, EntitySummary>;
  getSeries: (id: string) => Promise<EntitySeries>;
  getMatrix: () => Promise<Matrix>;
}

/** Everything read from one release. The caches belong to the release, so a reload starts empty. */
export function catalogValue({ release, manifest, entities }: Catalog): CatalogValue {
  return {
    manifest,
    entities,
    byId: new Map(entities.map((e) => [e.id, e])),
    getSeries: oncePerKey(
      (id: string) => loadSeries(release, id),
      (id) => id,
    ),
    getMatrix: once(() => loadMatrix(release, manifest.months)),
  };
}

/** A fresh load of the catalog. `useRemote` sees a new function, so a reload starts from loading. */
const newCatalogLoad = () => async (): Promise<CatalogValue> => catalogValue(await loadCatalog());

interface Ctx {
  state: Remote<CatalogValue>;
  reload: () => void;
  /** The catalog once it is ready, for the parts of the shell that render around the data gate. */
  value: CatalogValue | null;
}

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [load, setLoad] = useState(newCatalogLoad);
  const state = useRemote(load);
  const reload = useCallback(() => setLoad(newCatalogLoad), []);

  const ctx = useMemo<Ctx>(
    () => ({ state, reload, value: state.status === 'ready' ? state.data : null }),
    [state, reload],
  );
  return <DataContext.Provider value={ctx}>{children}</DataContext.Provider>;
}

export function useDataState(): Ctx {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataState must be used inside DataProvider');
  return ctx;
}

/** Only call this below the data gate in the layout, where the catalog is loaded. */
export function useCatalog(): CatalogValue {
  const { value } = useDataState();
  if (!value) throw new Error('Catalog is not loaded yet');
  return value;
}

/** The monthly series of one make or model. An id missing from the catalog is never fetched. */
export function useEntitySeries(id: string | undefined): Remote<EntitySeries> {
  const { getSeries, byId } = useCatalog();
  const known = id !== undefined && byId.has(id) ? id : null;
  const load = useMemo(() => (known === null ? null : () => getSeries(known)), [getSeries, known]);
  return useRemote(load);
}

/** Loaded on demand because it is far larger than the catalog; `enabled` holds the load back. */
export function useMatrix(enabled = true): Remote<Matrix> {
  const { getMatrix } = useCatalog();
  return useRemote(enabled ? getMatrix : null);
}
