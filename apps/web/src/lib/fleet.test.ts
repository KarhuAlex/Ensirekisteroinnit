import type { CarFleet, FleetMake, GroupCounts } from '@regs/core';
import { describe, expect, it } from 'vitest';
import {
  electricShare,
  fleetAreaRows,
  fleetMakeRows,
  fleetRegionRows,
  fleetSummary,
  mapScaleTop,
  meanAge,
  MIN_MAKE_CARS,
  MIN_MUNICIPALITY_CARS,
  otherRows,
} from './fleet';

const counts = (c: Partial<GroupCounts>): GroupCounts => ({
  petrol: 0,
  diesel: 0,
  bev: 0,
  phev: 0,
  other: 0,
  ...c,
});

const make = (
  id: string,
  kind: FleetMake['kind'],
  c: Partial<GroupCounts>,
  age = { cars: 0, years: 0 },
): FleetMake => ({
  id,
  name: id.toUpperCase(),
  kind,
  counts: counts(c),
  age,
});

const fleet: CarFleet = {
  schemaVersion: 1,
  release: 'r',
  generatedAt: '2026-11-10T00:00:00Z',
  source: { id: 's', name: 'n', url: 'u', licence: 'CC BY 4.0', updated: 'v' },
  date: '2026-09-30',
  total: {
    counts: counts({ petrol: 7000, bev: 2000, phev: 1000 }),
    age: { cars: 10_000, years: 130_000 },
  },
  areas: [
    {
      id: '091',
      name: 'Helsinki',
      kind: 'municipality',
      counts: counts({ petrol: 3000, bev: 1500 }),
    },
    { id: '999', name: 'Pieni', kind: 'municipality', counts: counts({ petrol: 90, bev: 10 }) },
    { id: 'abroad', name: 'Ulkomaat', kind: 'abroad', counts: counts({ petrol: 100 }) },
  ],
  makes: [
    make('toyota', 'make', { petrol: 5000, bev: 100 }, { cars: 5100, years: 71_400 }),
    make('rare', 'make', { petrol: 40, bev: 10 }, { cars: 50, years: 1000 }),
    make('muut-merkit-yhteensa', 'others', { petrol: 500 }),
    make('matkailuautot-yhteensa', 'motorhomes', { diesel: 300 }),
  ],
};

describe('electricShare', () => {
  it('gives battery electric alone or with the plug-in hybrids', () => {
    const c = counts({ petrol: 70, bev: 20, phev: 10 });
    expect(electricShare(c, 'bev')).toBe(20);
    expect(electricShare(c, 'plug')).toBe(30);
  });

  it('has no share for no cars', () => {
    expect(electricShare(counts({}), 'bev')).toBeNull();
  });
});

describe('meanAge', () => {
  it('divides the sum of the ages by the cars, and has none without cars', () => {
    expect(meanAge({ cars: 10_000, years: 130_000 })).toBe(13);
    expect(meanAge({ cars: 0, years: 0 })).toBeNull();
  });
});

describe('fleetAreaRows', () => {
  it('lists the municipalities only and marks the ones with too few cars', () => {
    const rows = fleetAreaRows(fleet);
    expect(rows.map((r) => r.id)).toEqual(['091', '999']);
    expect(rows[0]).toMatchObject({ cars: 4500, bevShare: (1500 / 4500) * 100, reliable: true });
    expect(rows[1]).toMatchObject({ cars: 100, reliable: false });
    expect(MIN_MUNICIPALITY_CARS).toBeGreaterThan(100);
  });
});

describe('fleetMakeRows', () => {
  it('lists the makes, leaving out motorhomes and other makes', () => {
    expect(fleetMakeRows(fleet).map((r) => r.id)).toEqual(['toyota', 'rare']);
  });

  it('gives each make its part of the fleet, its share and its age', () => {
    const [toyota] = fleetMakeRows(fleet);
    expect(toyota).toMatchObject({ cars: 5100, fleetShare: 51, meanAge: 14 });
    expect(toyota?.bevShare).toBeCloseTo((100 / 5100) * 100, 5);
  });

  it('gives no share to a make with few cars but still counts them', () => {
    const rare = fleetMakeRows(fleet)[1];
    expect(rare).toMatchObject({ cars: 50, bevShare: null });
    expect(MIN_MAKE_CARS).toBeGreaterThan(50);
  });
});

describe('otherRows', () => {
  it('counts the cars of the rows that are not a make', () => {
    expect(otherRows(fleet)).toEqual({ motorhomes: 300, others: 500 });
  });
});

describe('fleetSummary', () => {
  it('gives the cars, both shares and the age of the whole fleet', () => {
    expect(fleetSummary(fleet)).toEqual({ cars: 10_000, bevShare: 20, plugShare: 30, meanAge: 13 });
  });
});

describe('mapScaleTop', () => {
  it('rounds the highest coloured share up and ignores municipalities with too few cars', () => {
    const rows = fleetAreaRows(fleet);
    expect(mapScaleTop(rows, 'bev')).toBe(34);
    const small = rows.map((r) => ({ ...r, reliable: false }));
    expect(mapScaleTop(small, 'bev')).toBe(1);
  });
});

describe('fleetRegionRows', () => {
  const mapping = {
    regionOfMunicipality: new Map([
      ['091', '01'],
      ['049', '01'],
      ['999', '02'],
    ]),
    regionName: new Map([
      ['01', 'Uusimaa'],
      ['02', 'Lappi'],
    ]),
  };
  const withEspoo: CarFleet = {
    ...fleet,
    areas: [
      ...fleet.areas,
      { id: '049', name: 'Espoo', kind: 'municipality', counts: counts({ petrol: 500, bev: 500 }) },
      { id: '000', name: 'Tuntematon kunta', kind: 'municipality', counts: counts({ petrol: 50 }) },
    ],
  };

  it('adds the municipalities of each region together', () => {
    const rows = fleetRegionRows(withEspoo, mapping);
    const uusimaa = rows.find((r) => r.id === '01');
    expect(uusimaa).toMatchObject({ name: 'Uusimaa', cars: 5500, bevShare: (2000 / 5500) * 100 });
    expect(rows.find((r) => r.id === '02')).toMatchObject({ name: 'Lappi', cars: 100 });
  });

  it('leaves out cars abroad and municipalities of no known region', () => {
    const ids = fleetRegionRows(withEspoo, mapping).map((r) => r.id);
    expect(ids.sort()).toEqual(['01', '02']);
  });
});
