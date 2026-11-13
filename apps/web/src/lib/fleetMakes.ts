import {
  emptyGroupCounts,
  FUEL_GROUP_IDS,
  sumCounts,
  type CarFleet,
  type FleetCell,
  type FuelGroupId,
  type GroupCounts,
} from '@regs/core';
import { electricShare, fleetAreaRows, fleetRegionRows, MIN_MAKE_CARS } from './fleet';
import type { RegionMapping } from './areaGrouping';
import type { AreaLevel } from './reviewState';
import { percent } from './stats';

/** Which cars of a make are counted: all of them, or those of one fuel group. */
export type FuelFilter = 'all' | FuelGroupId;

export const isFuelFilter = (value: string | null): value is FuelFilter =>
  value === 'all' || FUEL_GROUP_IDS.some((group) => group === value);

export interface MakeOption {
  id: string;
  name: string;
  /** All the cars of the make in the country. */
  cars: number;
}

/** A make with so few cars that its share in an area moves by a car or two. */
export const hasFewCars = (make: MakeOption): boolean => make.cars < MIN_MAKE_CARS;

/** The makes to choose from, by name. The rows that are not a make are left out. */
export function fleetMakeOptions(fleet: CarFleet, compare: (a: string, b: string) => number) {
  return fleet.makes
    .filter((make) => make.kind === 'make')
    .map((make): MakeOption => ({ id: make.id, name: make.name, cars: sumCounts(make.counts) }))
    .sort((a, b) => compare(a.name, b.name));
}

/** The chosen make, if the release has it; one from an old link is as if none was chosen. */
export const chosenMake = (options: readonly MakeOption[], id: string | null): MakeOption | null =>
  options.find((option) => option.id === id) ?? null;

/** The cars of each make are needed for a make, or to list the makes of a chosen area. */
export const cellsNeeded = (make: MakeOption | null, area: string | null): boolean =>
  make !== null || area !== null;

/** The cells of each make, so that a make's cells are found without going through all of them. */
export function groupCellsByMake(cells: readonly FleetCell[]): Map<string, FleetCell[]> {
  const byMake = new Map<string, FleetCell[]>();
  for (const cell of cells) {
    const list = byMake.get(cell.make);
    if (list) list.push(cell);
    else byMake.set(cell.make, [cell]);
  }
  return byMake;
}

/** One area and how many of its cars are of the chosen make. */
export interface FleetMakeAreaRow {
  id: string;
  name: string;
  /** All the passenger cars of the area, whatever the make. */
  cars: number;
  /** The cars of the make, of the chosen fuel. */
  makeCars: number;
  /** The make's share of the cars of the area, in percent. */
  share: number | null;
  /** Enough cars in the area for the share to mean something. */
  reliable: boolean;
}

const carsOf = (counts: GroupCounts, fuel: FuelFilter): number =>
  fuel === 'all' ? sumCounts(counts) : counts[fuel];

/** The area, at the chosen level, that a municipality is part of; none where it has no region. */
const areaIdOf =
  (level: AreaLevel, mapping: RegionMapping) =>
  (municipality: string): string | undefined =>
    level === 'region' ? mapping.regionOfMunicipality.get(municipality) : municipality;

/**
 * The areas with the cars of one make. A municipality joins its region when the level is regions.
 * The share is of all the cars of the area, so a make is compared with the same whole everywhere.
 */
export function fleetMakeAreaRows(
  fleet: CarFleet,
  makeCells: readonly FleetCell[],
  fuel: FuelFilter,
  level: AreaLevel,
  mapping: RegionMapping,
): FleetMakeAreaRow[] {
  const areas = level === 'region' ? fleetRegionRows(fleet, mapping) : fleetAreaRows(fleet);
  const areaOf = areaIdOf(level, mapping);
  const carsByArea = new Map<string, number>();
  for (const cell of makeCells) {
    const area = areaOf(cell.area);
    if (area !== undefined) {
      carsByArea.set(area, (carsByArea.get(area) ?? 0) + carsOf(cell.counts, fuel));
    }
  }
  return areas.map((area) => {
    const makeCars = carsByArea.get(area.id) ?? 0;
    return {
      id: area.id,
      name: area.name,
      cars: area.cars,
      makeCars,
      share: percent(makeCars, area.cars),
      reliable: area.reliable,
    };
  });
}

/** The place of an area when the reliable areas are put in order of the share, the highest first. */
export function shareRank(
  rows: readonly FleetMakeAreaRow[],
  id: string,
): { rank: number; of: number } | null {
  const ranked = rows
    .filter((row) => row.reliable && row.share !== null)
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || b.makeCars - a.makeCars);
  const index = ranked.findIndex((row) => row.id === id);
  return index < 0 ? null : { rank: index + 1, of: ranked.length };
}

/**
 * The top of the map's colour scale: the highest share among the coloured areas, rounded up. A
 * make that is in few cars gets a scale of tenths of a percent, so that its areas can be told apart.
 */
export function makeScaleTop(rows: readonly FleetMakeAreaRow[]): number {
  const top = Math.max(0, ...rows.filter((row) => row.reliable).map((row) => row.share ?? 0));
  return top >= 1 ? Math.ceil(top) : Math.max(0.1, Math.ceil(top * 10) / 10);
}

/** How many makes the list of an area names. */
const TOP_MAKES = 5;

/** One make among the cars of an area. */
export interface FleetAreaMakeRow {
  id: string;
  name: string;
  cars: number;
  /** The make's share of all the cars of the area, in percent. */
  share: number | null;
  /** The share of the make's cars in the area that are battery electric, in percent. */
  bevShare: number | null;
}

/**
 * The makes with the most cars in one area, the most first. A region has the cars of its
 * municipalities. The rows that are not a make are left out of the list, but their cars are part
 * of the whole that the shares are of.
 */
export function fleetAreaMakeRows(
  fleet: CarFleet,
  cells: readonly FleetCell[],
  areaId: string,
  level: AreaLevel,
  mapping: RegionMapping,
  limit = TOP_MAKES,
): FleetAreaMakeRow[] {
  const areaOf = areaIdOf(level, mapping);
  const kinds = new Map(fleet.makes.map((make) => [make.id, make]));
  const byMake = new Map<string, GroupCounts>();
  let all = 0;
  for (const cell of cells) {
    if (areaOf(cell.area) !== areaId) continue;
    all += sumCounts(cell.counts);
    const total = byMake.get(cell.make) ?? emptyGroupCounts();
    for (const group of FUEL_GROUP_IDS) total[group] += cell.counts[group];
    byMake.set(cell.make, total);
  }
  return [...byMake]
    .flatMap(([id, counts]) => {
      const make = kinds.get(id);
      if (make?.kind !== 'make') return [];
      const cars = sumCounts(counts);
      return [
        {
          id,
          name: make.name,
          cars,
          share: percent(cars, all),
          bevShare: electricShare(counts, 'bev'),
        },
      ];
    })
    .sort((a, b) => b.cars - a.cars || a.name.localeCompare(b.name))
    .slice(0, limit);
}
