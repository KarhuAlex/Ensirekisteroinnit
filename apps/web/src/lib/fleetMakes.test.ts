import type { CarFleet, FleetCell, GroupCounts } from '@regs/core';
import { describe, expect, it } from 'vitest';
import {
  cellsNeeded,
  chosenMake,
  fleetAreaMakeRows,
  fleetMakeAreaRows,
  fleetMakeOptions,
  groupCellsByMake,
  hasFewCars,
  isFuelFilter,
  makeScaleTop,
  shareRank,
} from './fleetMakes';
import { MIN_MAKE_CARS } from './fleet';

const counts = (c: Partial<GroupCounts>): GroupCounts => ({
  petrol: 0,
  diesel: 0,
  bev: 0,
  phev: 0,
  other: 0,
  ...c,
});
const cell = (area: string, make: string, c: Partial<GroupCounts>): FleetCell => ({
  area,
  make,
  counts: counts(c),
});

const area = (id: string, name: string, c: Partial<GroupCounts>) => ({
  id,
  name,
  kind: 'municipality' as const,
  counts: counts(c),
});

// Two municipalities of one region with plenty of cars, a third with few, and one with no region.
const fleet = {
  areas: [
    area('001', 'Alku', { petrol: 8000, bev: 2000 }),
    area('002', 'Keski', { petrol: 4000, bev: 1000 }),
    area('003', 'Pieni', { petrol: 90, bev: 10 }),
    area('004', 'Vieras', { petrol: 3000 }),
  ],
  makes: [
    { id: 'zeta', name: 'Zeta', kind: 'make', counts: counts({}), age: { cars: 0, years: 0 } },
    { id: 'äkkiä', name: 'Äkkiä', kind: 'make', counts: counts({}), age: { cars: 0, years: 0 } },
    { id: 'alfa', name: 'Alfa', kind: 'make', counts: counts({}), age: { cars: 0, years: 0 } },
    { id: 'muut', name: 'Muut', kind: 'others', counts: counts({}), age: { cars: 0, years: 0 } },
  ],
} as unknown as CarFleet;

const mapping = {
  regionOfMunicipality: new Map([
    ['001', 'R1'],
    ['002', 'R1'],
    ['003', 'R2'],
  ]),
  regionName: new Map([
    ['R1', 'Alue yksi'],
    ['R2', 'Alue kaksi'],
  ]),
};

const cells = [
  cell('001', 'alfa', { petrol: 500, bev: 500 }),
  cell('002', 'alfa', { bev: 100 }),
  cell('003', 'alfa', { bev: 5 }),
  cell('004', 'alfa', { petrol: 30 }),
  cell('001', 'zeta', { petrol: 10 }),
];

describe('fleetMakeAreaRows', () => {
  const alfa = groupCellsByMake(cells).get('alfa')!;

  it('gives each municipality the share of its cars that are of the make', () => {
    const rows = fleetMakeAreaRows(fleet, alfa, 'all', 'municipality', mapping);
    expect(rows.map((r) => [r.id, r.cars, r.makeCars])).toEqual([
      ['001', 10_000, 1000],
      ['002', 5000, 100],
      ['003', 100, 5],
      ['004', 3000, 30],
    ]);
    expect(rows[0]?.share).toBeCloseTo(10);
    expect(rows[1]?.share).toBeCloseTo(2);
  });

  it('counts only the cars of the chosen fuel', () => {
    const bev = fleetMakeAreaRows(fleet, alfa, 'bev', 'municipality', mapping);
    expect(bev.map((r) => r.makeCars)).toEqual([500, 100, 5, 0]);
    const petrol = fleetMakeAreaRows(fleet, alfa, 'petrol', 'municipality', mapping);
    expect(petrol.map((r) => r.makeCars)).toEqual([500, 0, 0, 30]);
  });

  it('adds the municipalities of a region up, and leaves out those of no region', () => {
    const rows = fleetMakeAreaRows(fleet, alfa, 'all', 'region', mapping);
    expect(rows.map((r) => [r.id, r.name, r.cars, r.makeCars])).toEqual([
      ['R1', 'Alue yksi', 15_000, 1100],
      ['R2', 'Alue kaksi', 100, 5],
    ]);
  });

  it('has no cars of the make where the make has no cell, and marks small areas unreliable', () => {
    const none = fleetMakeAreaRows(fleet, [], 'all', 'municipality', mapping);
    expect(none.every((r) => r.makeCars === 0 && r.share === 0)).toBe(true);
    expect(none.map((r) => r.reliable)).toEqual([true, true, false, true]);
  });
});

describe('shareRank', () => {
  const rows = fleetMakeAreaRows(
    fleet,
    groupCellsByMake(cells).get('alfa')!,
    'all',
    'municipality',
    mapping,
  );

  it('puts the reliable areas in order of the share', () => {
    expect(shareRank(rows, '001')).toEqual({ rank: 1, of: 3 });
    expect(shareRank(rows, '002')).toEqual({ rank: 2, of: 3 });
    expect(shareRank(rows, '004')).toEqual({ rank: 3, of: 3 });
  });

  it('gives no place to an area that is too small or unknown', () => {
    expect(shareRank(rows, '003')).toBeNull();
    expect(shareRank(rows, 'nowhere')).toBeNull();
  });
});

