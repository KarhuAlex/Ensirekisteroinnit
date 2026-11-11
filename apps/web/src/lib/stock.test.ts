import type { CarStock } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { latestStock, stockShares } from './stock';

const stock: CarStock = {
  schemaVersion: 1,
  release: 'r',
  generatedAt: '2026-11-10T00:00:00Z',
  source: { id: 's', name: 'n', url: 'u', licence: 'CC BY 4.0', updated: 'v' },
  quarters: ['2025Q4', '2026Q1', '2026Q3'],
  series: {
    petrol: [800, 780, 700],
    diesel: [100, 100, 100],
    bev: [50, 60, 100],
    phev: [40, 50, 90],
    other: [10, 10, 10],
  },
  total: [1000, 1000, 1000],
};

describe('stockShares', () => {
  it('names each quarter by the month it ends in', () => {
    expect(stockShares(stock).periods).toEqual(['2025-12', '2026-03', '2026-09']);
  });

  it('gives the battery-electric share and the plug-in share with the hybrids added', () => {
    const { bev, plugIn } = stockShares(stock);
    expect(bev).toEqual([5, 6, 10]);
    expect(plugIn).toEqual([9, 11, 19]);
  });

  it('leaves a quarter without a total empty instead of dividing by zero', () => {
    const { bev } = stockShares({ ...stock, total: [0, 1000, 1000] });
    expect(bev[0]).toBeNull();
  });
});

describe('latestStock', () => {
  it('describes the newest quarter and the day it was counted on', () => {
    expect(latestStock(stock)).toEqual({ date: '2026-09-30', bevShare: 10 });
  });

  it('has nothing to describe when the newest quarter has no total', () => {
    expect(latestStock({ ...stock, total: [1000, 1000, 0] })).toBeNull();
  });

  it('has nothing to describe without quarters', () => {
    expect(
      latestStock({
        ...stock,
        quarters: [],
        total: [],
        series: { petrol: [], diesel: [], bev: [], phev: [], other: [] },
      }),
    ).toBeNull();
  });
});
