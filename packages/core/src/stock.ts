import type { FuelGroupId } from './fuels.js';
import type { Period } from './types.js';

/** Bumped when the car stock release gains or changes files, which forces a rebuild. */
export const STOCK_FORMAT = 1;

/** A calendar quarter, `YYYYQn`. The stock is counted on its last day. */
export type Quarter = string;

/** Passenger cars in traffic by fuel group, on the last day of each quarter. */
export interface StockDataset {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  licence: string;
  /** Opaque version string; equal values mean the source has not changed. */
  sourceVersion: string;
  sourceUpdated: string;
  quarters: Quarter[];
  /** Cars per fuel group, aligned with `quarters`. */
  series: Record<FuelGroupId, number[]>;
  /** The source's own count of all cars, aligned with `quarters`. */
  total: number[];
}

/** The published `stock.json`: public and versioned like the rest of the data contract. */
export interface CarStock {
  schemaVersion: 1;
  release: string;
  generatedAt: string;
  source: { id: string; name: string; url: string; licence: string; updated: string };
  quarters: Quarter[];
  series: Record<FuelGroupId, number[]>;
  total: number[];
}

const QUARTER = /^(\d{4})Q([1-4])$/;

function parseQuarter(quarter: Quarter): { year: number; number: number } {
  const match = QUARTER.exec(quarter);
  if (!match) throw new Error(`Unexpected quarter: ${quarter}`);
  return { year: Number(match[1]), number: Number(match[2]) };
}

/** The month a quarter ends in: `2026Q3` is `2026-09`. */
export function quarterEndPeriod(quarter: Quarter): Period {
  const { year, number } = parseQuarter(quarter);
  return `${year}-${String(number * 3).padStart(2, '0')}`;
}

export function nextQuarter(quarter: Quarter): Quarter {
  const { year, number } = parseQuarter(quarter);
  return number === 4 ? `${year + 1}Q1` : `${year}Q${number + 1}`;
}

/** The last day of a month, as `YYYY-MM-DD`. */
export function monthEndDate(period: Period): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) throw new Error(`Unexpected month: ${period}`);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
