import { SCHEMA_VERSION, type EntitySummary, type Manifest, type Matrix } from '@regs/core';
import { describe, expect, it } from 'vitest';
import type { Catalog } from './api';
import { loadUsed } from './used';

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

describe('loadUsed', () => {
  it('returns the matrix and the entities by id', async () => {
    const data = await loadUsed({ catalog: async () => catalog, matrix: async () => matrix });
    expect(data.matrix).toBe(matrix);
    expect(data.byId.get('audi')).toBe(entity);
  });

  it('asks for the matrix of the release the catalog names', async () => {
    let asked: Catalog | undefined;
    await loadUsed({
      catalog: async () => catalog,
      matrix: async (c) => {
        asked = c;
        return matrix;
      },
    });
    expect(asked).toBe(catalog);
  });
});
