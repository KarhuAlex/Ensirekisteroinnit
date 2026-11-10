import { describe, expect, it } from 'vitest';
import { alignToMonths, lastPricedIndex } from './prices';
import { rollingMean } from './stats';

describe('alignToMonths', () => {
  const from = ['2013-11', '2013-12', '2014-01'];

  it('takes the values of the months it is asked for', () => {
    expect(alignToMonths(['2013-12', '2014-01'], from, [1, 2, 3])).toEqual([2, 3]);
  });

  it('leaves months the source does not have empty', () => {
    expect(alignToMonths(['2013-10', '2013-11', '2014-02'], from, [1, 2, 3])).toEqual([
      null,
      1,
      null,
    ]);
  });

  it('keeps a gap in the source as a gap', () => {
    expect(alignToMonths(['2013-12'], from, [1, null, 3])).toEqual([null]);
  });
});

describe('rollingMean', () => {
  it('averages each full window and is empty until one exists', () => {
    expect(rollingMean([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });

  it('is empty where the window has a gap', () => {
    expect(rollingMean([1, null, 3, 4, 5], 2)).toEqual([null, null, null, 3.5, 4.5]);
  });
});

describe('lastPricedIndex', () => {
  it('finds the last month with a price for either fuel', () => {
    expect(lastPricedIndex([1, 2, null], [1, null, null])).toBe(1);
    expect(lastPricedIndex([1, null, null], [1, 2, null])).toBe(1);
  });

  it('is empty when there are no prices', () => {
    expect(lastPricedIndex([null, null], [null])).toBeNull();
  });
});
