import { SCHEMA_VERSION, type RegionalIndex, type RegionalYear } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { HttpError } from './api';
import { currentRegionalState, loadRegionalState, type RegionalSource } from './regional';

const index = {
  years: ['2025', '2026'],
  months: [],
  entities: [],
  areas: [],
  groups: [],
} as unknown as RegionalIndex;
const year = (name: string): RegionalYear => ({
  schemaVersion: SCHEMA_VERSION,
  year: name,
  cells: { e: [], a: [], g: [], m: [], n: [] },
});

const source = (over: Partial<RegionalSource> = {}): RegionalSource => ({
  catalog: async () => ({ release: 'r', index }),
  year: async (_catalog, name) => year(name),
  ...over,
});

describe('loadRegionalState', () => {
  it('loads the wanted years that exist and remembers which years it was for', async () => {
    const state = await loadRegionalState(['2024', '2025', '2026'], source());
    expect(state).toMatchObject({ status: 'ready', key: '2024,2025,2026' });
    if (state.status === 'ready') expect([...state.years.keys()]).toEqual(['2025', '2026']);
  });

  it('reports missing regional data as unavailable', async () => {
    const missing = source({
      catalog: async () => {
        throw new HttpError(404, 'https://example.org/regional/latest.json');
      },
    });
    expect(await loadRegionalState(['2026'], missing)).toEqual({ status: 'unavailable' });
  });

  it('reports other failures as errors', async () => {
    const broken = source({
      year: async () => {
        throw new Error('network down');
      },
    });
    const state = await loadRegionalState(['2026'], broken);
    expect(state.status).toBe('error');
  });
});

describe('currentRegionalState', () => {
  it('does not offer data loaded for other years as the current data', async () => {
    const ready = await loadRegionalState(['2026'], source());
    expect(currentRegionalState(ready, '2026').status).toBe('ready');
    expect(currentRegionalState(ready, '2025').status).toBe('loading');
  });

  it('passes the other states through', () => {
    expect(currentRegionalState({ status: 'unavailable' }, '2025')).toEqual({
      status: 'unavailable',
    });
    expect(currentRegionalState({ status: 'loading' }, '2025')).toEqual({ status: 'loading' });
  });
});
