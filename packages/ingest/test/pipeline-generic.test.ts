import { describe, expect, it } from 'vitest';
import { silentLogger } from '../src/logger.js';
import type { Pipeline } from '../src/pipeline/pipeline.js';
import { LATEST_POINTER_PATH, runPipeline } from '../src/pipeline/run.js';
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

const pipeline: Pipeline<{ version: string; rows: number[] }> = {
  name: 'test dataset',
  format: 7,
  adapter: {
    id: 'fake',
    getVersion: async () => 'v1',
    fetch: async () => ({ dataset: { version: 'v1', rows: [1, 2, 3] }, rawFiles: [] }),
  },
  validate: (data) => {
    if (data.rows.length === 0) throw new Error('empty');
  },
  build: (data, now) => ({
    id: 'r1',
    generatedAt: now.toISOString(),
    files: [{ path: 'rows.json', body: JSON.stringify(data.rows) }],
  }),
  sourceVersionOf: (data) => data.version,
};

describe('runPipeline', () => {
  it('publishes any dataset and records its own format in the pointer', async () => {
    const publishedStore = new MemoryStore();
    const opts = { rawStore: new MemoryStore(), publishedStore, logger: silentLogger };
    expect((await runPipeline(pipeline, opts)).status).toBe('published');
    expect(publishedStore.files.get('r1/rows.json')).toBe('[1,2,3]');
    expect(JSON.parse(publishedStore.files.get(LATEST_POINTER_PATH)!)).toMatchObject({
      release: 'r1',
      sourceVersion: 'v1',
      format: 7,
    });
    expect((await runPipeline(pipeline, opts)).status).toBe('skipped');
  });
});
