import type { FuelGroupId } from './fuels.js';
import type { Entity, Observation, Period, SCHEMA_VERSION } from './types.js';

/** Bumped when the regional release gains or changes files. */
export const REGIONAL_FORMAT = 1;

export type AreaKind = 'municipality' | 'abroad' | 'unknown';

export interface Area {
  /** Statistics Finland municipality number such as `049`, or `abroad` and `unknown`. */
  id: string;
  name: string;
  kind: AreaKind;
}

/** One area's registrations, kept apart so no per-observation area id has to be stored. */
export interface AreaObservations {
  areaId: string;
  observations: Observation[];
}

/** Normalised output of a regional source adapter. */
export interface RegionalDataset {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  licence: string;
  sourceVersion: string;
  sourceUpdated: string;
  entities: Entity[];
  areas: Area[];
  areaObservations: AreaObservations[];
  /** The source's own national totals per month, used to check that the areas add up. */
  nationalTotals: Record<Period, number>;
}

/** Describes a regional release: what the numeric indexes in the yearly files refer to. */
export interface RegionalIndex {
  schemaVersion: typeof SCHEMA_VERSION;
  release: string;
  generatedAt: string;
  source: { name: string; url: string; licence: string; updated: string };
  months: Period[];
  years: string[];
  entities: string[];
  areas: Area[];
  groups: FuelGroupId[];
}

/**
 * Registrations of one calendar year as parallel arrays, one entry per non-zero cell: entity,
 * area and fuel group index (into `RegionalIndex`), month index into `RegionalIndex.months`, and
 * the count. Zero cells are left out, since most combinations never occur.
 */
export interface RegionalYear {
  schemaVersion: typeof SCHEMA_VERSION;
  year: string;
  cells: { e: number[]; a: number[]; g: number[]; m: number[]; n: number[] };
}
