import { FUEL_GROUP_IDS, type FuelGroupId } from './fuels.js';
import type { Area } from './regional.js';
import type { SCHEMA_VERSION } from './types.js';

/** Bumped when the fleet release gains or changes files, which forces a rebuild. */
export const FLEET_FORMAT = 2;

/** Cars per fuel group. */
export type GroupCounts = Record<FuelGroupId, number>;

/** The ages of a set of cars: how many there are and the sum of their ages in years. */
export interface FleetAge {
  cars: number;
  years: number;
}

/** A municipality, or the cars that are abroad or have no known place. */
export interface FleetArea extends Area {
  counts: GroupCounts;
}

/** The source lists makes, and two rows that are not a make: other makes and motorhomes. */
export type FleetMakeKind = 'make' | 'others' | 'motorhomes';

export interface FleetMake {
  /** The make's name as an id, the same one the registrations use for the same make. */
  id: string;
  name: string;
  kind: FleetMakeKind;
  counts: GroupCounts;
  age: FleetAge;
}

/** The cars of one make in one municipality; a pair that has no cars has no cell. */
export interface FleetCell {
  /** The municipality's id, as in `FleetArea`. */
  area: string;
  /** The make's id, as in `FleetMake`. */
  make: string;
  counts: GroupCounts;
}

/** Passenger cars in traffic on one day, by municipality and by make, and by both together. */
export interface FleetDataset {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  licence: string;
  /** Opaque version string; equal values mean the source has not changed. */
  sourceVersion: string;
  sourceUpdated: string;
  /** The day the cars were counted, `YYYY-MM-DD`. */
  date: string;
  total: { counts: GroupCounts; age: FleetAge };
  areas: FleetArea[];
  makes: FleetMake[];
  cells: FleetCell[];
}

/** The published `fleet.json`: public and versioned like the rest of the data contract. */
export interface CarFleet {
  schemaVersion: typeof SCHEMA_VERSION;
  release: string;
  generatedAt: string;
  source: { id: string; name: string; url: string; licence: string; updated: string };
  date: string;
  total: FleetDataset['total'];
  areas: FleetArea[];
  makes: FleetMake[];
}

/**
 * The published `fleet-cells.json`: the cells in parallel arrays, which keep the file small. Cell
 * `i` is the make `makes[make[i]]` in the municipality `areas[area[i]]`, with `counts[group][i]` cars
 * of each fuel group.
 */
export interface CarFleetCells {
  schemaVersion: typeof SCHEMA_VERSION;
  release: string;
  /** The day the cars were counted; the same as in `fleet.json` of the release. */
  date: string;
  areas: string[];
  makes: string[];
  area: number[];
  make: number[];
  counts: Record<FuelGroupId, number[]>;
}

const sorted = (ids: Iterable<string>): string[] => [...new Set(ids)].sort();

/** The cells as the file that is published, in an order that does not depend on the source's. */
export function encodeCells(
  cells: readonly FleetCell[],
  head: Pick<CarFleetCells, 'schemaVersion' | 'release' | 'date'>,
): CarFleetCells {
  const areas = sorted(cells.map((c) => c.area));
  const makes = sorted(cells.map((c) => c.make));
  const areaIndex = new Map(areas.map((id, i) => [id, i]));
  const makeIndex = new Map(makes.map((id, i) => [id, i]));
  const ordered = [...cells].sort(
    (a, b) =>
      areaIndex.get(a.area)! - areaIndex.get(b.area)! ||
      makeIndex.get(a.make)! - makeIndex.get(b.make)!,
  );
  return {
    ...head,
    areas,
    makes,
    area: ordered.map((c) => areaIndex.get(c.area)!),
    make: ordered.map((c) => makeIndex.get(c.make)!),
    counts: Object.fromEntries(
      FUEL_GROUP_IDS.map((group) => [group, ordered.map((c) => c.counts[group])]),
    ) as CarFleetCells['counts'],
  };
}

/** The cells of a published file. */
export function decodeCells(file: CarFleetCells): FleetCell[] {
  return file.area.map((areaIndex, i) => {
    const counts = emptyGroupCounts();
    for (const group of FUEL_GROUP_IDS) counts[group] = file.counts[group][i] ?? 0;
    return { area: file.areas[areaIndex]!, make: file.makes[file.make[i]!]!, counts };
  });
}

export const sumCounts = (counts: GroupCounts): number =>
  Object.values(counts).reduce((a, b) => a + b, 0);

export const emptyGroupCounts = (): GroupCounts => ({
  petrol: 0,
  diesel: 0,
  bev: 0,
  phev: 0,
  other: 0,
});
