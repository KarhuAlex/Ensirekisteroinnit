import { describe, expect, it } from 'vitest';
import { groupSeries, totalSeries } from '../src/index.js';

describe('groupSeries', () => {
  it('collapses detailed fuels into chart groups', () => {
    const grouped = groupSeries(
      { series: { petrol: [1, 2], phev_petrol: [3, 0], phev_diesel: [1, 1], cng: [0, 4] } },
      2,
    );
    expect(grouped.petrol).toEqual([1, 2]);
    expect(grouped.phev).toEqual([4, 1]);
    expect(grouped.other).toEqual([0, 4]);
    expect(totalSeries(grouped, 2)).toEqual([5, 7]);
  });
});
