import { describe, expect, it } from 'vitest';
import { clampToStart, spanOf, yearsOfSpans } from './regionalPeriods';

describe('regional periods', () => {
  it('reads a range as periods', () => {
    expect(spanOf(['2025-11', '2025-12', '2026-01'], { from: 1, to: 2 })).toEqual({
      from: '2025-12',
      to: '2026-01',
    });
  });

  it('lists the years of one or more spans once, skipping missing ones', () => {
    expect(yearsOfSpans({ from: '2025-11', to: '2026-02' }, null)).toEqual(['2025', '2026']);
    expect(
      yearsOfSpans({ from: '2026-01', to: '2026-03' }, { from: '2025-01', to: '2025-03' }),
    ).toEqual(['2025', '2026']);
    expect(yearsOfSpans(null)).toEqual([]);
  });

  it('cuts a span at the start of the data and drops one that lies before it', () => {
    expect(clampToStart({ from: '2019-05', to: '2022-02' }, '2021-01')).toEqual({
      from: '2021-01',
      to: '2022-02',
    });
    expect(clampToStart({ from: '2022-01', to: '2022-02' }, '2021-01')).toEqual({
      from: '2022-01',
      to: '2022-02',
    });
    expect(clampToStart({ from: '2018-01', to: '2020-12' }, '2021-01')).toBeNull();
  });
});
