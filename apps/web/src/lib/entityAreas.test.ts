import {
  FUEL_GROUP_IDS,
  SCHEMA_VERSION,
  type Area,
  type FuelGroupId,
  type RegionalIndex,
  type RegionalYear,
} from '@regs/core';
import { describe, expect, it } from 'vitest';
import {
  ENTITY_AREA_MONTHS,
  areasSectionState,
  entityAreaQuery,
  entityAreas,
  lastYearSpan,
  listedAreas,
  TOP_AREAS,
  type ReadyAreas,
  MIN_AREA_COUNT,
  MIN_ENTITY_COUNT,
  standingOf,
} from './entityAreas';
import {
  rankAreas,
  type AreaGroup,
  type AreaRanking,
  type AreaRow,
  type RegionalView,
} from './regionalRanking';

const MONTH_NAMES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
// fourteen months: the twelve of 2025 and the first two of 2026
const months = [
  ...MONTH_NAMES.map((m) => `2025-${m}`),
  ...MONTH_NAMES.slice(0, 2).map((m) => `2026-${m}`),
];

describe('lastYearSpan', () => {
  it('is the last twelve months', () => {
    expect(months).toHaveLength(14);
    expect(lastYearSpan(months)).toEqual({ from: '2025-03', to: '2026-02' });
    expect(ENTITY_AREA_MONTHS).toBe(12);
  });

  it('is all of the months when there are fewer than twelve', () => {
    expect(lastYearSpan(months.slice(0, 5))).toEqual({ from: '2025-01', to: '2025-05' });
  });

  it('is nothing without months', () => {
    expect(lastYearSpan([])).toBeNull();
  });
});

describe('standingOf', () => {
  it('puts an index in words, 100 being the national share', () => {
    expect(standingOf(210)).toBe('far-above');
    expect(standingOf(150)).toBe('far-above');
    expect(standingOf(130)).toBe('above');
    expect(standingOf(100)).toBe('level');
    expect(standingOf(80)).toBe('level');
    expect(standingOf(79.9)).toBe('below');
    expect(standingOf(0)).toBe('below');
  });

  it('has no words for no index', () => {
    expect(standingOf(null)).toBeNull();
  });
});

describe('entityAreaQuery', () => {
  it('asks for all fuels of the entity in the span and has nothing to compare with', () => {
    const query = entityAreaQuery('make-a', { from: '2025-03', to: '2026-02' });
    expect(query).toEqual({
      period: { from: '2025-03', to: '2026-02' },
      fuels: FUEL_GROUP_IDS,
      entityId: 'make-a',
      compare: null,
    });
  });
});

const row = (over: Partial<AreaRow> & Pick<AreaRow, 'id' | 'name'>): AreaRow => ({
  kind: 'region',
  count: 10,
  total: 100,
  share: 10,
  index: 100,
  previousCount: null,
  previousShare: null,
  shareChange: null,
  mix: Object.fromEntries(FUEL_GROUP_IDS.map((g) => [g, 0])) as Record<FuelGroupId, number>,
  reliable: true,
  ...over,
});

const ranking = (rows: AreaRow[], nationalCount = 1000): AreaRanking => ({
  rows,
  national: row({ id: 'national', name: '', count: nationalCount, share: 5 }),
});

