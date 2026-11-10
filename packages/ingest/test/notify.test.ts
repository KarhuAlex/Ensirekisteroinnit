import type { Dataset } from '@regs/core';
import { describe, expect, it } from 'vitest';
import type { SourceAdapter } from '../src/adapters/types.js';
import { silentLogger } from '../src/logger.js';
import { describeFailure, describePublish } from '../src/notify/message.js';
import type { FailureNotice, Notifier, PublishNotice } from '../src/notify/types.js';
import { LATEST_POINTER_PATH, runIngest } from '../src/pipeline/run.js';
import type { ObjectStore } from '../src/storage/types.js';

const dataset: Dataset = {
  sourceId: 'test',
  sourceName: 'Test',
  sourceUrl: 'https://example.org',
  licence: 'CC BY 4.0',
  sourceVersion: 'v2',
  sourceUpdated: '2025-04-01T00:00:00Z',
  entities: [{ id: 'total', label: 'All', kind: 'total' }],
  observations: [{ entityId: 'total', period: '2025-01', fuel: 'petrol', count: 10 }],
  notes: [],
};

class MemoryStore implements ObjectStore {
  readonly files = new Map<string, string>();
  async put(path: string, body: string) {
    this.files.set(path, body);
  }
  async get(path: string) {
    return this.files.get(path) ?? null;
  }
}

const adapter: SourceAdapter = {
  id: 'fake',
  getVersion: async () => 'v2',
  fetch: async () => ({ dataset, rawFiles: [] }),
};

function setup(pointer?: object) {
  const publishedStore = new MemoryStore();
  if (pointer) publishedStore.files.set(LATEST_POINTER_PATH, JSON.stringify(pointer));
  const notices: PublishNotice[] = [];
  const failures: FailureNotice[] = [];
  const notifier: Notifier = {
    published: async (n) => void notices.push(n),
    failed: async (n) => void failures.push(n),
  };
  const deps = {
    adapter,
    rawStore: new MemoryStore(),
    publishedStore,
    logger: silentLogger,
    limits: { minEntities: 1, minMonths: 1, minObservations: 1 },
    notifier,
  };
  return { deps, notices, failures };
}

const current = {
  schemaVersion: 1,
  release: 'old',
  sourceVersion: 'v2',
  generatedAt: 'x',
  format: 2,
};

describe('update notification', () => {
  it('reports new source data', async () => {
    const { deps, notices } = setup({ ...current, sourceVersion: 'v1' });
    await runIngest(deps);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      reason: 'new-source',
      sourceVersion: 'v2',
      previousSourceVersion: 'v1',
    });
  });

  it('reports a forced refresh of unchanged data', async () => {
    const { deps, notices } = setup(current);
    await runIngest({ ...deps, force: true });
    expect(notices[0]?.reason).toBe('forced');
  });

  it('reports a format upgrade', async () => {
    const { deps, notices } = setup({ ...current, format: 1 });
    await runIngest(deps);
    expect(notices[0]?.reason).toBe('format-upgrade');
  });

  it('stays quiet when nothing was published', async () => {
    const { deps, notices } = setup(current);
    expect((await runIngest(deps)).status).toBe('skipped');
    expect(notices).toHaveLength(0);
  });

  it('still publishes when sending fails', async () => {
    const { deps } = setup();
    const failing: Notifier = {
      published: async () => {
        throw new Error('mail down');
      },
      failed: async () => undefined,
    };
    expect((await runIngest({ ...deps, notifier: failing })).status).toBe('published');
  });
});

describe('describePublish', () => {
  it('gives a short English subject and the release details', () => {
    const { subject, text } = describePublish({
      pipeline: 'first registrations',
      reason: 'forced',
      release: 'r1',
      sourceVersion: 'v2',
      previousSourceVersion: null,
      files: 3,
      generatedAt: '2026-11-09T10:00:00Z',
    });
    expect(subject).toBe('Data updated (first registrations): release r1');
    expect(text).toContain('A refresh was forced.');
    expect(text).toContain('Previous source version: none');
  });
});

describe('failure notification', () => {
  const broken: SourceAdapter = {
    id: 'broken',
    getVersion: async () => 'v2',
    fetch: async () => {
      throw new Error('source unavailable');
    },
  };

  it('tells the notifier when a run fails, and still throws', async () => {
    const { deps, failures } = setup();
    await expect(runIngest({ ...deps, adapter: broken })).rejects.toThrow('source unavailable');
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      pipeline: 'first registrations',
      message: 'source unavailable',
    });
  });

  it('throws the original error even when the failure notice cannot be sent', async () => {
    const { deps } = setup();
    const notifier: Notifier = {
      published: async () => undefined,
      failed: async () => {
        throw new Error('mail down');
      },
    };
    await expect(runIngest({ ...deps, adapter: broken, notifier })).rejects.toThrow(
      'source unavailable',
    );
  });

  it('describes a failure in one short English message', () => {
    const { subject, text } = describeFailure({
      pipeline: 'regional registrations',
      message: 'Area KU049 failed <- HTTP 500',
      occurredAt: '2026-11-09T10:00:00Z',
    });
    expect(subject).toBe('Ingest failed (regional registrations)');
    expect(text).toContain('Area KU049 failed <- HTTP 500');
  });
});
