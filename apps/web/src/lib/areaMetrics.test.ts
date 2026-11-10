import { FUEL_GROUP_IDS } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { colourScale, effectiveMetric, isUnnarrowed, metricValue } from './areaMetrics';
import type { AreaRow } from './regionalRanking';
import { defaultState } from './reviewState';

const row = (over: Partial<AreaRow> = {}): AreaRow => ({
  id: 'a',
  name: 'A',
  kind: 'municipality',
  count: 10,
  total: 100,
  share: 10,
  index: 80,
  previousCount: 5,
  previousShare: 5,
  shareChange: 5,
  mix: { petrol: 0, diesel: 0, bev: 0, phev: 0, other: 0 },
  reliable: true,
  ...over,
});

describe('metricValue', () => {
  it('reads the value of each metric', () => {
    expect(metricValue(row(), 'share')).toBe(10);
    expect(metricValue(row(), 'index')).toBe(80);
    expect(metricValue(row(), 'count')).toBe(10);
    expect(metricValue(row(), 'change')).toBe(5);
  });

  it('gives no value for an unreliable area, except the plain count', () => {
    const small = row({ reliable: false });
    expect(metricValue(small, 'share')).toBeNull();
    expect(metricValue(small, 'index')).toBeNull();
    expect(metricValue(small, 'count')).toBe(10);
  });
});

describe('colourScale', () => {
  it('runs from zero to the largest value for plain metrics', () => {
    expect(colourScale([2, 8, null], 'share')).toEqual({ min: 0, max: 8 });
  });

  it('is symmetric around the centre for diverging metrics', () => {
    expect(colourScale([60, 130], 'index')).toEqual({ min: 60, max: 140 });
    expect(colourScale([-2, 1], 'change')).toEqual({ min: -2, max: 2 });
    expect(colourScale([450, 80], 'index')).toEqual({ min: 0, max: 200 });
  });

  it('has a usable scale when nothing has a value', () => {
    expect(colourScale([null], 'share')).toEqual({ min: 0, max: 1 });
  });
});

describe('unnarrowed areas', () => {
  const state = defaultState(12);

  it('shows only the count when nothing narrows the numerator', () => {
    expect(isUnnarrowed(state)).toBe(true);
    expect(effectiveMetric({ ...state, areaMetric: 'index' })).toBe('count');
  });

  it('keeps the chosen metric once a fuel or an entity narrows it', () => {
    expect(effectiveMetric({ ...state, fuels: ['bev'], areaMetric: 'index' })).toBe('index');
    expect(effectiveMetric({ ...state, entity: 'x', areaMetric: 'share' })).toBe('share');
    expect(FUEL_GROUP_IDS.length).toBeGreaterThan(1);
  });
});