describe('entityAreas', () => {
  it('puts the areas in order of the share, the highest first, with their standing', () => {
    const result = entityAreas(
      ranking([
        row({ id: 'a', name: 'A', share: 4, count: 40, index: 80 }),
        row({ id: 'b', name: 'B', share: 12, count: 20, index: 240 }),
        row({ id: 'c', name: 'C', share: 4, count: 90, index: 80 }),
      ]),
    );
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.ranked.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(result.ranked[0]).toMatchObject({ count: 20, share: 12, standing: 'far-above' });
    expect(result.national).toEqual({ count: 1000, share: 5 });
  });

  it('leaves out of the order an area of too few registrations of the make, or in all', () => {
    const result = entityAreas(
      ranking([
        row({ id: 'big', name: 'Big', count: 50 }),
        row({ id: 'few', name: 'Few', count: MIN_AREA_COUNT - 1, share: 80, index: 1600 }),
        row({ id: 'thin', name: 'Thin', count: 30, share: 60, reliable: false }),
        row({ id: 'none', name: 'None', count: 0, share: 0 }),
      ]),
    );
    if (result.kind !== 'ready') throw new Error('expected a result');
    expect(result.ranked.map((r) => r.id)).toEqual(['big']);
    // the rest are kept with their counts, the largest first
    expect(result.small).toEqual([
      { id: 'thin', name: 'Thin', count: 30 },
      { id: 'few', name: 'Few', count: MIN_AREA_COUNT - 1 },
      { id: 'none', name: 'None', count: 0 },
    ]);
  });

  it('keeps an area that has the lowest count that is still ranked', () => {
    const result = entityAreas(ranking([row({ id: 'edge', name: 'Edge', count: MIN_AREA_COUNT })]));
    if (result.kind !== 'ready') throw new Error('expected a result');
    expect(result.ranked.map((r) => r.id)).toEqual(['edge']);
  });

  it('leaves out the registrations abroad and of no known place', () => {
    const result = entityAreas(
      ranking([
        row({ id: 'a', name: 'A' }),
        row({ id: 'unknown', name: 'Unknown', kind: 'unknown' }),
        row({ id: 'abroad', name: 'Abroad', kind: 'abroad' }),
      ]),
    );
    if (result.kind !== 'ready') throw new Error('expected a result');
    expect([...result.ranked, ...result.small].map((r) => r.id)).toEqual(['a']);
  });

  it('works for municipalities as it does for regions', () => {
    const result = entityAreas(
      ranking([row({ id: '091', name: 'Helsinki', kind: 'municipality' })]),
    );
    if (result.kind !== 'ready') throw new Error('expected a result');
    expect(result.ranked.map((r) => r.name)).toEqual(['Helsinki']);
  });

  it('says there are too few when the country has under the limit', () => {
    expect(entityAreas(ranking([row({ id: 'a', name: 'A' })], MIN_ENTITY_COUNT - 1))).toEqual({
      kind: 'too-few',
      count: MIN_ENTITY_COUNT - 1,
    });
    expect(entityAreas(ranking([row({ id: 'a', name: 'A' })], MIN_ENTITY_COUNT)).kind).toBe(
      'ready',
    );
  });
});

describe('entityAreas, from the registrations', () => {
  const areas: Area[] = [
    { id: '001', name: 'Alku', kind: 'municipality' },
    { id: '002', name: 'Keski', kind: 'municipality' },
    { id: '003', name: 'Loppu', kind: 'municipality' },
  ];
  const index: RegionalIndex = {
    schemaVersion: SCHEMA_VERSION,
    release: 'r',
    generatedAt: 'g',
    source: { name: 'n', url: 'u', licence: 'l', updated: 'u' },
    months: ['2026-01'],
    years: ['2026'],
    entities: ['total', 'make-a'],
    areas,
    groups: [...FUEL_GROUP_IDS],
  };
  // entity, area, count (all petrol, in the one month)
  const cells: [string, string, number][] = [
    ['total', '001', 1000],
    ['total', '002', 1000],
    ['total', '003', 100],
    ['make-a', '001', 20],
    ['make-a', '002', 100],
    ['make-a', '003', 3],
  ];
  const year: RegionalYear = {
    schemaVersion: SCHEMA_VERSION,
    year: '2026',
    cells: {
      e: cells.map(([e]) => index.entities.indexOf(e)),
      a: cells.map(([, a]) => areas.findIndex((x) => x.id === a)),
      g: cells.map(() => FUEL_GROUP_IDS.indexOf('petrol')),
      m: cells.map(() => 0),
      n: cells.map(([, , n]) => n),
    },
  };
  const view: RegionalView = { index, years: new Map([['2026', year]]) };
  const groupOf = (area: Area): AreaGroup => ({ id: area.id, name: area.name, kind: area.kind });

  it('ranks the municipalities by the share of their registrations', () => {
    const query = entityAreaQuery('make-a', { from: '2026-01', to: '2026-01' });
    const result = entityAreas(rankAreas(view, query, groupOf));
    if (result.kind !== 'ready') throw new Error('expected a result');
    expect(result.national.count).toBe(123);
    expect(result.ranked.map((r) => [r.id, Math.round(r.share)])).toEqual([
      ['002', 10],
      ['001', 2],
    ]);
    expect(result.ranked[0]?.standing).toBe('far-above');
    expect(result.small).toEqual([{ id: '003', name: 'Loppu', count: 3 }]);
  });
});

