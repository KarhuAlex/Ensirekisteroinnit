import { matrixSum, RELEASE_FORMAT, type Dataset, type Matrix } from '@regs/core';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { SourceAdapter } from '../src/adapters/types.js';
import { silentLogger } from '../src/logger.js';
import { buildRelease } from '../src/pipeline/release.js';
import { LATEST_POINTER_PATH, runIngest } from '../src/pipeline/run.js';
import { encodeBody } from '../src/storage/encode.js';
import type { ObjectStore, PutOptions } from '../src/storage/types.js';

const dataset: Dataset = {
  sourceId: 'test',
  sourceName: 'Test',
  sourceUrl: 'https://example.org',
  licence: 'CC BY 4.0',
  sourceVersion: 'v1',
  sourceUpdated: '2025-04-01T00:00:00Z',
  entities: [
    { id: 'total', label: 'All', kind: 'total' },
    { id: 'zx3', label: 'ACME ZX3', kind: 'model', makeId: 'acme' },
  ],
  observations: [
    { entityId: 'total', period: '2025-01', fuel: 'petrol', count: 10 },
    { entityId: 'total', period: '2025-02', fuel: 'phev_diesel', count: 4 },
    { entityId: 'total', period: '2025-02', fuel: 'phev_petrol', count: 3 },
    { entityId: 'zx3', period: '2025-02', fuel: 'bev', count: 2 },
  ],
  notes: [],
};

describe('matrix in a release', () => {
  const release = buildRelease(dataset, new Date('2025-03-01T00:00:00Z'));
  const matrix = JSON.parse(release.files.find((f) => f.path === 'matrix.json')!.body) as Matrix;
  const months = matrix.months.length;
  const row = (id: string) => matrix.rows.find((r) => r.id === id)!;

  it('lists the months and fuel groups the counts are laid out by', () => {
    expect(matrix.months).toEqual(['2025-01', '2025-02']);
    expect(matrix.groups).toEqual(['petrol', 'diesel', 'bev', 'phev', 'other']);
  });

  it('stores detailed fuels under their chart group', () => {
    const total = row('total');
    expect(matrixSum(total, matrix.groups.indexOf('petrol'), months, 0, 1)).toBe(10);
    expect(matrixSum(total, matrix.groups.indexOf('phev'), months, 0, 1)).toBe(7);
    expect(matrixSum(row('zx3'), matrix.groups.indexOf('bev'), months, 0, 0)).toBe(0);
    expect(matrixSum(row('zx3'), matrix.groups.indexOf('bev'), months, 0, 1)).toBe(2);
  });
});

describe('encodeBody', () => {
  it('leaves the body alone unless compression is requested', () => {
    const { data, contentEncoding } = encodeBody('{"a":1}', false);
    expect(data.toString('utf8')).toBe('{"a":1}');
    expect(contentEncoding).toBeUndefined();
  });

  it('gzips on request and round-trips', () => {
    const text = JSON.stringify({ values: new Array(500).fill(0) });
    const { data, contentEncoding } = encodeBody(text, true);
    expect(contentEncoding).toBe('gzip');
    expect(data.length).toBeLessThan(text.length / 5);
    expect(gunzipSync(data).toString('utf8')).toBe(text);
  });
});

class MemoryStore implements ObjectStore {
  readonly files = new Map<string, string>();
  readonly options = new Map<string, PutOptions | undefined>();
  async put(path: string, body: string, options?: PutOptions) {
    this.files.set(path, body);
    this.options.set(path, options);
  }
  async get(path: string) {
    return this.files.get(path) ?? null;
  }
}

describe('release format', () => {
  const adapter: SourceAdapter = {
    id: 'fake',
    getVersion: async () => 'v1',
    fetch: async () => ({ dataset, rawFiles: [] }),
  };
  const deps = () => ({
    adapter,
    rawStore: new MemoryStore(),
    publishedStore: new MemoryStore(),
    logger: silentLogger,
    limits: { minEntities: 1, minMonths: 1, minObservations: 1 },
  });

  it('records the format in the pointer and compresses release files only', async () => {
    const d = deps();
    await runIngest(d);
    const pointer = JSON.parse(d.publishedStore.files.get(LATEST_POINTER_PATH)!);
    expect(pointer.format).toBe(RELEASE_FORMAT);
    const [first] = [...d.publishedStore.options.entries()];
    expect(first?.[1]?.compress).toBe(true);
    expect(d.publishedStore.options.get(LATEST_POINTER_PATH)?.compress).toBeUndefined();
  });

  it('skips when both the source and the format are current', async () => {
    const d = deps();
    await runIngest(d);
    expect((await runIngest(d)).status).toBe('skipped');
  });

  it('rebuilds an unchanged source when the published release has an older format', async () => {
    const d = deps();
    await d.publishedStore.put(
      LATEST_POINTER_PATH,
      JSON.stringify({ schemaVersion: 1, release: 'old', sourceVersion: 'v1', generatedAt: 'x' }),
    );
    expect((await runIngest(d)).status).toBe('published');
  });
});
