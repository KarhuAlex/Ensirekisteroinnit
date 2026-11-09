import { FUEL_GROUP_IDS, SCHEMA_VERSION, type FuelGroupId, type Matrix } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { changeOf, comparisonRange, rankEntities, shiftRange, type RankQuery } from './ranking';

const months = Array.from({ length: 24 }, (_, i) => {
  const year = 2024 + Math.floor(i / 12);
  return `${year}-${String((i % 12) + 1).padStart(2, '0')}`;
});

function matrixOf(cells: [string, FuelGroupId, number, number][]): Matrix {
  const ids = [...new Set(cells.map(([id]) => id))];
  const rows = ids.map((id) => {
    const counts = new Array<number>(FUEL_GROUP_IDS.length * months.length).fill(0);
    for (const [cell, group, month, n] of cells) {
      if (cell === id) counts[FUEL_GROUP_IDS.indexOf(group) * months.length + month]! += n;
    }
    return { id, counts };
  });
  return { schemaVersion: SCHEMA_VERSION, months, groups: [...FUEL_GROUP_IDS], rows };
}

const matrix = matrixOf([
  ['total', 'petrol', 23, 60],
  ['total', 'bev', 23, 40],
  ['total', 'petrol', 11, 50],
  ['total', 'bev', 11, 10],
  ['alpha', 'bev', 23, 40],
  ['alpha', 'bev', 11, 10],
  ['beta', 'petrol', 23, 30],
  ['beta', 'petrol', 11, 30],
  ['gamma', 'petrol', 23, 30],
  ['gamma', 'petrol', 22, 5],
  ['gone', 'petrol', 5, 7],
]);

const query = (over: Partial<RankQuery> = {}): RankQuery => ({
  range: { from: 23, to: 23 },
  fuels: [...FUEL_GROUP_IDS],
  compare: 'none',
  include: (id) => id !== 'total',
  ...over,
});

describe('rankEntities', () => {
  it('orders by registrations in the range and gives ties the same rank', () => {
    const { rows } = rankEntities(matrix, query());
    expect(rows.map((r) => [r.id, r.rank, r.count])).toEqual([
      ['alpha', 1, 40],
      ['beta', 2, 30],
      ['gamma', 2, 30],
    ]);
  });

  it('sums over several months and leaves out entities with none', () => {
    const { rows } = rankEntities(matrix, query({ range: { from: 22, to: 23 } }));
    expect(rows.find((r) => r.id === 'gamma')?.count).toBe(35);
    expect(rows.some((r) => r.id === 'gone')).toBe(false);
    const wide = rankEntities(matrix, query({ range: { from: 0, to: 23 } }));
    expect(wide.rows.find((r) => r.id === 'gone')?.count).toBe(7);
  });

  it('counts only the selected fuels and shares them against the same fuels', () => {
    const ranking = rankEntities(matrix, query({ fuels: ['bev'] }));
    expect(ranking.rows.map((r) => r.id)).toEqual(['alpha']);
    expect(ranking.total).toBe(40);
    expect(ranking.rows[0]?.share).toBe(100);
  });

  it('keeps the full fuel mix whatever the filter', () => {
    const mixed = matrixOf([
      ['total', 'bev', 23, 10],
      ['total', 'petrol', 23, 30],
      ['delta', 'bev', 23, 4],
      ['delta', 'petrol', 23, 6],
    ]);
    const [row] = rankEntities(mixed, query({ fuels: ['bev'] })).rows;
    expect(row?.count).toBe(4);
    expect(row?.share).toBe(40);
    expect(row?.mix).toMatchObject({ bev: 4, petrol: 6 });
  });

  it('applies the entity filter', () => {
    const { rows } = rankEntities(matrix, query({ include: (id) => id === 'beta' }));
    expect(rows.map((r) => r.id)).toEqual(['beta']);
  });

  it('attaches the comparison period counts', () => {
    const ranking = rankEntities(matrix, query({ compare: 'yearAgo' }));
    expect(ranking.comparison).toEqual({ from: 11, to: 11 });
    expect(ranking.rows.find((r) => r.id === 'alpha')?.previous).toBe(10);
    expect(ranking.rows.find((r) => r.id === 'gamma')?.previous).toBe(0);
    expect(ranking.previousTotal).toBe(60);
  });

  it('has no comparison when it would fall before the data', () => {
    const ranking = rankEntities(matrix, query({ range: { from: 0, to: 0 }, compare: 'previous' }));
    expect(ranking.comparison).toBeNull();
    expect(ranking.previousTotal).toBeNull();
    expect(ranking.rows.every((r) => r.previous === null)).toBe(true);
  });
});

describe('ranges', () => {
  it('shifts by whole months and refuses to leave the data', () => {
    expect(shiftRange({ from: 5, to: 7 }, -3, 24)).toEqual({ from: 2, to: 4 });
    expect(shiftRange({ from: 1, to: 2 }, -2, 24)).toBeNull();
    expect(shiftRange({ from: 22, to: 23 }, 1, 24)).toBeNull();
  });

  it('compares with the period before or the same months a year earlier', () => {
    const range = { from: 20, to: 22 };
    expect(comparisonRange(range, 'previous', 24)).toEqual({ from: 17, to: 19 });
    expect(comparisonRange(range, 'yearAgo', 24)).toEqual({ from: 8, to: 10 });
    expect(comparisonRange(range, 'none', 24)).toBeNull();
  });

  it('offers a year earlier only for spans of up to a year', () => {
    expect(comparisonRange({ from: 12, to: 23 }, 'yearAgo', 24)).toEqual({ from: 0, to: 11 });
    expect(comparisonRange({ from: 6, to: 23 }, 'yearAgo', 24)).toBeNull();
  });
});

describe('changeOf', () => {
  it('reports no change without a comparison', () => {
    expect(changeOf(5, null)).toBeNull();
  });

  it('gives the percentage when the base is large enough', () => {
    expect(changeOf(150, 100)).toEqual({ delta: 50, percent: 50 });
  });

  it('withholds the percentage for a tiny base but keeps the difference', () => {
    expect(changeOf(9, 2)).toEqual({ delta: 7, percent: null });
    expect(changeOf(5, 0)).toEqual({ delta: 5, percent: null });
  });
});
