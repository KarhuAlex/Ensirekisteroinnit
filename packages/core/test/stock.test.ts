import { describe, expect, it } from 'vitest';
import { monthEndDate, nextQuarter, quarterEndPeriod } from '../src/stock.js';

describe('quarterEndPeriod', () => {
  it('names the month a quarter ends in', () => {
    expect(quarterEndPeriod('2026Q1')).toBe('2026-03');
    expect(quarterEndPeriod('2026Q3')).toBe('2026-09');
    expect(quarterEndPeriod('2008Q4')).toBe('2008-12');
  });

  it('rejects anything that is not a quarter', () => {
    expect(() => quarterEndPeriod('2026-09')).toThrow('Unexpected quarter');
    expect(() => quarterEndPeriod('2026Q5')).toThrow('Unexpected quarter');
  });
});

describe('nextQuarter', () => {
  it('steps within a year and over its end', () => {
    expect(nextQuarter('2026Q2')).toBe('2026Q3');
    expect(nextQuarter('2025Q4')).toBe('2026Q1');
  });
});

describe('monthEndDate', () => {
  it('gives the last day of the month, leap years included', () => {
    expect(monthEndDate('2026-09')).toBe('2026-09-30');
    expect(monthEndDate('2026-12')).toBe('2026-12-31');
    expect(monthEndDate('2024-02')).toBe('2024-02-29');
    expect(monthEndDate('2026-02')).toBe('2026-02-28');
  });
});
