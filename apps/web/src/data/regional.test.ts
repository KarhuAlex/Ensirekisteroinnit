import { SCHEMA_VERSION, type RegionalIndex, type RegionalYear } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { HttpError } from './api';
import { loadRegional, regionalLoad, type RegionalSource } from './regional';
import { loadRemote } from './remote';

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

describe('loadRegional', () => {
  it('loads the wanted years that exist and skips the rest', async () => {
    const view = await loadRegional(['2024', '2025', '2026'], source());
    expect(view.index).toBe(index);
    expect([...view.years.keys()]).toEqual(['2025', '2026']);
  });

  it('is unavailable while the regional data is not published', async () => {
    const missing = source({
      catalog: async () => {
        throw new HttpError(404, 'https://example.org/regional/latest.json');
      },
    });
    expect(await loadRemote(() => loadRegional(['2026'], missing))).toEqual({
      status: 'unavailable',
    });
  });

  it('is an error when anything else fails', async () => {
    const broken = source({
      year: async () => {
        throw new Error('network down');
      },
    });
    expect((await loadRemote(() => loadRegional(['2026'], broken))).status).toBe('error');
  });
});

describe('regionalLoad', () => {
  it('gives the same load for the same years, however the array is built', () => {
    expect(regionalLoad(['2025', '2026'])).toBe(regionalLoad(['2025', '2026']));
    expect(regionalLoad([])).toBe(regionalLoad([]));
  });

  it('gives another load for other years', () => {
    expect(regionalLoad(['2025'])).not.toBe(regionalLoad(['2026']));
    expect(regionalLoad(['2025', '2026'])).not.toBe(regionalLoad(['2026', '2025']));
  });
});
