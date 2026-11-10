import {
  FUEL_GROUP_IDS,
  SCHEMA_VERSION,
  type Area,
  type RegionalIndex,
  type RegionalYear,
} from '@regs/core';
import { describe, expect, it } from 'vitest';
import { rankAreas, type AreaGroup, type AreaQuery, type RegionalView } from './regionalRanking';

const areas: Area[] = [
  { id: '049', name: 'Espoo', kind: 'municipality' },
  { id: '698', name: 'Rovaniemi', kind: 'municipality' },
  { id: '091', name: 'Helsinki', kind: 'municipality' },
];

const index: RegionalIndex = {
  schemaVersion: SCHEMA_VERSION,
  release: 'r',
  generatedAt: 'g',
  source: { name: 'n', url: 'u', licence: 'l', updated: 'u' },
  months: ['2025-12', '2026-01'],
  years: ['2025', '2026'],
  entities: ['total', 'tesla'],
  areas,
  groups: [...FUEL_GROUP_IDS],
};

type Cell = [entity: string, area: string, group: string, month: string, count: number];

function view(cells: Cell[]): RegionalView {
  const build = (year: string): RegionalYear => {
    const mine = cells.filter(([, , , month]) => month.startsWith(year));
    return {
      schemaVersion: SCHEMA_VERSION,
      year,
      cells: {
        e: mine.map(([e]) => index.entities.indexOf(e)),
        a: mine.map(([, a]) => areas.findIndex((x) => x.id === a)),
        g: mine.map(([, , g]) => FUEL_GROUP_IDS.indexOf(g as never)),
        m: mine.map(([, , , month]) => index.months.indexOf(month)),
        n: mine.map(([, , , , n]) => n),
      },
    };
  };
  return {
    index,
    years: new Map([
      ['2025', build('2025')],
      ['2026', build('2026')],
    ]),
  };
}

const data = view([
  ['total', '049', 'petrol', '2026-01', 60],
  ['total', '049', 'bev', '2026-01', 40],
  ['tesla', '049', 'bev', '2026-01', 10],
  ['total', '698', 'petrol', '2026-01', 90],
  ['total', '698', 'bev', '2026-01', 10],
  ['tesla', '698', 'bev', '2026-01', 1],
  ['total', '049', 'petrol', '2025-12', 80],
  ['total', '049', 'bev', '2025-12', 20],
  ['tesla', '049', 'bev', '2025-12', 5],
]);

const identity = (area: Area): AreaGroup => ({ id: area.id, name: area.name, kind: area.kind });
const query = (over: Partial<AreaQuery> = {}): AreaQuery => ({
  period: { from: '2026-01', to: '2026-01' },
  fuels: [...FUEL_GROUP_IDS],
  entityId: null,
  compare: null,
  ...over,
});
const row = (ranking: ReturnType<typeof rankAreas>, id: string) =>
  ranking.rows.find((r) => r.id === id)!;

describe('rankAreas', () => {
  it('shares all cars of the selected fuels against the area total', () => {
    const ranking = rankAreas(data, query({ fuels: ['bev'] }), identity);
    expect(row(ranking, '049')).toMatchObject({ count: 40, total: 100, share: 40 });
    expect(row(ranking, '698')).toMatchObject({ count: 10, total: 100, share: 10 });
    expect(ranking.national).toMatchObject({ count: 50, total: 200, share: 25 });
  });

  it('indexes each area against the national share', () => {
    const ranking = rankAreas(data, query({ fuels: ['bev'] }), identity);
    expect(row(ranking, '049').index).toBeCloseTo(160);
    expect(row(ranking, '698').index).toBeCloseTo(40);
  });

  it('ranks one entity and keeps its fuel mix whatever the fuel filter', () => {
    const ranking = rankAreas(data, query({ entityId: 'tesla', fuels: ['petrol'] }), identity);
    expect(row(ranking, '049')).toMatchObject({ count: 0, share: 0 });
    expect(row(ranking, '049').mix.bev).toBe(10);
    const all = rankAreas(data, query({ entityId: 'tesla' }), identity);
    expect(row(all, '049')).toMatchObject({ count: 10, share: 10 });
    expect(row(all, '698')).toMatchObject({ count: 1, share: 1 });
  });

  it('compares with another period and reports the change in percentage points', () => {
    const ranking = rankAreas(
      data,
      query({ fuels: ['bev'], compare: { from: '2025-12', to: '2025-12' } }),
      identity,
    );
    expect(row(ranking, '049')).toMatchObject({
      previousCount: 20,
      previousShare: 20,
      shareChange: 20,
    });
    expect(row(ranking, '698').shareChange).toBeNull();
  });

  it('merges areas into the group chosen by the caller', () => {
    const region = (area: Area): AreaGroup =>
      area.id === '698'
        ? { id: '19', name: 'Lappi', kind: 'region' }
        : { id: '01', name: 'Uusimaa', kind: 'region' };
    const ranking = rankAreas(data, query({ fuels: ['bev'] }), region);
    expect(ranking.rows.map((r) => r.id).sort()).toEqual(['01', '19']);
    expect(row(ranking, '01')).toMatchObject({ count: 40, total: 100 });
  });

  it('marks areas with too few registrations as unreliable', () => {
    const small = view([['total', '049', 'bev', '2026-01', 5]]);
    expect(row(rankAreas(small, query(), identity), '049').reliable).toBe(false);
    expect(row(rankAreas(data, query(), identity), '049').reliable).toBe(true);
  });

  it('gives no share for an area without registrations', () => {
    expect(row(rankAreas(data, query(), identity), '091')).toMatchObject({
      total: 0,
      share: null,
      index: null,
    });
  });
});
