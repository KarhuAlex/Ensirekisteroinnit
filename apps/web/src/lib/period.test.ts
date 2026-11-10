import { describe, expect, it } from 'vitest';
import {
  describeRange,
  presetRange,
  rangeOfPeriod,
  translateRange,
  stepRange,
  yearRange,
  yearsOf,
} from './period';

const months = [
  ...Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`),
];

describe('period helpers', () => {
  it('finds the months of a year that exist in the data', () => {
    expect(yearRange(months, '2025')).toEqual({ from: 0, to: 11 });
    expect(yearRange(months, '2026')).toEqual({ from: 12, to: 21 });
    expect(yearRange(months, '2024')).toBeNull();
    expect(yearsOf(months)).toEqual(['2025', '2026']);
  });

  it('turns a table period into the months it covers', () => {
    expect(rangeOfPeriod(months, '2026-03')).toEqual({ from: 14, to: 14 });
    expect(rangeOfPeriod(months, '2025')).toEqual({ from: 0, to: 11 });
    expect(rangeOfPeriod(months, '2026')).toEqual({ from: 12, to: 21 });
    expect(rangeOfPeriod(months, '2024')).toBeNull();
    expect(rangeOfPeriod(months, '2024-05')).toBeNull();
  });

  it('describes a range the way a person would say it', () => {
    expect(describeRange(months, { from: 21, to: 21 })).toEqual({
      kind: 'month',
      period: '2026-10',
    });
    expect(describeRange(months, { from: 0, to: 11 })).toEqual({
      kind: 'year',
      year: '2025',
      partial: false,
    });
    expect(describeRange(months, { from: 12, to: 21 })).toEqual({
      kind: 'year',
      year: '2026',
      partial: true,
    });
    expect(describeRange(months, { from: 3, to: 14 })).toEqual({
      kind: 'span',
      from: '2025-04',
      to: '2026-03',
    });
  });

  it('builds the presets from the latest month', () => {
    expect(presetRange(months, 'latest')).toEqual({ from: 21, to: 21 });
    expect(presetRange(months, 'last3')).toEqual({ from: 19, to: 21 });
    expect(presetRange(months, 'last12')).toEqual({ from: 10, to: 21 });
    expect(presetRange(months, 'thisYear')).toEqual({ from: 12, to: 21 });
    expect(presetRange(months, 'lastYear')).toEqual({ from: 0, to: 11 });
    expect(presetRange(months, 'all')).toEqual({ from: 0, to: 21 });
  });

  it('has no previous-year preset when the data starts in the latest year', () => {
    expect(presetRange(months.slice(12), 'lastYear')).toBeNull();
    expect(presetRange([], 'latest')).toBeNull();
  });
});

describe('stepRange', () => {
  it('steps by the length of the range', () => {
    expect(stepRange({ from: 5, to: 7 }, 1, 24)).toEqual({ from: 8, to: 10 });
    expect(stepRange({ from: 5, to: 7 }, -1, 24)).toEqual({ from: 2, to: 4 });
  });

  it('keeps stepping until the edge of the data, then stops', () => {
    expect(stepRange({ from: 1, to: 3 }, -1, 24)).toEqual({ from: 0, to: 2 });
    expect(stepRange({ from: 0, to: 2 }, -1, 24)).toBeNull();
    expect(stepRange({ from: 20, to: 22 }, 1, 24)).toEqual({ from: 21, to: 23 });
    expect(stepRange({ from: 21, to: 23 }, 1, 24)).toBeNull();
  });
});

describe('translateRange', () => {
  const national = ['2025-12', '2026-01', '2026-02', '2026-03'];

  it('finds the same months in another list', () => {
    expect(translateRange(national, ['2026-01', '2026-02', '2026-03'], { from: 1, to: 2 })).toEqual(
      {
        from: 0,
        to: 1,
      },
    );
  });

  it('keeps the part of the range that the other list has', () => {
    expect(translateRange(national, ['2025-12', '2026-01'], { from: 1, to: 3 })).toEqual({
      from: 1,
      to: 1,
    });
  });

  it('has no range when none of the months exist there', () => {
    expect(translateRange(national, ['2020-01'], { from: 0, to: 3 })).toBeNull();
  });
});
