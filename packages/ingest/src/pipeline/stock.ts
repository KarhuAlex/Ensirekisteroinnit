import {
  FUEL_GROUP_IDS,
  nextQuarter,
  SCHEMA_VERSION,
  STOCK_FORMAT,
  type CarStock,
  type StockDataset,
} from '@regs/core';
import type { SourceAdapter } from '../adapters/types.js';
import type { Pipeline, PublishableRelease } from './pipeline.js';
import { releaseIdFor } from './release.js';

/** The table starts in 2008; far fewer quarters means a cut-off response. */
const MIN_QUARTERS = 60;
/** Order of magnitude of the passenger car stock; a value outside is a unit or column mistake. */
export const STOCK_TOTAL_RANGE = { min: 1_000_000, max: 6_000_000 } as const;

function spanProblems(quarters: readonly string[], minQuarters: number): string[] {
  const problems: string[] = [];
  if (quarters.length < minQuarters) {
    problems.push(`only ${quarters.length} quarters (expected at least ${minQuarters})`);
  }
  const consecutive = quarters.every(
    (quarter, i) => i === 0 || quarter === nextQuarter(quarters[i - 1] ?? ''),
  );
  if (!consecutive) problems.push('quarters are not consecutive');
  return problems;
}

function hasEqualLengths(dataset: StockDataset): boolean {
  const { quarters, series, total } = dataset;
  const lengths = [...FUEL_GROUP_IDS.map((group) => series[group].length), total.length];
  return lengths.every((length) => length === quarters.length);
}

/** One quarter: whole counts, groups that add up to the source total, and a plausible total. */
function quarterCountProblems(quarter: string, counts: readonly number[], total: number): string[] {
  const problems: string[] = [];
  const sum = counts.reduce((a, b) => a + b, 0);
  if (counts.some((count) => !Number.isInteger(count) || count < 0)) {
    problems.push(`${quarter} has a count that is not a whole number of cars`);
  }
  if (sum !== total) {
    problems.push(`${quarter}: the fuel groups add up to ${sum}, the total is ${total}`);
  }
  if (total < STOCK_TOTAL_RANGE.min || total > STOCK_TOTAL_RANGE.max) {
    problems.push(`${quarter}: total ${total} is implausible`);
  }
  return problems;
}

function countProblems(dataset: StockDataset): string[] {
  const { quarters, series, total } = dataset;
  if (!hasEqualLengths(dataset)) return [`the series are not all ${quarters.length} quarters long`];
  return quarters.flatMap((quarter, i) =>
    quarterCountProblems(
      quarter,
      FUEL_GROUP_IDS.map((group) => series[group][i] ?? 0),
      total[i] ?? 0,
    ),
  );
}

/** A failed check aborts the run, so the previous release keeps being served. */
export function validateStock(dataset: StockDataset, minQuarters = MIN_QUARTERS): void {
  const problems = [...spanProblems(dataset.quarters, minQuarters), ...countProblems(dataset)];
  if (problems.length > 0) throw new Error(`Car stock failed validation: ${problems.join('; ')}`);
}

export function buildStockRelease(dataset: StockDataset, now: Date): PublishableRelease {
  const id = releaseIdFor(now);
  const generatedAt = now.toISOString();
  const stock: CarStock = {
    schemaVersion: SCHEMA_VERSION,
    release: id,
    generatedAt,
    source: {
      id: dataset.sourceId,
      name: dataset.sourceName,
      url: dataset.sourceUrl,
      licence: dataset.licence,
      updated: dataset.sourceUpdated,
    },
    quarters: dataset.quarters,
    series: dataset.series,
    total: dataset.total,
  };
  return { id, generatedAt, files: [{ path: 'stock.json', body: JSON.stringify(stock) }] };
}

export function stockPipeline(
  adapter: SourceAdapter<StockDataset>,
  minQuarters = MIN_QUARTERS,
): Pipeline<StockDataset> {
  return {
    name: 'car stock',
    format: STOCK_FORMAT,
    adapter,
    validate: (dataset) => validateStock(dataset, minQuarters),
    build: buildStockRelease,
    sourceVersionOf: (dataset) => dataset.sourceVersion,
  };
}
