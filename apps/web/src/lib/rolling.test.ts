import { describe, expect, it } from 'vitest';
import { makeFormatters } from './format';
import { axisTop, firstPoint, pointLabel } from './rolling';

const fmt = makeFormatters('fi');

describe('firstPoint', () => {
  it('shows the whole series for quarters whatever the range says', () => {
    expect(firstPoint(true, 75, '1y')).toBe(0);
    expect(firstPoint(true, 75, 'all')).toBe(0);
  });

  it('starts months where the range starts', () => {
    expect(firstPoint(false, 150, 'all')).toBe(0);
    expect(firstPoint(false, 150, '1y')).toBe(138);
  });
});

describe('pointLabel', () => {
  it('names a quarter by the day it ends on', () => {
    expect(pointLabel(fmt, '2026-09', true)).toBe('30.9.2026');
    expect(pointLabel(fmt, '2025-12', true)).toBe('31.12.2025');
  });

  it('names a month by its month and year', () => {
    expect(pointLabel(fmt, '2026-09', false)).toBe('syyskuu 2026');
  });
});

describe('axisTop', () => {
  it('fits the axis to the quarterly shares', () => {
    expect(axisTop(true, [1, 7.6, 14.6])).toBe(20);
    expect(axisTop(true, [30])).toBe(40);
  });

  it('leaves the whole scale to the monthly shares', () => {
    expect(axisTop(false, [1, 7.6, 14.6])).toBeUndefined();
  });
});
