import type { StockDataset } from '@regs/core';
import { describe, expect, it } from 'vitest';
import type { PxApi } from '../src/adapters/pxweb/api.js';
import type { JsonStatDoc } from '../src/adapters/pxweb/jsonstat.js';
import { TraficomStockAdapter } from '../src/adapters/traficom-pxweb/stock-adapter.js';
import { silentLogger } from '../src/logger.js';
import { LATEST_POINTER_PATH, runPipeline } from '../src/pipeline/run.js';
import { buildStockRelease, stockPipeline, validateStock } from '../src/pipeline/stock.js';
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

const QUARTERS = ['2025Q4', '2026Q1', '2026Q2'];
/** Fuel codes in the order of the fake table: the total, then classes that map to every group. */
const FUELS = ['YH', '01', '02', '04', '39', '44', '13', 'Y'];

/**
 * A table of one area and one class. Counts are per fuel, then per quarter. The two plug-in
 * hybrid classes and the two other classes must be added up into one group each.
 */
function fakeApi(
  counts: (number | null)[][],
  fuels: string[] = FUELS,
  overrides: { areaText?: string; classText?: string } = {},
): PxApi {
  return {
    listFolder: async () => [{ id: '040_kanta_tau_104.px', type: 't', text: 't', updated: 'v1' }],
    getTableMeta: async () => ({
      title: 't',
      variables: [
        {
          code: 'Maakunta',
          text: 'a',
          values: ['MA1', 'MK01'],
          valueTexts: [overrides.areaText ?? 'MANNER-SUOMI', 'Uusimaa'],
        },
        {
          code: 'Ajoneuvoluokka',
          text: 'c',
          values: ['YH', '01'],
          valueTexts: ['Yhteensä', overrides.classText ?? 'Henkilöautot'],
        },
        { code: 'Käyttövoima', text: 'f', values: fuels, valueTexts: fuels },
        { code: 'Vuosineljännes', text: 'q', values: QUARTERS, valueTexts: QUARTERS },
      ],
    }),
    query: async () => {
      const doc: JsonStatDoc = {
        id: ['Maakunta', 'Ajoneuvoluokka', 'Käyttövoima', 'Vuosineljännes'],
        size: [1, 1, fuels.length, QUARTERS.length],
        value: counts.flat(),
        dimension: {
          Maakunta: { category: { index: { MA1: 0 } } },
          Ajoneuvoluokka: { category: { index: { '01': 0 } } },
          Käyttövoima: { category: { index: Object.fromEntries(fuels.map((c, i) => [c, i])) } },
          Vuosineljännes: {
            category: { index: Object.fromEntries(QUARTERS.map((c, i) => [c, i])) },
          },
        },
      };
      return { doc, raw: JSON.stringify(doc) };
    },
  };
}

const COUNTS = [
  [100, 110, 120], // all fuels
  [60, 60, 60], // petrol
  [20, 20, 20], // diesel
  [10, 14, 18], // electric
  [3, 4, 5], // plug-in hybrid, petrol
  [2, 3, 4], // plug-in hybrid, diesel
  [4, 5, 6], // natural gas
  [1, 4, 7], // other
];

function dataset(quarters = 70, over: Partial<StockDataset> = {}): StockDataset {
  const list: string[] = [];
  for (let i = 0; i < quarters; i++) list.push(`${2008 + Math.floor(i / 4)}Q${(i % 4) + 1}`);
  const flat = (value: number) => list.map(() => value);
  return {
    sourceId: 's',
    sourceName: 'name',
    sourceUrl: 'https://example.org',
    licence: 'CC BY 4.0',
    sourceVersion: 'v1',
    sourceUpdated: 'v1',
    quarters: list,
    series: {
      petrol: flat(1_500_000),
      diesel: flat(700_000),
      bev: flat(100_000),
      phev: flat(100_000),
      other: flat(10_000),
    },
    total: flat(2_410_000),
    ...over,
  };
}

describe('TraficomStockAdapter', () => {
  it('adds the source classes up into the fuel groups and keeps the source total', async () => {
    const { dataset: result, rawFiles } = await new TraficomStockAdapter({
      client: fakeApi(COUNTS),
    }).fetch();
    expect(result.quarters).toEqual(QUARTERS);
    expect(result.total).toEqual([100, 110, 120]);
    expect(result.series.petrol).toEqual([60, 60, 60]);
    expect(result.series.bev).toEqual([10, 14, 18]);
    expect(result.series.phev).toEqual([5, 7, 9]);
    expect(result.series.other).toEqual([5, 9, 13]);
    expect(rawFiles).toHaveLength(1);
  });

  it('counts a class without a figure as no cars', async () => {
    const withGap = COUNTS.map((row) => [...row]);
    withGap[7] = [null, 4, 7];
    const { dataset: result } = await new TraficomStockAdapter({
      client: fakeApi(withGap),
    }).fetch();
    expect(result.series.other).toEqual([4, 9, 13]);
  });

  it('fails on a missing total instead of guessing it', async () => {
    const noTotal = COUNTS.map((row) => [...row]);
    noTotal[0] = [100, null, 120];
    const adapter = new TraficomStockAdapter({ client: fakeApi(noTotal) });
    await expect(adapter.fetch()).rejects.toThrow(/no total for 2026Q1/);
  });
});

