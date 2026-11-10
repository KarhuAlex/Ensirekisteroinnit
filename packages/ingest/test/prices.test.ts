import type { FuelPriceDataset } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { StatFinFuelPriceAdapter } from '../src/adapters/statfin/fuel-prices-adapter.js';
import type { JsonStatDoc } from '../src/adapters/pxweb/jsonstat.js';
import type { PxApi } from '../src/adapters/pxweb/api.js';
import { silentLogger } from '../src/logger.js';
import { buildPricesRelease, pricesPipeline, validatePrices } from '../src/pipeline/prices.js';
import { LATEST_POINTER_PATH, runPipeline } from '../src/pipeline/run.js';
import { PrefixedStore } from '../src/storage/prefixed-store.js';
import type { ObjectStore } from '../src/storage/types.js';

class MemoryStore implements ObjectStore {
  readonly files = new Map<string, string>();
  async put(path: string, body: string) {
    this.files.set(path, body);
  }
  async get(path: string) {
    return this.files.get(path) ?? null;
  }
}

const MONTH_CODES = ['2026M01', '2026M02', '2026M03'];

/** A table with the two pump fuels and one product the adapter must ignore; diesel lacks March. */
function fakeApi(
  values: (number | null)[] = [1.5, 1.6, null, 1.4, 1.45, 1.5],
  contents: string[] = ['khi-keskihinta'],
): PxApi {
  return {
    listFolder: async () => [{ id: '11xx.px', type: 't', text: 't', updated: 'v1' }],
    getTableMeta: async () => ({
      title: 't',
      variables: [
        { code: 'timeperiod_m', text: 'm', values: MONTH_CODES, valueTexts: MONTH_CODES },
        { code: 'coicop_13_20160512', text: 'f', values: ['0700100', '0700200'], valueTexts: [] },
        { code: 'contentscode', text: 'c', values: contents, valueTexts: [] },
      ],
    }),
    query: async () => {
      const doc: JsonStatDoc = {
        id: ['coicop_13_20160512', 'timeperiod_m', 'contentscode'],
        size: [2, 3, 1],
        // diesel first, as in the source, then petrol
        value: values,
        dimension: {
          coicop_13_20160512: { category: { index: { '0700100': 0, '0700200': 1 } } },
          contentscode: { category: { index: { 'khi-keskihinta': 0 } } },
          timeperiod_m: {
            category: { index: Object.fromEntries(MONTH_CODES.map((c, i) => [c, i])) },
          },
        },
      };
      return { doc, raw: JSON.stringify(doc) };
    },
  };
}

function dataset(months = 130, over: Partial<FuelPriceDataset['series']> = {}): FuelPriceDataset {
  const list = Array.from({ length: months }, (_, i) => {
    const year = 2010 + Math.floor(i / 12);
    return `${year}-${String((i % 12) + 1).padStart(2, '0')}`;
  });
  return {
    sourceId: 's',
    sourceName: 'name',
    sourceUrl: 'https://example.org',
    licence: 'CC BY 4.0',
    sourceVersion: 'v1',
    sourceUpdated: 'v1',
    months: list,
    series: {
      petrol: list.map(() => 1.8),
      diesel: list.map(() => 1.7),
      ...over,
    },
  };
}

describe('StatFinFuelPriceAdapter', () => {
  it('maps the source fuels to canonical ones and keeps missing months as null', async () => {
    const { dataset: result, rawFiles } = await new StatFinFuelPriceAdapter({
      client: fakeApi(),
    }).fetch();
    expect(result.months).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(result.series.diesel).toEqual([1.5, 1.6, null]);
    expect(result.series.petrol).toEqual([1.4, 1.45, 1.5]);
    expect(result.sourceVersion).toBe('v1');
    expect(rawFiles).toHaveLength(1);
  });
});

describe('StatFinFuelPriceAdapter, source changes', () => {
  it('refuses a table that no longer has the average price content', async () => {
    const adapter = new StatFinFuelPriceAdapter({ client: fakeApi(undefined, ['khi-indeksi']) });
    await expect(adapter.fetch()).rejects.toThrow(/source schema changed/);
  });
});

describe('validatePrices', () => {
  it('accepts a complete series', () => {
    expect(() => validatePrices(dataset())).not.toThrow();
  });

  it('rejects too few months', () => {
    expect(() => validatePrices(dataset(24))).toThrow(/only 24 months/);
  });

  it('rejects a gap in the months', () => {
    const gap = dataset();
    gap.months.splice(5, 1);
    gap.series.petrol.splice(5, 1);
    gap.series.diesel.splice(5, 1);
    expect(() => validatePrices(gap)).toThrow(/not consecutive/);
  });

  it('rejects an implausible price and a missing latest month', () => {
    const wild = dataset();
    wild.series.diesel[10] = 17;
    expect(() => validatePrices(wild)).toThrow(/diesel has a price outside/);
    const stale = dataset();
    stale.series.petrol[stale.months.length - 1] = null;
    expect(() => validatePrices(stale)).toThrow(/petrol has no price for the latest month/);
  });
});

describe('prices pipeline', () => {
  it('publishes one file under its own prefix and skips when the source is unchanged', async () => {
    const published = new MemoryStore();
    const run = () =>
      runPipeline(
        pricesPipeline(
          new StatFinFuelPriceAdapter({ client: fakeApi([1.5, 1.6, 1.7, 1.4, 1.45, 1.5]) }),
          3,
        ),
        {
          rawStore: new PrefixedStore(new MemoryStore(), 'prices/'),
          publishedStore: new PrefixedStore(published, 'prices/'),
          logger: silentLogger,
        },
      );

    expect((await run()).status).toBe('published');
    const keys = [...published.files.keys()];
    expect(keys).toContain(`prices/${LATEST_POINTER_PATH}`);
    const file = JSON.parse(published.files.get(keys.find((k) => k.endsWith('/prices.json'))!)!);
    expect(file).toMatchObject({ unit: 'EUR/l', months: ['2026-01', '2026-02', '2026-03'] });
    expect((await run()).status).toBe('skipped');
  });

  it('builds a release whose file names its own release id', () => {
    const release = buildPricesRelease(dataset(), new Date('2026-11-10T08:00:00Z'));
    expect(release.id).toBe('20261110T080000Z');
    expect(JSON.parse(release.files[0]!.body).release).toBe(release.id);
  });
});
