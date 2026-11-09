import { FUEL_GROUP_IDS } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { defaultState, parseState, toSearchParams } from './reviewState';
import { rankingToCsv } from './rankingCsv';

const months = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];
const parse = (query: string) => parseState(new URLSearchParams(query), months);

describe('review state in the URL', () => {
  it('starts from the latest month, all fuels and a year-ago comparison', () => {
    expect(parse('')).toEqual({
      range: { from: 4, to: 4 },
      level: 'model',
      fuels: [...FUEL_GROUP_IDS],
      compare: 'yearAgo',
    });
  });

  it('reads a range, in either order, and a single month', () => {
    expect(parse('from=2025-12&to=2026-02').range).toEqual({ from: 1, to: 3 });
    expect(parse('from=2026-02&to=2025-12').range).toEqual({ from: 1, to: 3 });
    expect(parse('from=2026-01').range).toEqual({ from: 2, to: 2 });
    expect(parse('to=2026-01').range).toEqual({ from: 2, to: 2 });
  });

  it('falls back to defaults for values it does not know', () => {
    const state = parse('from=1999-01&to=nope&level=x&fuels=steam&cmp=zzz');
    expect(state).toEqual(defaultState(months.length));
  });

  it('keeps known fuels in a fixed order and ignores unknown ones', () => {
    expect(parse('fuels=diesel,bev,steam').fuels).toEqual(['diesel', 'bev']);
  });

  it('round-trips and leaves defaults out of the URL', () => {
    expect(toSearchParams(defaultState(months.length), months).toString()).toBe('');
    const state = parse('from=2025-12&to=2026-02&level=make&fuels=bev,phev&cmp=prev');
    const params = toSearchParams(state, months);
    expect(params.get('from')).toBe('2025-12');
    expect(params.get('cmp')).toBe('prev');
    expect(parseState(params, months)).toEqual(state);
  });
});

describe('rankingToCsv', () => {
  it('writes one line per row and quotes text that needs it', () => {
    const csv = rankingToCsv(
      [
        {
          id: 'a',
          rank: 1,
          count: 150,
          share: 12.345,
          previous: 100,
          mix: { petrol: 100, diesel: 0, bev: 50, phev: 0, other: 0 },
          name: 'Model, "X"',
          make: 'Acme',
        },
        {
          id: 'b',
          rank: 2,
          count: 5,
          share: null,
          previous: null,
          mix: { petrol: 5, diesel: 0, bev: 0, phev: 0, other: 0 },
          name: 'Plain',
          make: '',
        },
      ],
      '2026-03',
    );
    expect(csv.split('\n')).toEqual([
      'rank,name,make,period,registrations,share_pct,previous,change_pct,petrol,diesel,bev,phev,other',
      '1,"Model, ""X""",Acme,2026-03,150,12.35,100,50.00,100,0,50,0,0',
      '2,Plain,,2026-03,5,,,,5,0,0,0,0',
    ]);
  });
});
