export interface PutOptions {
  contentType?: string;
  cacheControl?: string;
  compress?: boolean;
}

/** Minimal object-store abstraction so the pipeline runs against disk, Azurite or Azure Blob. */
export interface ObjectStore {
  put(path: string, body: string, options?: PutOptions): Promise<void>;
  /** Returns `null` when the object does not exist. */
  get(path: string): Promise<string | null>;
}