describe('TraficomStockAdapter, source changes', () => {
  it('fails on a fuel class it does not know', async () => {
    const fuels = [...FUELS, '99'];
    const adapter = new TraficomStockAdapter({
      client: fakeApi([...COUNTS, [1, 1, 1]], fuels),
    });
    await expect(adapter.fetch()).rejects.toThrow(/Unmapped fuel codes in source: 99/);
  });

  it('refuses a table whose area or class changed meaning', async () => {
    const area = new TraficomStockAdapter({
      client: fakeApi(COUNTS, FUELS, { areaText: 'Åland' }),
    });
    await expect(area.fetch()).rejects.toThrow(/source schema changed/);
    const kind = new TraficomStockAdapter({
      client: fakeApi(COUNTS, FUELS, { classText: 'Pakettiautot' }),
    });
    await expect(kind.fetch()).rejects.toThrow(/source schema changed/);
  });
});

describe('validateStock', () => {
  it('accepts a complete series', () => {
    expect(() => validateStock(dataset())).not.toThrow();
  });

  it('rejects too few quarters and a gap between them', () => {
    expect(() => validateStock(dataset(12))).toThrow(/only 12 quarters/);
    const gap = dataset();
    gap.quarters.splice(5, 1);
    for (const group of Object.keys(gap.series) as (keyof StockDataset['series'])[]) {
      gap.series[group].splice(5, 1);
    }
    gap.total.splice(5, 1);
    expect(() => validateStock(gap)).toThrow(/not consecutive/);
  });

  it('rejects fuel groups that do not add up to the source total', () => {
    const off = dataset();
    off.series.bev[3] = 100_001;
    expect(() => validateStock(off)).toThrow(/the fuel groups add up to/);
  });

  it('rejects an implausible total and series of the wrong length', () => {
    const wild = dataset(70, { total: dataset().total.map(() => 24) });
    expect(() => validateStock(wild)).toThrow(/implausible/);
    const short = dataset();
    short.series.diesel.pop();
    expect(() => validateStock(short)).toThrow(/not all 70 quarters long/);
  });

  it('rejects a count that is not a whole number of cars', () => {
    const half = dataset();
    half.series.other[0] = -5;
    expect(() => validateStock(half)).toThrow(/not a whole number/);
  });
});

/** Counts scaled up to the size of a real stock, so the plausibility check passes. */
const REAL_SIZE = COUNTS.map((row) => row.map((v) => (v === null ? v : v * 20_000)));

describe('car stock pipeline', () => {
  const run = (published: MemoryStore, counts = REAL_SIZE) =>
    runPipeline(stockPipeline(new TraficomStockAdapter({ client: fakeApi(counts) }), 3), {
      rawStore: new PrefixedStore(new MemoryStore(), 'stock/'),
      publishedStore: new PrefixedStore(published, 'stock/'),
      logger: silentLogger,
    });

  it('publishes one file under its own prefix, pointer last, and skips an unchanged source', async () => {
    const published = new MemoryStore();
    expect((await run(published)).status).toBe('published');
    const keys = [...published.files.keys()];
    expect(keys.at(-1)).toBe(`stock/${LATEST_POINTER_PATH}`);
    expect(keys.some((k) => k.endsWith('/stock.json'))).toBe(true);
    expect((await run(published)).status).toBe('skipped');
  });

  it('publishes nothing when the data fails validation', async () => {
    const published = new MemoryStore();
    await expect(run(published, COUNTS)).rejects.toThrow(/implausible/);
    expect(published.files.size).toBe(0);
  });

  it('builds a release whose file names its own release id and source', () => {
    const release = buildStockRelease(dataset(), new Date('2026-11-10T08:00:00Z'));
    expect(release.id).toBe('20261110T080000Z');
    expect(release.files.map((f) => f.path)).toEqual(['stock.json']);
    const file = JSON.parse(release.files[0]!.body);
    expect(file).toMatchObject({ release: release.id, source: { licence: 'CC BY 4.0' } });
    expect(file.quarters).toHaveLength(70);
  });
});
