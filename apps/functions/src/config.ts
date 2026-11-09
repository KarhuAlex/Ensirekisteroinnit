import {
  AcsEmailNotifier,
  BlobStore,
  TraficomPxWebAdapter,
  type Notifier,
  type ObjectStore,
  type SourceAdapter,
} from '@regs/ingest';

export interface Runtime {
  adapter: SourceAdapter;
  rawStore: ObjectStore;
  publishedStore: ObjectStore;
  notifier?: Notifier;
}

/**
 * Composition root. In Azure the data account is reached through the function app's managed
 * identity (`DATA_STORAGE_ACCOUNT_URL`); locally a connection string works, for example for
 * Azurite. To change the data source, change the adapter below.
 */
/** Emails are sent only when all three settings are present; the recipient is never in the repo. */
function createNotifier(env: NodeJS.ProcessEnv): Notifier | undefined {
  const endpoint = env['ACS_EMAIL_ENDPOINT'];
  const from = env['NOTIFY_EMAIL_FROM'];
  const to = (env['NOTIFY_EMAIL_TO'] ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
  return endpoint && from && to.length > 0
    ? new AcsEmailNotifier({ endpoint, from, to })
    : undefined;
}

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
  const notifier = createNotifier(env);
  return {
    adapter: new TraficomPxWebAdapter(),
    rawStore: BlobStore.connect({ ...connection, container: env['RAW_CONTAINER'] ?? 'raw' }),
    publishedStore: BlobStore.connect({
      ...connection,
      container: env['PUBLISHED_CONTAINER'] ?? 'published',
    }),
    ...(notifier ? { notifier } : {}),
  };
}

let cached: Runtime | undefined;

/** Built once per worker, so clients and credentials are reused across runs. */
export function getRuntime(): Runtime {
  cached ??= createRuntime();
  return cached;
}
