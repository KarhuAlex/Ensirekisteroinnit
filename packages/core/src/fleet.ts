import type { FuelGroupId } from './fuels.js';
import type { Area } from './regional.js';
import type { SCHEMA_VERSION } from './types.js';

/** Bumped when the fleet release gains or changes files, which forces a rebuild. */
export const FLEET_FORMAT = 1;

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

/** Passenger cars in traffic on one day, by municipality and by make. */
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

export const sumCounts = (counts: GroupCounts): number =>
  Object.values(counts).reduce((a, b) => a + b, 0);

export const emptyGroupCounts = (): GroupCounts => ({
  petrol: 0,
  diesel: 0,
  bev: 0,
  phev: 0,
  other: 0,
});
