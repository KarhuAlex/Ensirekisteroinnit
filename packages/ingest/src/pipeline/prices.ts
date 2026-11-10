import {
  PRICE_FUEL_IDS,
  PRICES_FORMAT,
  SCHEMA_VERSION,
  type FuelPriceDataset,
  type FuelPrices,
} from '@regs/core';
import type { SourceAdapter } from '../adapters/types.js';
import type { Pipeline, PublishableRelease } from './pipeline.js';
import { monthRange, releaseIdFor } from './release.js';

const MIN_MONTHS = 120;
/** Euros per litre; a value outside this range is a unit or column mistake, not a price. */
const MIN_PRICE = 0.3;
const MAX_PRICE = 4;
const MAX_MISSING_SHARE = 0.05;

function monthProblems(months: readonly string[], minMonths: number): string[] {
  const problems: string[] = [];
  if (months.length < minMonths) {
    problems.push(`only ${months.length} months (expected at least ${minMonths})`);
  }
  const first = months[0];
  const last = months[months.length - 1];
  if (first && last && monthRange(first, last).join() !== months.join()) {
    problems.push('months are not consecutive');
  }
  return problems;
}

function seriesProblems(fuel: string, values: readonly (number | null)[], count: number): string[] {
  if (values.length !== count) return [`${fuel} has ${values.length} values for ${count} months`];
  const problems: string[] = [];
  const missing = values.filter((v) => v === null).length;
  if (missing > count * MAX_MISSING_SHARE) problems.push(`${fuel} lacks ${missing} months`);
  if (values.at(-1) === null) problems.push(`${fuel} has no price for the latest month`);
  if (values.some((v) => v !== null && (v < MIN_PRICE || v > MAX_PRICE))) {
    problems.push(`${fuel} has a price outside ${MIN_PRICE}-${MAX_PRICE} EUR/l`);
  }
  return problems;
}

/** A failed check aborts the run, so the previous release keeps being served. */
export function validatePrices(dataset: FuelPriceDataset, minMonths = MIN_MONTHS): void {
  const { months, series } = dataset;
  const problems = [
    ...monthProblems(months, minMonths),
    ...PRICE_FUEL_IDS.flatMap((fuel) => seriesProblems(fuel, series[fuel], months.length)),
  ];
  if (problems.length > 0) throw new Error(`Fuel prices failed validation: ${problems.join('; ')}`);
}

export function buildPricesRelease(dataset: FuelPriceDataset, now: Date): PublishableRelease {
  const id = releaseIdFor(now);
  const generatedAt = now.toISOString();
  const prices: FuelPrices = {
    schemaVersion: SCHEMA_VERSION,
    release: id,
    generatedAt,
    unit: 'EUR/l',
    source: {
      id: dataset.sourceId,
      name: dataset.sourceName,
      url: dataset.sourceUrl,
      licence: dataset.licence,
      updated: dataset.sourceUpdated,
    },
    months: dataset.months,
    series: dataset.series,
  };
  return { id, generatedAt, files: [{ path: 'prices.json', body: JSON.stringify(prices) }] };
}

export function pricesPipeline(
  adapter: SourceAdapter<FuelPriceDataset>,
  minMonths = MIN_MONTHS,
): Pipeline<FuelPriceDataset> {
  return {
    name: 'fuel prices',
    format: PRICES_FORMAT,
    adapter,
    validate: (dataset) => validatePrices(dataset, minMonths),
    build: buildPricesRelease,
    sourceVersionOf: (dataset) => dataset.sourceVersion,
  };
}
