import {
  BlobStore,
  TraficomPxWebAdapter,
  type ObjectStore,
  type SourceAdapter,
} from '@regs/ingest';

export interface Runtime {
  adapter: SourceAdapter;
  rawStore: ObjectStore;
  publishedStore: ObjectStore;
}

/**
 * Composition root. In Azure the data account is reached through the function app's managed
 * identity (`DATA_STORAGE_ACCOUNT_URL`); locally a connection string works, for example for
 * Azurite. To change the data source, change the adapter below.
 */
function createRuntime(env: NodeJS.ProcessEnv = process.env): Runtime {
  const accountUrl = env['DATA_STORAGE_ACCOUNT_URL'];
  const connectionString = env['DATA_STORAGE_CONNECTION_STRING'];
  if (!accountUrl && !connectionString) {
    throw new Error(
      'Set DATA_STORAGE_ACCOUNT_URL (Azure) or DATA_STORAGE_CONNECTION_STRING (local).',
    );
  }
  const connection = {
    ...(accountUrl ? { accountUrl } : {}),
    ...(connectionString ? { connectionString } : {}),
  };
  return {
    adapter: new TraficomPxWebAdapter(),
    rawStore: BlobStore.connect({ ...connection, container: env['RAW_CONTAINER'] ?? 'raw' }),
    publishedStore: BlobStore.connect({
      ...connection,
      container: env['PUBLISHED_CONTAINER'] ?? 'published',
    }),
  };
}

let cached: Runtime | undefined;

/** Built once per worker, so clients and credentials are reused across runs. */
export function getRuntime(): Runtime {
  cached ??= createRuntime();
  return cached;
}
