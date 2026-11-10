import type { ObjectStore, PutOptions } from './types.js';

/** A view of a store under a path prefix, so several datasets can share one container. */
export class PrefixedStore implements ObjectStore {
  constructor(
    private readonly inner: ObjectStore,
    private readonly prefix: string,
  ) {}

  put(path: string, body: string, options?: PutOptions): Promise<void> {
    return this.inner.put(`${this.prefix}${path}`, body, options);
  }

  get(path: string): Promise<string | null> {
    return this.inner.get(`${this.prefix}${path}`);
  }
}
