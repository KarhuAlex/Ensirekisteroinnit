import { describe, expect, it } from 'vitest';
import {
  aggregateByYear,
  modelStory,
  percent,
  rangeStart,
  rollingShare,
  rollingSum,
  shareBand,
  sumRange,
  toneOf,
} from './stats';

describe('aggregateByYear', () => {
  it('sums months into calendar years', () => {
    const months = ['2024-11', '2024-12', '2025-01'];
    const grouped = {
      bev: [1, 2, 4],
      phev: [0, 0, 1],
      petrol: [5, 5, 5],
      diesel: [0, 0, 0],
      other: [0, 0, 0],
    };
    const result = aggregateByYear(months, grouped);
    expect(result.years).toEqual(['2024', '2025']);
    expect(result.grouped.bev).toEqual([3, 4]);
    expect(result.grouped.petrol).toEqual([10, 5]);
  });
});

describe('rollingShare', () => {
  it('is null until a full window exists', () => {
    expect(rollingShare([1, 1, 1, 1], [2, 2, 2, 2], 3)).toEqual([null, null, 50, 50]);
  });
  it('is null when the window holds no registrations', () => {
    expect(rollingShare([0, 0], [0, 0], 2)).toEqual([null, null]);
  });
});

describe('helpers', () => {
  it('sumRange clamps to the array', () => {
    expect(sumRange([1, 2, 3], -2, 10)).toBe(6);
    expect(sumRange([1, 2, 3], 1, 2)).toBe(2);
  });
  it('percent guards against division by zero', () => {
    expect(percent(1, 0)).toBeNull();
    expect(percent(1, 4)).toBe(25);
  });
});

describe('rangeStart', () => {
  it('maps presets to the first visible month index', () => {
    expect(rangeStart(154, 'all')).toBe(0);
    expect(rangeStart(154, '5y')).toBe(94);
    expect(rangeStart(154, '1y')).toBe(142);
  });
  it('never goes below zero for short series', () => {
    expect(rangeStart(8, '5y')).toBe(0);
  });
});

describe('modelStory', () => {
  it('describes models with no recent registrations', () => {
    expect(modelStory(0, 0)).toEqual({ kind: 'none' });
  });
  it('detects all-electric models', () => {
    expect(modelStory(714, 714)).toEqual({ kind: 'all-electric', count: 714 });
  });
  it('reports the electric share for mixed models', () => {
    expect(modelStory(200, 50)).toEqual({ kind: 'mixed', count: 200, bevShare: 25 });
  });
});

describe('toneOf', () => {
  it('is positive for a rise, negative for a fall and neutral otherwise', () => {
    expect(toneOf(2)).toBe('positive');
    expect(toneOf(-2)).toBe('negative');
    expect(toneOf(0)).toBe('neutral');
    expect(toneOf(null)).toBe('neutral');
  });
});

describe('shareBand', () => {
  it('separates under one percent, up to half and more than half', () => {
    expect(shareBand(0)).toBe('low');
    expect(shareBand(0.4)).toBe('low');
    expect(shareBand(0.99)).toBe('low');
    expect(shareBand(1)).toBe('some');
    expect(shareBand(50)).toBe('some');
    expect(shareBand(50.1)).toBe('most');
    expect(shareBand(100)).toBe('most');
  });

  it('has no band without a share', () => {
    expect(shareBand(null)).toBeNull();
  });
});

describe('rollingSum', () => {
  it('adds the trailing window, and what exists while the window is cut off', () => {
    expect(rollingSum([1, 2, 3, 4], 3)).toEqual([1, 3, 6, 9]);
  });
});
