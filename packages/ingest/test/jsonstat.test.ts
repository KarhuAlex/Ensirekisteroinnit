import { describe, expect, it } from 'vitest';
import { collectObservations } from '../src/adapters/traficom-pxweb/adapter.js';
import { iterateCells, type JsonStatDoc } from '../src/adapters/traficom-pxweb/jsonstat.js';

function doc(): JsonStatDoc {
  // 1 area × 2 models × 3 fuels (incl. total) × 2 months, row-major.
  return {
    id: ['Alue', 'Mallisarja', 'Käyttövoima', 'Kuukausi'],
    size: [1, 2, 3, 2],
    dimension: {
      Alue: { category: { index: { MA1: 0 } } },
      Mallisarja: { category: { index: { SSSS: 0, 'ACME ZX3': 1 } } },
      Käyttövoima: { category: { index: { YH: 0, '01': 1, '04': 2 } } },
      Kuukausi: { category: { index: { '2026M01': 0, '2026M02': 1 } } },
    },
    value: [
      // SSSS: YH, 01, 04
      15,
      20,
      10,
      15,
      5,
      5,
      // ACME ZX3: YH, 01, 04 (a ".." cell is null and counts as zero)
      3,
      null,
      0,
      0,
      3,
      null,
    ],
  };
}

describe('iterateCells', () => {
  it('walks cells row-major with coordinates', () => {
    const cells = [...iterateCells(doc())];
    expect(cells).toHaveLength(12);
    expect(cells[0]?.coords).toEqual({
      Alue: 'MA1',
      Mallisarja: 'SSSS',
      Käyttövoima: 'YH',
      Kuukausi: '2026M01',
    });
    expect(cells[11]?.coords['Mallisarja']).toBe('ACME ZX3');
    expect(cells[11]?.coords['Kuukausi']).toBe('2026M02');
  });

  it('rejects inconsistent sizes', () => {
    const bad = doc();
    bad.value.pop();
    expect(() => [...iterateCells(bad)]).toThrow(/does not match/);
  });
});

describe('collectObservations', () => {
  const ids = new Map([
    ['SSSS', 'total'],
    ['ACME ZX3', 'acme-zx3'],
  ]);

  it('emits non-zero fuel rows and skips the reported total', () => {
    const { observations } = collectObservations(doc(), ids);
    expect(observations).toContainEqual({
      entityId: 'total',
      period: '2026-01',
      fuel: 'petrol',
      count: 10,
    });
    expect(observations).toContainEqual({
      entityId: 'acme-zx3',
      period: '2026-01',
      fuel: 'bev',
      count: 3,
    });
    expect(observations.every((o) => o.count > 0)).toBe(true);
    expect(observations).toHaveLength(5);
  });

  it('detects fuel rows that do not add up to the reported total', () => {
    const d = doc();
    d.value[0] = 99;
    expect(collectObservations(d, ids).mismatches).toBe(1);
    expect(collectObservations(doc(), ids).mismatches).toBe(0);
  });

  it('fails loudly on unknown fuel codes', () => {
    const d = doc();
    d.dimension['Käyttövoima'] = { category: { index: { YH: 0, '01': 1, '99': 2 } } };
    expect(() => collectObservations(d, ids)).toThrow(/Unmapped fuel code/);
  });
});
