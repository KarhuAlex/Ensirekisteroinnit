import {
  AcsEmailNotifier,
  BlobStore,
  PrefixedStore,
  regionalPipeline,
  TraficomPxWebAdapter,
  TraficomRegionalAdapter,
  TraficomUsedImportAdapter,
  usedImportsPipeline,
  type Notifier,
  type ObjectStore,
  type Pipeline,
  type PipelineOptions,
  type SourceAdapter,
} from '@regs/ingest';
import type { Dataset, RegionalDataset } from '@regs/core';

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
/** Emails go out only when all three settings are set. The recipient lives in app settings, never in the repo. */
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

export interface RegionalRuntime {
  pipeline: Pipeline<RegionalDataset>;
  options: PipelineOptions;
}

/** The regional dataset shares the containers with the national one under its own prefixes. */
export function getRegionalRuntime(): RegionalRuntime {
  const { rawStore, publishedStore, notifier } = getRuntime();
  const adapter = new TraficomRegionalAdapter({
    cache: new PrefixedStore(rawStore, 'regional-cache/'),
  });
  return {
    pipeline: regionalPipeline(adapter),
    options: {
      rawStore: new PrefixedStore(rawStore, 'regional/'),
      publishedStore: new PrefixedStore(publishedStore, 'regional/'),
      ...(notifier ? { notifier } : {}),
    },
  };
}

export interface UsedImportsRuntime {
  pipeline: Pipeline<Dataset>;
  options: PipelineOptions;
}

/** Cars imported used are published beside the national data, under their own prefix. */
export function getUsedImportsRuntime(): UsedImportsRuntime {
  const { rawStore, publishedStore, notifier } = getRuntime();
  return {
    pipeline: usedImportsPipeline(new TraficomUsedImportAdapter()),
    options: {
      rawStore: new PrefixedStore(rawStore, 'used/'),
      publishedStore: new PrefixedStore(publishedStore, 'used/'),
      ...(notifier ? { notifier } : {}),
    },
  };
}
