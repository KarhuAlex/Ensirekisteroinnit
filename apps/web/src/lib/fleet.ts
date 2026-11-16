import {
  emptyGroupCounts,
  FUEL_GROUP_IDS,
  sumCounts,
  type CarFleet,
  type EntityKind,
  type FleetAge,
  type FleetMake,
  type GroupCounts,
} from '@regs/core';
import { areaGroupOf, type RegionMapping } from './areaGrouping';
import { percent } from './stats';

/** A municipality with fewer cars has a share that moves by a few cars, so it is not coloured. */
export const MIN_MUNICIPALITY_CARS = 2000;
/** A make with fewer cars gets no electric share and no average age. */
export const MIN_MAKE_CARS = 100;

/** Which electric share is shown: battery electric alone, or with the plug-in hybrids. */
export type ElectricShare = 'bev' | 'plug';

export const electricShare = (counts: GroupCounts, kind: ElectricShare): number | null => {
  const electric = kind === 'bev' ? counts.bev : counts.bev + counts.phev;
  return percent(electric, sumCounts(counts));
};

/** The average age in years, from the year each car came into use. */
export const meanAge = (age: FleetAge): number | null =>
  age.cars > 0 ? age.years / age.cars : null;

export interface FleetAreaRow {
  id: string;
  name: string;
  cars: number;
  bevShare: number | null;
  plugShare: number | null;
  /** Enough cars for the shares to mean something. */
  reliable: boolean;
}

function areaRow(id: string, name: string, counts: GroupCounts): FleetAreaRow {
  const cars = sumCounts(counts);
  return {
    id,
    name,
    cars,
    bevShare: electricShare(counts, 'bev'),
    plugShare: electricShare(counts, 'plug'),
    reliable: cars >= MIN_MUNICIPALITY_CARS,
  };
}

/** The municipalities. Cars abroad or without a known place are not an area on the map. */
export function fleetAreaRows(fleet: CarFleet): FleetAreaRow[] {
  return fleet.areas
    .filter((area) => area.kind === 'municipality')
    .map((area) => areaRow(area.id, area.name, area.counts));
}

/** The regions, each the sum of its municipalities. A municipality of no known region is left out. */
export function fleetRegionRows(fleet: CarFleet, mapping: RegionMapping): FleetAreaRow[] {
  const regionOf = areaGroupOf('region', mapping);
  const regions = new Map<string, { name: string; counts: GroupCounts }>();
  for (const area of fleet.areas) {
    if (area.kind !== 'municipality') continue;
    const region = regionOf(area);
    if (region.kind !== 'region') continue;
    const total = regions.get(region.id) ?? { name: region.name, counts: emptyGroupCounts() };
    for (const group of FUEL_GROUP_IDS) total.counts[group] += area.counts[group];
    regions.set(region.id, total);
  }
  return [...regions].map(([id, { name, counts }]) => areaRow(id, name, counts));
}

export interface FleetMakeRow {
  /** Matches the id of the make in the registrations, when it has a page there. */
  id: string;
  name: string;
  cars: number;
  /** The make's part of all cars in traffic, in percent. */
  fleetShare: number | null;
  bevShare: number | null;
  meanAge: number | null;
}

function makeRow(make: FleetMake, all: number): FleetMakeRow {
  const cars = sumCounts(make.counts);
  return {
    id: make.id,
    name: make.name,
    cars,
    fleetShare: percent(cars, all),
    bevShare: cars >= MIN_MAKE_CARS ? electricShare(make.counts, 'bev') : null,
    meanAge: cars >= MIN_MAKE_CARS ? meanAge(make.age) : null,
  };
}

/** The makes. Motorhomes and "other makes" are rows of the source that are not a make. */
export function fleetMakeRows(fleet: CarFleet): FleetMakeRow[] {
  const all = sumCounts(fleet.total.counts);
  return fleet.makes.filter((make) => make.kind === 'make').map((make) => makeRow(make, all));
}

/**
 * What the page of a make or model shows of the fleet. Only a make has cars in traffic of its own;
 * a model is pointed to its make, and anything else, such as a group of models, shows nothing. A
 * make the release does not have shows nothing either.
 */
export type ModelFleetView =
  { kind: 'make'; row: FleetMakeRow } | { kind: 'note'; row: FleetMakeRow } | null;

export function modelFleetView(
  fleet: CarFleet,
  entity: { id: string; kind: EntityKind; makeId?: string },
): ModelFleetView {
  if (entity.kind === 'make') {
    const row = fleetMakeRow(fleet, entity.id);
    return row ? { kind: 'make', row } : null;
  }
  if (entity.kind === 'model' && entity.makeId) {
    const row = fleetMakeRow(fleet, entity.makeId);
    return row ? { kind: 'note', row } : null;
  }
  return null;
}

/** One make of the fleet, or `null` where the release does not have it. */
export function fleetMakeRow(fleet: CarFleet, id: string): FleetMakeRow | null {
  const make = fleet.makes.find((m) => m.kind === 'make' && m.id === id);
  return make ? makeRow(make, sumCounts(fleet.total.counts)) : null;
}

/** The cars of the rows that are not a make, which the make table leaves out. */
export function otherRows(fleet: CarFleet): { motorhomes: number; others: number } {
  const cars = (kind: 'motorhomes' | 'others') =>
    fleet.makes.filter((m) => m.kind === kind).reduce((a, m) => a + sumCounts(m.counts), 0);
  return { motorhomes: cars('motorhomes'), others: cars('others') };
}

export interface FleetSummary {
  cars: number;
  bevShare: number | null;
  plugShare: number | null;
  meanAge: number | null;
}

export function fleetSummary(fleet: CarFleet): FleetSummary {
  return {
    cars: sumCounts(fleet.total.counts),
    bevShare: electricShare(fleet.total.counts, 'bev'),
    plugShare: electricShare(fleet.total.counts, 'plug'),
    meanAge: meanAge(fleet.total.age),
  };
}

/** The top of the map's colour scale: the highest share among the coloured municipalities, rounded up. */
export function mapScaleTop(rows: readonly FleetAreaRow[], kind: ElectricShare): number {
  const shares = rows
    .filter((row) => row.reliable)
    .map((row) => (kind === 'bev' ? row.bevShare : row.plugShare) ?? 0);
  return Math.max(1, Math.ceil(Math.max(0, ...shares)));
}
