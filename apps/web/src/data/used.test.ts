import { SCHEMA_VERSION, type EntitySummary, type Manifest, type Matrix } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { HttpError, type Catalog } from './api';
import { loadUsedState, type UsedSource } from './used';

const entity: EntitySummary = {
  id: 'audi',
  label: 'Audi',
  kind: 'make',
  total: 5,
  last12: 3,
  bevLast12: 1,
};
const catalog: Catalog = {
  release: 'r',
  manifest: { months: ['2026-01'] } as Manifest,
  entities: [entity],
};
const matrix: Matrix = { schemaVersion: SCHEMA_VERSION, months: ['2026-01'], groups: [], rows: [] };

const source = (over: Partial<UsedSource> = {}): UsedSource => ({
  catalog: async () => catalog,
  matrix: async () => matrix,
  ...over,
});

describe('loadUsedState', () => {
  it('returns the catalog, the matrix and the entities by id', async () => {
    const state = await loadUsedState(source());
    expect(state.status).toBe('ready');
    if (state.status === 'ready') expect(state.byId.get('audi')).toBe(entity);
  });

  it('reports data that has not been published as unavailable', async () => {
    const missing = source({
      catalog: async () => {
        throw new HttpError(404, 'https://example.org/used/latest.json');
      },
    });
    expect(await loadUsedState(missing)).toEqual({ status: 'unavailable' });
  });

  it('reports other failures as errors', async () => {
    const broken = source({
      matrix: async () => {
        throw new Error('network down');
      },
    });
    expect((await loadUsedState(broken)).status).toBe('error');
  });
});
