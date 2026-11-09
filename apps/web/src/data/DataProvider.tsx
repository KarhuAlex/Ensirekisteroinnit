import type { EntitySeries, EntitySummary, Manifest } from '@regs/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { loadCatalog, loadSeries, type Catalog } from './api';

type State =
  { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; catalog: Catalog };

export interface CatalogValue {
  manifest: Manifest;
  entities: EntitySummary[];
  byId: ReadonlyMap<string, EntitySummary>;
  getSeries: (id: string) => Promise<EntitySeries>;
}

interface Ctx {
  state: State;
  reload: () => void;
  value: CatalogValue | null;
}

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const seriesCache = useRef(new Map<string, Promise<EntitySeries>>());

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    seriesCache.current.clear();
    loadCatalog().then(
      (catalog) => !cancelled && setState({ status: 'ready', catalog }),
      (error: unknown) =>
        !cancelled &&
        setState({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const release = state.status === 'ready' ? state.catalog.release : null;
  const getSeries = useCallback(
    (id: string) => {
      if (!release) return Promise.reject(new Error('Catalog not loaded'));
      let promise = seriesCache.current.get(id);
      if (!promise) {
        promise = loadSeries(release, id);
        // Failures are not cached, so a retry can succeed.
        promise.catch(() => seriesCache.current.delete(id));
        seriesCache.current.set(id, promise);
      }
      return promise;
    },
    [release],
  );

  const value = useMemo<CatalogValue | null>(() => {
    if (state.status !== 'ready') return null;
    const { manifest, entities } = state.catalog;
    return { manifest, entities, byId: new Map(entities.map((e) => [e.id, e])), getSeries };
  }, [state, getSeries]);

  const ctx = useMemo<Ctx>(
    () => ({ state, reload: () => setAttempt((n) => n + 1), value }),
    [state, value],
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

export function useEntitySeries(id: string | undefined): {
  series: EntitySeries | null;
  error: Error | null;
} {
  const { getSeries, byId } = useCatalog();
  const [result, setResult] = useState<{
    id: string;
    series: EntitySeries | null;
    error: Error | null;
  }>();

  useEffect(() => {
    if (!id || !byId.has(id)) return;
    let cancelled = false;
    getSeries(id).then(
      (series) => !cancelled && setResult({ id, series, error: null }),
      (error: unknown) =>
        !cancelled &&
        setResult({
          id,
          series: null,
          error: error instanceof Error ? error : new Error(String(error)),
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [id, getSeries, byId]);

  if (!id || result?.id !== id) return { series: null, error: null };
  return { series: result.series, error: result.error };
}
