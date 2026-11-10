#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { TraficomPxWebAdapter } from './adapters/traficom-pxweb/adapter.js';
import { TraficomRegionalAdapter } from './adapters/traficom-pxweb/regional-adapter.js';
import { StatFinFuelPriceAdapter } from './adapters/statfin/fuel-prices-adapter.js';
import { TraficomUsedImportAdapter } from './adapters/traficom-pxweb/used-adapter.js';
import { pricesPipeline } from './pipeline/prices.js';
import { regionalPipeline } from './pipeline/regional.js';
import { usedImportsPipeline } from './pipeline/registrations.js';
import { runIngest, runPipeline, type IngestResult } from './pipeline/run.js';
import { BlobStore } from './storage/blob-store.js';
import { FsStore } from './storage/fs-store.js';
import { PrefixedStore } from './storage/prefixed-store.js';
import type { ObjectStore } from './storage/types.js';
import { positiveInteger } from './util/args.js';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: '.data' },
    azure: { type: 'string' },
    dataset: { type: 'string', default: 'registrations' },
    'from-year': { type: 'string', default: '2021' },
    concurrency: { type: 'string', default: '4' },
    force: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`Usage: regs-ingest [--out <dir> | --azure <account url>] [--dataset registrations|regional|used|prices] [--force]

Fetches the latest data and writes a release to <dir>/published (raw responses go to <dir>/raw).
  --out          Output directory (default: .data)
  --azure        Write to the data storage account instead, for example
                 https://<account>.blob.core.windows.net (uses your az login)
  --dataset      registrations (national, default), regional (per municipality),
                 used (cars imported used, by make) or prices (pump prices of petrol and diesel)
  --from-year    First year of the regional data (default: 2021)
  --concurrency  Parallel requests for the regional data (default: 4)
  --force        Publish a new release even if the source has not changed

The regional dataset keeps progress per area, so an interrupted run can simply be started again.`);
  process.exit(0);
}

function createStores(): { rawStore: ObjectStore; publishedStore: ObjectStore } {
  if (values.azure) {
    const connect = (container: string) =>
      BlobStore.connect({ accountUrl: values.azure!, container });
    return { rawStore: connect('raw'), publishedStore: connect('published') };
  }
  const out = values.out ?? '.data';
  return { rawStore: new FsStore(`${out}/raw`), publishedStore: new FsStore(`${out}/published`) };
}

/** A dataset published beside the national one keeps its files under a prefix of its own. */
function underPrefix(
  stores: { rawStore: ObjectStore; publishedStore: ObjectStore },
  prefix: string,
): { rawStore: ObjectStore; publishedStore: ObjectStore } {
  return {
    rawStore: new PrefixedStore(stores.rawStore, prefix),
    publishedStore: new PrefixedStore(stores.publishedStore, prefix),
  };
}

async function run(): Promise<IngestResult> {
  const stores = createStores();
  const { rawStore, publishedStore } = stores;
  const force = values.force ?? false;
  if (values.dataset === 'regional') {
    const adapter = new TraficomRegionalAdapter({
      cache: new PrefixedStore(rawStore, 'regional-cache/'),
      fromYear: positiveInteger('from-year', values['from-year']),
      concurrency: positiveInteger('concurrency', values.concurrency),
    });
    return runPipeline(regionalPipeline(adapter), {
      ...underPrefix(stores, 'regional/'),
      force,
    });
  }
  if (values.dataset === 'used') {
    return runPipeline(usedImportsPipeline(new TraficomUsedImportAdapter()), {
      ...underPrefix(stores, 'used/'),
      force,
    });
  }
  if (values.dataset === 'prices') {
    return runPipeline(pricesPipeline(new StatFinFuelPriceAdapter()), {
      ...underPrefix(stores, 'prices/'),
      force,
    });
  }
  if (values.dataset !== 'registrations') throw new Error(`Unknown dataset: ${values.dataset}`);
  return runIngest({ adapter: new TraficomPxWebAdapter(), rawStore, publishedStore, force });
}

try {
  console.log(JSON.stringify(await run()));
} catch (err) {
  console.error(err);
  process.exit(1);
}