describe('makeScaleTop', () => {
  const row = (share: number, reliable = true) => ({
    id: 'x',
    name: 'x',
    cars: 1,
    makeCars: 1,
    share,
    reliable,
  });

  it('rounds up to a whole percent from one percent, and to tenths below it', () => {
    expect(makeScaleTop([row(7.2), row(3)])).toBe(8);
    expect(makeScaleTop([row(0.42)])).toBe(0.5);
    expect(makeScaleTop([row(0)])).toBe(0.1);
    expect(makeScaleTop([])).toBe(0.1);
  });

  it('leaves the areas that are not coloured out of the scale', () => {
    expect(makeScaleTop([row(2), row(40, false)])).toBe(2);
  });
});

describe('hasFewCars', () => {
  it('is true for a make under the limit of the make table', () => {
    const make = (cars: number) => ({ id: 'x', name: 'X', cars });
    expect(hasFewCars(make(MIN_MAKE_CARS - 1))).toBe(true);
    expect(hasFewCars(make(MIN_MAKE_CARS))).toBe(false);
  });
});

describe('fleetMakeOptions', () => {
  it('lists the makes by name and leaves out the rows that are not a make', () => {
    const options = fleetMakeOptions(fleet, (a, b) => a.localeCompare(b, 'fi'));
    expect(options.map((o) => o.name)).toEqual(['Alfa', 'Zeta', 'Äkkiä']);
  });

  it('gives each make its cars in the whole country', () => {
    const withCars = {
      ...fleet,
      makes: [{ id: 'alfa', name: 'Alfa', kind: 'make', counts: counts({ petrol: 90, bev: 10 }) }],
    } as unknown as CarFleet;
    expect(fleetMakeOptions(withCars, () => 0)).toEqual([{ id: 'alfa', name: 'Alfa', cars: 100 }]);
  });
});

describe('chosenMake', () => {
  const options = [{ id: 'alfa', name: 'Alfa', cars: 500 }];

  it('is the make of the release, and none for a make it does not have', () => {
    expect(chosenMake(options, 'alfa')).toEqual(options[0]);
    expect(chosenMake(options, 'gone')).toBeNull();
    expect(chosenMake(options, null)).toBeNull();
  });
});

describe('cellsNeeded', () => {
  const make = { id: 'alfa', name: 'Alfa', cars: 500 };

  it('wants the cars of each make for a make or for an area, and not otherwise', () => {
    expect(cellsNeeded(make, null)).toBe(true);
    expect(cellsNeeded(null, '091')).toBe(true);
    expect(cellsNeeded(null, null)).toBe(false);
  });
});

describe('groupCellsByMake', () => {
  it('keeps the cells of each make together', () => {
    const byMake = groupCellsByMake(cells);
    expect(byMake.get('alfa')).toHaveLength(4);
    expect(byMake.get('zeta')).toHaveLength(1);
    expect(byMake.get('nobody')).toBeUndefined();
  });
});

describe('isFuelFilter', () => {
  it('knows all and the fuel groups', () => {
    expect(['all', 'bev', 'petrol'].every(isFuelFilter)).toBe(true);
    expect(isFuelFilter('hydrogen')).toBe(false);
    expect(isFuelFilter(null)).toBe(false);
  });
});

describe('fleetAreaMakeRows', () => {
  const all = [
    ...cells,
    cell('001', 'äkkiä', { petrol: 3000, bev: 1000 }),
    cell('001', 'muut', { petrol: 4000 }),
    cell('002', 'äkkiä', { petrol: 900 }),
  ];

  it('puts the makes with the most cars first and leaves out the rows that are not a make', () => {
    const rows = fleetAreaMakeRows(fleet, all, '001', 'municipality', mapping);
    expect(rows.map((r) => [r.id, r.cars])).toEqual([
      ['äkkiä', 4000],
      ['alfa', 1000],
      ['zeta', 10],
    ]);
  });

  it('gives the share of all the cars of the area, those of other makes included', () => {
    const [first] = fleetAreaMakeRows(fleet, all, '001', 'municipality', mapping);
    // 9010 cars in the area: 4000 + 1000 + 10 of makes and 4000 of the others
    expect(first?.share).toBeCloseTo((4000 / 9010) * 100);
  });

  it('gives the share of the cars of the make that are battery electric', () => {
    const rows = fleetAreaMakeRows(fleet, all, '001', 'municipality', mapping);
    expect(rows.find((r) => r.id === 'äkkiä')?.bevShare).toBeCloseTo(25);
    expect(rows.find((r) => r.id === 'alfa')?.bevShare).toBeCloseTo(50);
    expect(rows.find((r) => r.id === 'zeta')?.bevShare).toBe(0);
  });

  it('adds the municipalities of a region up', () => {
    const rows = fleetAreaMakeRows(fleet, all, 'R1', 'region', mapping);
    expect(rows.find((r) => r.id === 'äkkiä')?.cars).toBe(4900);
    expect(rows.find((r) => r.id === 'alfa')?.cars).toBe(1100);
  });

  it('stops at the limit, and has no makes for an area without cars', () => {
    expect(fleetAreaMakeRows(fleet, all, '001', 'municipality', mapping, 1)).toHaveLength(1);
    expect(fleetAreaMakeRows(fleet, all, 'nowhere', 'municipality', mapping)).toEqual([]);
  });
});