describe('listedAreas', () => {
  const ready = (ranked: number, small: number): ReadyAreas => ({
    kind: 'ready',
    national: { count: 100, share: 5 },
    ranked: Array.from({ length: ranked }, (_, i) => ({
      id: `r${i}`,
      name: `R${i}`,
      count: 10,
      share: 10 - i,
      standing: 'level' as const,
    })),
    small: Array.from({ length: small }, (_, i) => ({ id: `s${i}`, name: `S${i}`, count: 1 })),
  });

  it('lists the top few areas until the rest are asked for', () => {
    const listed = listedAreas(ready(12, 3), false);
    expect(listed.ranked).toHaveLength(TOP_AREAS);
    expect(listed.small).toEqual([]);
    expect(listed.canExpand).toBe(true);
  });

  it('lists all the areas, the small ones last, once they are asked for', () => {
    const listed = listedAreas(ready(12, 3), true);
    expect(listed.ranked).toHaveLength(12);
    expect(listed.small).toHaveLength(3);
  });

  it('has nothing more to ask for when everything is listed already', () => {
    expect(listedAreas(ready(TOP_AREAS, 0), false).canExpand).toBe(false);
    expect(listedAreas(ready(2, 0), false).ranked).toHaveLength(2);
    expect(listedAreas(ready(TOP_AREAS, 1), false).canExpand).toBe(true);
  });
});

describe('entityAreas, spread thinly', () => {
  it('says so when the country has enough but no region has enough of them', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({ id: `r${i}`, name: `R${i}`, count: MIN_AREA_COUNT - 1 }),
    );
    expect(entityAreas(ranking(rows, MIN_ENTITY_COUNT + 20))).toEqual({
      kind: 'thin',
      count: MIN_ENTITY_COUNT + 20,
    });
  });

  it('is not thin once one region can be ranked', () => {
    const rows = [
      row({ id: 'a', name: 'A', count: MIN_AREA_COUNT }),
      row({ id: 'b', name: 'B', count: 1 }),
    ];
    expect(entityAreas(ranking(rows)).kind).toBe('ready');
  });
});

describe('areasSectionState', () => {
  it('has no section without regional data', () => {
    expect(areasSectionState('unavailable', 'ready', true)).toBe('hidden');
    expect(areasSectionState('unavailable', 'loading', false)).toBe('hidden');
  });

  it('has no section when the data does not have the make or model', () => {
    expect(areasSectionState('ready', 'ready', false)).toBe('hidden');
  });

  it('fails when either load fails, a missing map file included', () => {
    expect(areasSectionState('error', 'ready', true)).toBe('failed');
    expect(areasSectionState('ready', 'error', true)).toBe('failed');
    expect(areasSectionState('ready', 'unavailable', true)).toBe('failed');
  });

  it('waits until both are loaded, and then shows the section', () => {
    expect(areasSectionState('loading', 'loading', false)).toBe('loading');
    expect(areasSectionState('ready', 'loading', true)).toBe('loading');
    expect(areasSectionState('loading', 'ready', false)).toBe('loading');
    expect(areasSectionState('ready', 'ready', true)).toBe('ready');
  });
});
