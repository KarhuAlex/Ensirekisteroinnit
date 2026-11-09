import type { Dataset, Entity, EntitySeries, Manifest, Observation } from '@regs/core';
import { describe, expect, it } from 'vitest';
import type { SourceAdapter } from '../src/adapters/types.js';
import { silentLogger } from '../src/logger.js';
import { buildRelease, monthRange } from '../src/pipeline/release.js';
import { LATEST_POINTER_PATH, runIngest } from '../src/pipeline/run.js';
import { validateDataset } from '../src/pipeline/validate.js';
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

const LIMITS = { minEntities: 2, minMonths: 2, minObservations: 3 };

function dataset(version = 'v1'): Dataset {
  const entities: Entity[] = [
    { id: 'total', label: 'All', kind: 'total' },
    { id: 'acme-zx3', label: 'ACME ZX3', kind: 'model' },
  ];
  const observations: Observation[] = [
    { entityId: 'total', period: '2025-01', fuel: 'petrol', count: 10 },
    { entityId: 'total', period: '2025-03', fuel: 'bev', count: 5 },
    { entityId: 'acme-zx3', period: '2025-03', fuel: 'bev', count: 2 },
  ];
  return {
    sourceId: 'test',
    sourceName: 'Test source',
    sourceUrl: 'https://example.org',
    licence: 'CC BY 4.0',
    sourceVersion: version,
    sourceUpdated: '2025-04-01T00:00:00Z',
    entities,
    observations,
    notes: ['A note'],
  };
}

class FakeAdapter implements SourceAdapter {
  readonly id = 'fake';
  fetches = 0;
  constructor(public version = 'v1') {}
  async getVersion() {
    return this.version;
  }
  async fetch() {
    this.fetches++;
    return { dataset: dataset(this.version), rawFiles: [{ path: 'fake/raw.json', content: '{}' }] };
  }
}

describe('monthRange', () => {
  it('is inclusive and crosses year boundaries', () => {
    expect(monthRange('2024-11', '2025-02')).toEqual(['2024-11', '2024-12', '2025-01', '2025-02']);
  });
});

describe('buildRelease', () => {
  const release = buildRelease(dataset(), new Date('2025-04-02T10:15:30.123Z'));
  const file = <T>(path: string) =>
    JSON.parse(release.files.find((f) => f.path === path)!.body) as T;

  it('derives a stable release id from the timestamp', () => {
    expect(release.id).toBe('20250402T101530Z');
  });

  it('fills gaps with explicit zero months', () => {
    const manifest = file<Manifest>('manifest.json');
    expect(manifest.months).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(manifest.latestMonth).toBe('2025-03');
    const total = file<EntitySeries>('entities/total.json');
    expect(total.series.petrol).toEqual([10, 0, 0]);
    expect(total.series.bev).toEqual([0, 0, 5]);
  });

  it('summarises entities', () => {
    const summaries =
      file<{ id: string; total: number; last12: number; bevLast12: number }[]>('entities.json');
    expect(summaries.find((s) => s.id === 'total')).toMatchObject({
      total: 15,
      last12: 15,
      bevLast12: 5,
    });
  });
});

describe('validateDataset', () => {
  it('accepts a sound dataset', () => {
    expect(() => validateDataset(dataset(), LIMITS)).not.toThrow();
  });
  it('rejects datasets without a total entity', () => {
    const d = dataset();
    d.entities = d.entities.filter((e) => e.kind !== 'total');
    expect(() => validateDataset(d, { ...LIMITS, minEntities: 1 })).toThrow(/no "total"/);
  });
  it('rejects implausibly small datasets', () => {
    expect(() => validateDataset(dataset())).toThrow(/failed validation/);
  });
});

describe('runIngest', () => {
  const setup = () => ({
    rawStore: new MemoryStore(),
    publishedStore: new MemoryStore(),
    logger: silentLogger,
    limits: LIMITS,
    now: () => new Date('2025-04-02T10:00:00Z'),
  });

  it('publishes a release and writes the pointer last', async () => {
    const deps = setup();
    const adapter = new FakeAdapter();
    const result = await runIngest({ adapter, ...deps });
    expect(result.status).toBe('published');
    const keys = [...deps.publishedStore.files.keys()];
    expect(keys.at(-1)).toBe(LATEST_POINTER_PATH);
    expect(deps.rawStore.files.has('fake/raw.json')).toBe(true);
    const pointer = JSON.parse(deps.publishedStore.files.get(LATEST_POINTER_PATH)!);
    expect(pointer).toMatchObject({ release: '20250402T100000Z', sourceVersion: 'v1' });
  });

  it('skips when the source version is unchanged', async () => {
    const deps = setup();
    const adapter = new FakeAdapter();
    await runIngest({ adapter, ...deps });
    const second = await runIngest({ adapter, ...deps });
    expect(second.status).toBe('skipped');
    expect(adapter.fetches).toBe(1);
  });

  it('publishes again when forced or when the source changed', async () => {
    const deps = setup();
    const adapter = new FakeAdapter();
    await runIngest({ adapter, ...deps });
    expect((await runIngest({ adapter, ...deps, force: true })).status).toBe('published');
    adapter.version = 'v2';
    expect((await runIngest({ adapter, ...deps })).status).toBe('published');
  });

  it('leaves the previous release in place when validation fails', async () => {
    const deps = setup();
    await runIngest({ adapter: new FakeAdapter(), ...deps });
    const before = deps.publishedStore.files.get(LATEST_POINTER_PATH);
    await expect(
      runIngest({
        adapter: new FakeAdapter('v2'),
        ...deps,
        limits: { ...LIMITS, minObservations: 1000 },
      }),
    ).rejects.toThrow(/failed validation/);
    expect(deps.publishedStore.files.get(LATEST_POINTER_PATH)).toBe(before);
  });
});
