import type { RegionalDataset, RegionalIndex, RegionalYear } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { TraficomRegionalAdapter } from '../src/adapters/traficom-pxweb/regional-adapter.js';
import type { PxApi } from '../src/adapters/traficom-pxweb/adapter.js';
import { areaFromCode } from '../src/adapters/traficom-pxweb/mapping.js';
import type { JsonStatDoc } from '../src/adapters/traficom-pxweb/jsonstat.js';
import { silentLogger } from '../src/logger.js';
import {
  buildRegionalRelease,
  regionalPipeline,
  validateRegional,
} from '../src/pipeline/regional.js';
import { LATEST_POINTER_PATH, runPipeline } from '../src/pipeline/run.js';
import { PrefixedStore } from '../src/storage/prefixed-store.js';
import type { ObjectStore } from '../src/storage/types.js';
import { mapWithConcurrency } from '../src/util/pool.js';

class MemoryStore implements ObjectStore {
  readonly files = new Map<string, string>();
  async put(path: string, body: string) {
    this.files.set(path, body);
  }
  async get(path: string) {
    return this.files.get(path) ?? null;
  }
}

describe('mapWithConcurrency', () => {
  it('keeps the input order and never exceeds the limit', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5 * (7 - n)));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
});

describe('PrefixedStore', () => {
  it('reads and writes under its prefix', async () => {
    const inner = new MemoryStore();
    const store = new PrefixedStore(inner, 'regional/');
    await store.put('latest.json', '{}');
    expect([...inner.files.keys()]).toEqual(['regional/latest.json']);
    expect(await store.get('latest.json')).toBe('{}');
    expect(await store.get('missing.json')).toBeNull();
  });
});

describe('areaFromCode', () => {
  it('maps municipalities, abroad and unknown, and skips the national row', () => {
    expect(areaFromCode('KU049', ' Espoo ')).toEqual({
      id: '049',
      name: 'Espoo',
      kind: 'municipality',
    });
    expect(areaFromCode('200', 'Ulkomaat')?.id).toBe('abroad');
    expect(areaFromCode('X', 'Tuntematon')?.id).toBe('unknown');
    expect(areaFromCode('MA1', 'MA1 MANNER-SUOMI')).toBeNull();
  });

  it('refuses codes it does not know', () => {
    expect(() => areaFromCode('ZZ9', 'Somewhere')).toThrow();
  });
});

const dataset: RegionalDataset = {
  sourceId: 'test',
  sourceName: 'Test',
  sourceUrl: 'https://example.org',
  licence: 'CC BY 4.0',
  sourceVersion: 'v1',
  sourceUpdated: 'v1',
  entities: [
    { id: 'total', label: 'All', kind: 'total' },
    { id: 'zx3', label: 'ACME ZX3', kind: 'model' },
  ],
  areas: [
    { id: '049', name: 'Espoo', kind: 'municipality' },
    { id: '698', name: 'Rovaniemi', kind: 'municipality' },
  ],
  areaObservations: [
    {
      areaId: '049',
      observations: [
        { entityId: 'total', period: '2025-12', fuel: 'petrol', count: 5 },
        { entityId: 'total', period: '2025-12', fuel: 'phev_diesel', count: 2 },
        { entityId: 'total', period: '2025-12', fuel: 'phev_petrol', count: 1 },
      ],
    },
    {
      areaId: '698',
      observations: [
        { entityId: 'total', period: '2026-01', fuel: 'bev', count: 4 },
        { entityId: 'zx3', period: '2026-01', fuel: 'bev', count: 3 },
      ],
    },
  ],
  nationalTotals: { '2025-12': 8, '2026-01': 4 },
};

describe('regional release', () => {
  const release = buildRegionalRelease(dataset, new Date('2026-02-01T00:00:00Z'));
  const file = <T>(path: string) =>
    JSON.parse(release.files.find((f) => f.path === path)!.body) as T;

  it('describes the indexes and splits the cells by year', () => {
    const index = file<RegionalIndex>('index.json');
    expect(index.months).toEqual(['2025-12', '2026-01']);
    expect(index.years).toEqual(['2025', '2026']);
    expect(index.entities).toEqual(['total', 'zx3']);
    expect(release.files.map((f) => f.path)).toEqual([
      'index.json',
      'years/2025.json',
      'years/2026.json',
    ]);
  });

  it('merges fuels of one group and leaves out empty cells', () => {
    const y2025 = file<RegionalYear>('years/2025.json').cells;
    // petrol, and the two plug-in hybrid fuels merged into one group
    expect(y2025.n.slice().sort()).toEqual([3, 5]);
    expect(y2025.e).toEqual([0, 0]);
    expect(y2025.a).toEqual([0, 0]);
    expect(y2025.m).toEqual([0, 0]);
    const y2026 = file<RegionalYear>('years/2026.json').cells;
    expect(y2026.n).toEqual([4, 3]);
    expect(y2026.a).toEqual([1, 1]);
  });

  it('rejects observations it cannot place', () => {
    const bad = {
      ...dataset,
      areaObservations: [{ ...dataset.areaObservations[0]!, areaId: 'nope' }],
    };
    expect(() => buildRegionalRelease(bad, new Date())).toThrow();
  });
});

