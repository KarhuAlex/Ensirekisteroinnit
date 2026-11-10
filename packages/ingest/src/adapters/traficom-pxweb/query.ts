import type { FuelId, Observation } from '@regs/core';
import { iterateCells, type JsonStatDoc } from '../pxweb/jsonstat.js';
import { FUEL_CODE_MAP, FUEL_TOTAL_CODE, periodFromCode } from './mapping.js';
import { VAR_FUEL, VAR_MODEL, VAR_MONTH } from './table-schema.js';

export interface CollectOptions {
  /** The variable that identifies the entities in the response; model series by default. */
  entityVariable?: string;
  /** The source's fuel codes mapped to canonical fuels. */
  fuelMap?: Readonly<Record<string, FuelId>>;
}

/**
 * Turns one JSON-stat response into canonical observations, dropping zero and missing cells. It
 * also checks that the per-fuel rows add up to the source's own all-fuels row.
 */
export function collectObservations(
  doc: JsonStatDoc,
  idByCode: ReadonlyMap<string, string>,
  { entityVariable = VAR_MODEL, fuelMap = FUEL_CODE_MAP }: CollectOptions = {},
): { observations: Observation[]; mismatches: number } {
  const observations: Observation[] = [];
  const fuelSums = new Map<string, number>();
  const reportedTotals = new Map<string, number>();

  for (const { coords, value } of iterateCells(doc)) {
    const entityCode = coords[entityVariable];
    const fuelCode = coords[VAR_FUEL];
    const monthCode = coords[VAR_MONTH];
    if (entityCode === undefined || fuelCode === undefined || monthCode === undefined) {
      throw new Error('JSON-stat response is missing an expected dimension');
    }
    const entityId = idByCode.get(entityCode);
    if (!entityId) throw new Error(`Unknown ${entityVariable} code in response: ${entityCode}`);
    const key = `${entityCode}|${monthCode}`;
    const count = value ?? 0;

    if (fuelCode === FUEL_TOTAL_CODE) {
      reportedTotals.set(key, count);
      continue;
    }
    fuelSums.set(key, (fuelSums.get(key) ?? 0) + count);
    const fuel = fuelMap[fuelCode];
    if (!fuel) throw new Error(`Unmapped fuel code in response: ${fuelCode}`);
    if (count !== 0)
      observations.push({ entityId, period: periodFromCode(monthCode), fuel, count });
  }

  let mismatches = 0;
  for (const [key, total] of reportedTotals) {
    if ((fuelSums.get(key) ?? 0) !== total) mismatches++;
  }
  return { observations, mismatches };
}
