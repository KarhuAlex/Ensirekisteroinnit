import type { FuelId } from './fuels.js';

/** Calendar month, `YYYY-MM`. */
export type Period = string;

export type EntityKind = 'total' | 'make' | 'group' | 'model';

/** Something registrations can be counted for: all cars, a make, a model group or a model. */
export interface Entity {
  id: string;
  label: string;
  kind: EntityKind;
  makeId?: string;
}

export interface Observation {
  entityId: string;
  period: Period;
  fuel: FuelId;
  count: number;
}

/** Normalised output of a source adapter; everything downstream is independent of the source. */
export interface Dataset {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  licence: string;
  /** Opaque version string; equal values mean the source has not changed. */
  sourceVersion: string;
  sourceUpdated: string;
  entities: Entity[];
  observations: Observation[];
  notes: string[];
}

// Published data contract: public and versioned. Bump SCHEMA_VERSION on breaking changes.

export const SCHEMA_VERSION = 1;

/** Short-cached pointer to the current immutable release. */
export interface LatestPointer {
  schemaVersion: typeof SCHEMA_VERSION;
  release: string;
  sourceVersion: string;
  generatedAt: string;
}

export interface Manifest {
  schemaVersion: typeof SCHEMA_VERSION;
  release: string;
  generatedAt: string;
  source: {
    id: string;
    name: string;
    url: string;
    licence: string;
    updated: string;
  };
  months: Period[];
  latestMonth: Period;
  fuels: FuelId[];
  notes: string[];
}

export interface EntitySummary extends Entity {
  total: number;
  last12: number;
  bevLast12: number;
}

/** Monthly registrations per fuel, aligned with `Manifest.months`. */
export interface EntitySeries {
  id: string;
  label: string;
  kind: EntityKind;
  series: Partial<Record<FuelId, number[]>>;
}