describe('validateRegional', () => {
  const many = Array.from({ length: 220 }, (_, i) => ({
    id: String(i).padStart(3, '0'),
    name: `Area ${i}`,
    kind: 'municipality' as const,
  }));
  const valid: RegionalDataset = {
    ...dataset,
    areas: many,
    areaObservations: [
      {
        areaId: '000',
        observations: [{ entityId: 'total', period: '2026-01', fuel: 'bev', count: 4 }],
      },
    ],
    nationalTotals: { '2026-01': 4 },
  };

  it('accepts data whose areas add up to the national total', () => {
    expect(() => validateRegional(valid)).not.toThrow();
  });

  it('rejects data that does not add up', () => {
    expect(() => validateRegional({ ...valid, nationalTotals: { '2026-01': 5 } })).toThrow(
      /national total/,
    );
  });

  it('rejects too few areas', () => {
    expect(() => validateRegional({ ...valid, areas: many.slice(0, 5) })).toThrow(/areas/);
  });
});

function fakeApi(updated: string) {
  const queries: { area: string; months: string[] }[] = [];
  const idx = (codes: string[]) => Object.fromEntries(codes.map((c, i) => [c, i]));
  const variables = [
    {
      code: 'Alue',
      text: 'Alue',
      values: ['MA1', 'KU049', 'KU698'],
      valueTexts: ['MA1 MANNER-SUOMI', 'Espoo', 'Rovaniemi'],
    },
    {
      code: 'Mallisarja',
      text: 'Mallisarja',
      values: ['SSSS', 'M1'],
      valueTexts: ['Henkilöautot yhteensä', 'ACME ZX3'],
    },
    {
      code: 'Käyttövoima',
      text: 'Käyttövoima',
      values: ['YH', '04'],
      valueTexts: ['Yhteensä', 'Sähkö'],
    },
    {
      code: 'Kuukausi',
      text: 'Kuukausi',
      values: ['2020M12', '2021M01', '2021M02', '2021M03', '2021M04', '2021M05'],
      valueTexts: [],
    },
  ];
  const api: PxApi = {
    listFolder: async () => [{ id: '050_ensirek_tau_105.px', type: 't', text: 't', updated }],
    getTableMeta: async () => ({ title: 't', variables }),
    query: async (_path, q) => {
      const sel = (code: string) => q.query.find((x) => x.code === code)!.selection.values;
      const area = sel('Alue')[0]!;
      const months = sel('Kuukausi');
      queries.push({ area, months });
      const models = sel('Mallisarja');
      const fuels = sel('Käyttövoima')[0] === '*' ? ['YH', '04'] : sel('Käyttövoima');
      const perCell = area === 'MA1' ? 4 : 2;
      const value = Array.from(
        { length: models.length * fuels.length * months.length },
        () => perCell,
      );
      const dim = (codes: string[]) => ({ category: { index: idx(codes) } });
      const doc: JsonStatDoc = {
        id: ['Alue', 'Mallisarja', 'Käyttövoima', 'Kuukausi'],
        size: [1, models.length, fuels.length, months.length],
        value,
        dimension: {
          Alue: dim([area]),
          Mallisarja: dim(models),
          Käyttövoima: dim(fuels),
          Kuukausi: dim(months),
        },
      };
      return { doc, raw: JSON.stringify(doc) };
    },
  };
  return { api, queries };
}

const adapterFor = (api: PxApi, cache: ObjectStore) =>
  new TraficomRegionalAdapter({
    client: api,
    cache,
    fromYear: 2021,
    refetchMonths: 2,
    logger: silentLogger,
  });

