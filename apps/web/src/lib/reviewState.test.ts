import { FUEL_GROUP_IDS } from '@regs/core';
import { describe, expect, it } from 'vitest';
import {
  defaultState,
  effectiveLevel,
  levelAvailable,
  parseState,
  entityAreasPath,
  reviewPath,
  reviewSearch,
  toSearchParams,
  withAvailableLevel,
} from './reviewState';
import { rankingToCsv } from './rankingCsv';

const months = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];
const parse = (query: string) => parseState(new URLSearchParams(query), months);

describe('review state in the URL', () => {
  it('starts from the latest month, all fuels and a year-ago comparison', () => {
    expect(parse('')).toEqual({
      range: { from: 4, to: 4 },
      source: 'new',
      level: 'model',
      fuels: [...FUEL_GROUP_IDS],
      compare: 'yearAgo',
      areaLevel: 'region',
      areaMetric: 'share',
      entity: null,
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

  it('reads the area view choices and ignores unknown ones', () => {
    const state = parse('level=area&by=municipality&metric=index&entity=tesla-motors');
    expect(state).toMatchObject({
      level: 'area',
      areaLevel: 'municipality',
      areaMetric: 'index',
      entity: 'tesla-motors',
    });
    expect(parse('level=nope&by=x&metric=y')).toMatchObject({
      level: 'model',
      areaLevel: 'region',
      areaMetric: 'share',
    });
  });

  it('reads the source and falls back to new cars', () => {
    expect(parse('source=used').source).toBe('used');
    expect(parse('source=nope').source).toBe('new');
  });

  it('offers only the make level for cars imported used', () => {
    expect(levelAvailable('used', 'make')).toBe(true);
    expect(levelAvailable('used', 'model')).toBe(false);
    expect(levelAvailable('used', 'area')).toBe(false);
    expect(levelAvailable('new', 'area')).toBe(true);
  });

  it('shows make level only for cars imported used', () => {
    expect(effectiveLevel({ source: 'used', level: 'area' })).toBe('make');
    expect(effectiveLevel({ source: 'new', level: 'area' })).toBe('area');
  });

  it('round-trips and leaves defaults out of the URL', () => {
    expect(toSearchParams(defaultState(months.length), months).toString()).toBe('');
    const state = parse(
      'from=2025-12&to=2026-02&source=used&level=area&fuels=bev,phev&cmp=prev&by=municipality&metric=change&entity=x',
    );
    const params = toSearchParams(state, months);
    expect(params.get('from')).toBe('2025-12');
    expect(params.get('cmp')).toBe('prev');
    expect(parseState(params, months)).toEqual(state);
  });
});

describe('withAvailableLevel', () => {
  const groups = parseState(new URLSearchParams('level=corporategroup'), months);

  it('keeps the corporate group level when the data has groups', () => {
    expect(withAvailableLevel(groups, true).level).toBe('corporategroup');
  });

  it('falls back to models when it has none, and leaves other levels alone', () => {
    expect(withAvailableLevel(groups, false).level).toBe('model');
    const make = parseState(new URLSearchParams('level=make'), months);
    expect(withAvailableLevel(make, false)).toBe(make);
  });
});

describe('reviewSearch', () => {
  it('opens the review on a month or a span with everything else left at its default', () => {
    expect(reviewSearch(months, { from: 1, to: 1 })).toBe('?from=2025-12&to=2025-12');
    expect(reviewSearch(months, { from: 1, to: 3 })).toBe('?from=2025-12&to=2026-02');
  });

  it('is empty for the latest month, which is the default', () => {
    expect(reviewSearch(months, { from: 4, to: 4 })).toBe('');
  });
});

describe('reviewPath', () => {
  it('links a month, a year and the latest month to the review in the page language', () => {
    expect(reviewPath('fi', months, '2025-12')).toBe('/fi/review?from=2025-12&to=2025-12');
    expect(reviewPath('en', months, '2026')).toBe('/en/review?from=2026-01&to=2026-03');
    expect(reviewPath('fi', months, '2026-03')).toBe('/fi/review');
  });

  it('has no link for a period the data does not have', () => {
    expect(reviewPath('fi', months, '2019')).toBeNull();
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

describe('entityAreasPath', () => {
  const span = { from: '2025-12', to: '2026-03' };

  it('opens the area view of a make or model over a span, by municipality', () => {
    const path = entityAreasPath('fi', months, 'make-a', span);
    const params = new URL(path ?? '', 'https://example.org').searchParams;
    expect(path?.startsWith('/fi/review?')).toBe(true);
    expect(parseState(params, months)).toMatchObject({
      level: 'area',
      areaLevel: 'municipality',
      entity: 'make-a',
      compare: 'none',
      range: { from: months.indexOf('2025-12'), to: months.indexOf('2026-03') },
    });
  });

  it('has no path for a span the months do not have', () => {
    expect(entityAreasPath('fi', months, 'make-a', { from: '2019-01', to: '2026-03' })).toBeNull();
  });
});
