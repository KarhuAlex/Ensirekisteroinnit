import type { Observation } from '@regs/core';
import type { PxWebClient } from './client.js';
import { iterateCells, type JsonStatDoc } from './jsonstat.js';
import { FUEL_CODE_MAP, FUEL_TOTAL_CODE, periodFromCode } from './mapping.js';
import { VAR_FUEL, VAR_MODEL, VAR_MONTH } from './table-schema.js';

/** The part of the PxWeb client the adapters use, so tests can pass a fake. */
export type PxApi = Pick<PxWebClient, 'listFolder' | 'getTableMeta' | 'query'>;

/**
 * Splits items into requests within a cell budget. The API caps cells, not items, so the batch
 * size shrinks as the table gains months or fuel classes.
 */
export function planChunks<T>(
  items: readonly T[],
  cellsPerItem: number,
  maxCells: number,
  fixedSize?: number,
): T[][] {
  const size = fixedSize ?? Math.max(1, Math.floor(maxCells / Math.max(1, cellsPerItem)));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Turns one JSON-stat response into canonical observations, dropping zero and missing cells. It
 * also checks that the per-fuel rows add up to the source's own all-fuels row.
 */
export function collectObservations(
  doc: JsonStatDoc,
  idByCode: ReadonlyMap<string, string>,
): { observations: Observation[]; mismatches: number } {
  const observations: Observation[] = [];
  const fuelSums = new Map<string, number>();
  const reportedTotals = new Map<string, number>();

  for (const { coords, value } of iterateCells(doc)) {
    const modelCode = coords[VAR_MODEL];
    const fuelCode = coords[VAR_FUEL];
    const monthCode = coords[VAR_MONTH];
    if (modelCode === undefined || fuelCode === undefined || monthCode === undefined) {
      throw new Error('JSON-stat response is missing an expected dimension');
    }
    const entityId = idByCode.get(modelCode);
    if (!entityId) throw new Error(`Unknown model series code in response: ${modelCode}`);
    const key = `${modelCode}|${monthCode}`;
    const count = value ?? 0;

    if (fuelCode === FUEL_TOTAL_CODE) {
      reportedTotals.set(key, count);
      continue;
    }
    fuelSums.set(key, (fuelSums.get(key) ?? 0) + count);
    const fuel = FUEL_CODE_MAP[fuelCode];
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
