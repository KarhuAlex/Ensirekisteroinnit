import type { Dataset } from '@regs/core';
import { describe, expect, it } from 'vitest';
import type { PipelineRuntime } from '../src/config.js';
import { ingestSecondary, type IngestContext } from '../src/secondary.js';

function recorder() {
  const logs: string[] = [];
  const errors: string[] = [];
  const context: IngestContext = {
    log: (m: string) => void logs.push(m),
    warn: () => undefined,
    error: (m: string) => void errors.push(m),
  };
  return { context, logs, errors };
}

/** A store that already holds a release of the given source version. */
const storeAt = (version: string) => ({
  put: async () => undefined,
  get: async () =>
    JSON.stringify({
      schemaVersion: 1,
      release: 'r',
      sourceVersion: version,
      generatedAt: 'x',
      format: 1,
    }),
});

function runtime(getVersion: () => Promise<string>): PipelineRuntime<Dataset> {
  const store = storeAt('v1');
  return {
    pipeline: {
      name: 'test',
      format: 1,
      adapter: {
        id: 'a',
        getVersion,
        fetch: async () => ({ dataset: {} as Dataset, rawFiles: [] }),
      },
      validate: () => undefined,
      build: () => ({ id: 'r', generatedAt: 'x', files: [] }),
      sourceVersionOf: () => 'v1',
    },
    options: { rawStore: store, publishedStore: store },
  };
}

describe('ingestSecondary', () => {
  it('logs a failure instead of throwing, so the next dataset still runs', async () => {
    const { context, errors } = recorder();
    const broken = runtime(async () => {
      throw new Error('source down');
    });
    await expect(ingestSecondary(context, 'Fuel prices', broken)).resolves.toBeUndefined();
    expect(errors).toEqual(['Fuel prices ingest failed']);
  });

  it('logs a run that finds nothing new as finished', async () => {
    const { context, logs, errors } = recorder();
    await ingestSecondary(
      context,
      'Used imports',
      runtime(async () => 'v1'),
    );
    expect(logs.at(-1)).toBe('Used imports ingest finished');
    expect(errors).toEqual([]);
  });
});
