import { useEffect, useState } from 'react';
import { HttpError } from './api';

/** Data published apart from the catalog: it may be loading, not published yet, or broken. */
export type Remote<T> =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T };

/** A file that has not been published yet (404) is a normal state, not an error. */
export async function loadRemote<T>(load: () => Promise<T>): Promise<Remote<T>> {
  try {
    return { status: 'ready', data: await load() };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return { status: 'unavailable' };
    return { status: 'error', error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/** Loads once per page visit; `load` must be the same function on every render. */
export function useRemote<T>(load: () => Promise<T>): Remote<T> {
  const [state, setState] = useState<Remote<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void loadRemote(load).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return state;
}

/** Shares one request between callers. A failure is forgotten, so a retry can succeed. */
export function once<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    if (!promise) {
      promise = load();
      promise.catch(() => {
        promise = null;
      });
    }
    return promise;
  };
}