describe('TraficomRegionalAdapter', () => {
  it('fetches every area from the start year and skips the national row', async () => {
    const { api, queries } = fakeApi('v1');
    const { dataset: result } = await adapterFor(api, new MemoryStore()).fetch();
    expect(result.areas.map((a) => a.id)).toEqual(['049', '698']);
    expect(Object.keys(result.nationalTotals)).toEqual([
      '2021-01',
      '2021-02',
      '2021-03',
      '2021-04',
      '2021-05',
    ]);
    const areaQueries = queries.filter((q) => q.area !== 'MA1');
    expect(areaQueries.map((q) => q.area)).toEqual(['KU049', 'KU698']);
    expect(areaQueries[0]!.months).toHaveLength(5);
    const all = result.areaObservations.flatMap((a) => a.observations);
    expect(all.every((o) => o.period >= '2021-01')).toBe(true);
  });

  it('does not ask the source again for areas it already has', async () => {
    const cache = new MemoryStore();
    await adapterFor(fakeApi('v1').api, cache).fetch();
    const second = fakeApi('v1');
    const { dataset: again } = await adapterFor(second.api, cache).fetch();
    expect(second.queries.filter((q) => q.area !== 'MA1')).toHaveLength(0);
    expect(again.areaObservations.flatMap((a) => a.observations).length).toBeGreaterThan(0);
  });

  it('re-reads only the latest months when the source has been updated', async () => {
    const cache = new MemoryStore();
    await adapterFor(fakeApi('v1').api, cache).fetch();
    const updated = fakeApi('v2');
    const { dataset: result } = await adapterFor(updated.api, cache).fetch();
    const area = updated.queries.find((q) => q.area === 'KU049')!;
    expect(area.months).toEqual(['2021M04', '2021M05']);
    const espoo = result.areaObservations
      .find((a) => a.areaId === '049')!
      .observations.filter((o) => o.entityId === 'acme-zx3');
    expect(new Set(espoo.map((o) => o.period)).size).toBe(5);
  });
});

describe('failures', () => {
  it('stops starting work after a failure and waits for what is running', async () => {
    const started: number[] = [];
    let finished = 0;
    await expect(
      mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
        started.push(n);
        await new Promise((r) => setTimeout(r, 10));
        if (n === 2) throw new Error('boom');
        finished++;
        return n;
      }),
    ).rejects.toThrow('boom');
    expect(started.length).toBeLessThan(6);
    expect(finished).toBe(started.length - 1);
  });

  it('rejects an invalid concurrency', async () => {
    await expect(mapWithConcurrency([1], Number.NaN, async (n) => n)).rejects.toThrow(
      /concurrency/,
    );
  });

  it('ignores a corrupt cache file and fetches the area again', async () => {
    const cache = new MemoryStore();
    cache.files.set('areas/KU049.json', '{not json');
    const { api, queries } = fakeApi('v1');
    await adapterFor(api, cache).fetch();
    expect(queries.some((q) => q.area === 'KU049')).toBe(true);
  });

  it('keeps the areas it finished, so the next run only fetches the rest', async () => {
    const cache = new MemoryStore();
    const failing = fakeApi('v1');
    const original = failing.api.query.bind(failing.api);
    failing.api.query = async (path, q) => {
      if (q.query.find((x) => x.code === 'Alue')!.selection.values[0] === 'KU698') {
        throw new Error('source unavailable');
      }
      return original(path, q);
    };
    await expect(adapterFor(failing.api, cache).fetch()).rejects.toThrow('Area KU698 failed');
    expect(cache.files.has('areas/KU049.json')).toBe(true);
    expect(cache.files.has('areas/KU698.json')).toBe(false);

    const retry = fakeApi('v1');
    await adapterFor(retry.api, cache).fetch();
    expect(retry.queries.filter((q) => q.area !== 'MA1').map((q) => q.area)).toEqual(['KU698']);
  });
});

describe('regional pipeline end to end', () => {
  it('publishes under its own prefix with its own format and skips an unchanged source', async () => {
    const published = new MemoryStore();
    const raw = new MemoryStore();
    const run = () =>
      runPipeline(
        regionalPipeline(
          adapterFor(fakeApi('v1').api, new PrefixedStore(raw, 'regional-cache/')),
          2,
        ),
        {
          rawStore: new PrefixedStore(raw, 'regional/'),
          publishedStore: new PrefixedStore(published, 'regional/'),
          logger: silentLogger,
        },
      );

    const first = await run();
    expect(first.status).toBe('published');
    const keys = [...published.files.keys()];
    expect(keys).toContain('regional/latest.json');
    expect(keys.some((k) => /^regional\/\d{8}T\d{6}Z\/index\.json$/.test(k))).toBe(true);
    expect(JSON.parse(published.files.get(`regional/${LATEST_POINTER_PATH}`)!).format).toBe(1);
    expect([...raw.files.keys()].every((k) => k.startsWith('regional-cache/'))).toBe(true);

    expect((await run()).status).toBe('skipped');
  });
});
