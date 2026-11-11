import {
  AcsEmailNotifier,
  BlobStore,
  fleetPipeline,
  PrefixedStore,
  pricesPipeline,
  regionalPipeline,
  StatFinFuelPriceAdapter,
  stockPipeline,
  TraficomFleetAdapter,
  TraficomPxWebAdapter,
  TraficomRegionalAdapter,
  TraficomStockAdapter,
  TraficomUsedImportAdapter,
  usedImportsPipeline,
  type Notifier,
  type ObjectStore,
  type Pipeline,
  type PipelineOptions,
  type SourceAdapter,
} from '@regs/ingest';
import type {
  Dataset,
  FleetDataset,
  FuelPriceDataset,
  RegionalDataset,
  StockDataset,
} from '@regs/core';

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

/** A dataset published beside the national one, with the stores it writes to. */
export interface PipelineRuntime<T> {
  pipeline: Pipeline<T>;
  options: PipelineOptions;
}

/** A dataset shares the containers with the national one and keeps its files under a prefix. */
function underPrefix<T>(prefix: string, pipeline: Pipeline<T>): PipelineRuntime<T> {
  const { rawStore, publishedStore, notifier } = getRuntime();
  return {
    pipeline,
    options: {
      rawStore: new PrefixedStore(rawStore, prefix),
      publishedStore: new PrefixedStore(publishedStore, prefix),
      ...(notifier ? { notifier } : {}),
    },
  };
}

/** The regional data keeps its progress per area, outside the published files. */
export function getRegionalRuntime(): PipelineRuntime<RegionalDataset> {
  const adapter = new TraficomRegionalAdapter({
    cache: new PrefixedStore(getRuntime().rawStore, 'regional-cache/'),
  });
  return underPrefix('regional/', regionalPipeline(adapter));
}

export function getUsedImportsRuntime(): PipelineRuntime<Dataset> {
  return underPrefix('used/', usedImportsPipeline(new TraficomUsedImportAdapter()));
}

export function getPricesRuntime(): PipelineRuntime<FuelPriceDataset> {
  return underPrefix('prices/', pricesPipeline(new StatFinFuelPriceAdapter()));
}

export function getStockRuntime(): PipelineRuntime<StockDataset> {
  return underPrefix('stock/', stockPipeline(new TraficomStockAdapter()));
}

export function getFleetRuntime(): PipelineRuntime<FleetDataset> {
  return underPrefix('fleet/', fleetPipeline(new TraficomFleetAdapter()));
}
