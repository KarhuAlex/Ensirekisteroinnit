import { useEffect, useState } from 'react';
import { HttpError } from './api';

/**
 * State of data fetched in the browser. A load starts as `loading` and settles as `unavailable`,
 * `error` or `ready`; a different load starts again from `loading`. `unavailable` means the file
 * is not published yet, which pages word as a normal state. `error` is any other failure.
 */
export type Remote<T> =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T };

export const LOADING: Remote<never> = { status: 'loading' };

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/** The data once ready, else null. */
export const dataOf = <T>(remote: Remote<T>): T | null =>
  remote.status === 'ready' ? remote.data : null;

/** True for `error` and `unavailable`. Use it where a missing file can only mean a broken release. */
export const hasFailed = (remote: Remote<unknown>): boolean =>
  remote.status === 'error' || remote.status === 'unavailable';

/** Runs `load` and returns its settled state. A 404 means the file is not published yet. */
export async function loadRemote<T>(load: () => Promise<T>): Promise<Remote<T>> {
  try {
    return { status: 'ready', data: await load() };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return { status: 'unavailable' };
    return { status: 'error', error: toError(error) };
  }
}

/** A settled state together with the load that produced it. */
export interface Settled<T> {
  load: () => Promise<T>;
  state: Remote<T>;
}

/**
 * The state to show for `load`. A state settled by another load is stale and reads as loading, so
 * a page never shows the data it asked for before. A held-back load (`null`) is loading too.
 */
export function stateOfLoad<T>(
  settled: Settled<T> | null,
  load: (() => Promise<T>) | null,
): Remote<T> {
  return load !== null && settled?.load === load ? settled.state : LOADING;
}

/**
 * Runs `load` and tracks its state. A new `load` function means new data is wanted, so keep it the
 * same function until then: define it at module level or memoize it. `null` holds the load back.
 */
export function useRemote<T>(load: (() => Promise<T>) | null): Remote<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    void loadRemote(load).then((state) => {
      if (!cancelled) setSettled({ load, state });
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return stateOfLoad(settled, load);
}

/**
 * Calls with the same `keyOf` key share one request. A failed request is forgotten, so the next
 * call with that key tries again.
 */
export function oncePerKey<A extends readonly unknown[], T>(
  load: (...args: A) => Promise<T>,
  keyOf: (...args: A) => string,
): (...args: A) => Promise<T> {
  const promises = new Map<string, Promise<T>>();
  return (...args) => {
    const key = keyOf(...args);
    let promise = promises.get(key);
    if (!promise) {
      const started = load(...args);
      started.catch(() => {
        if (promises.get(key) === started) promises.delete(key);
      });
      promises.set(key, started);
      promise = started;
    }
    return promise;
  };
}

/** Every caller shares one request. A failed request is forgotten, so the next call tries again. */
export function once<T>(load: () => Promise<T>): () => Promise<T> {
  return oncePerKey(load, () => '');
}
