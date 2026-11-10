import type { Period } from './types.js';

/** Bumped when the fuel price release gains or changes files, which forces a rebuild. */
export const PRICES_FORMAT = 1;

/** The pump fuels the price series cover. */
export const PRICE_FUEL_IDS = ['petrol', 'diesel'] as const;
export type PriceFuelId = (typeof PRICE_FUEL_IDS)[number];

/** Average pump prices by month, in euros per litre. `null` marks a month without a price. */
export interface FuelPriceDataset {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  licence: string;
  /** Opaque version string; equal values mean the source has not changed. */
  sourceVersion: string;
  sourceUpdated: string;
  months: Period[];
  series: Record<PriceFuelId, (number | null)[]>;
}

/** The published `prices.json`: public and versioned like the rest of the data contract. */
export interface FuelPrices {
  schemaVersion: 1;
  release: string;
  generatedAt: string;
  unit: 'EUR/l';
  source: { id: string; name: string; url: string; licence: string; updated: string };
  months: Period[];
  series: Record<PriceFuelId, (number | null)[]>;
}
