import { FUEL_GROUP_IDS, type FuelGroupId, type StockDataset } from '@regs/core';
import type { AdapterResult, SourceAdapter } from '../types.js';
import { requireVariable, tableVersion, type PxApi } from '../pxweb/api.js';
import { PxWebClient, type PxTableMeta } from '../pxweb/client.js';
import { categoryCodes, iterateCells, type JsonStatDoc } from '../pxweb/jsonstat.js';
import { FUEL_TOTAL_CODE, STOCK_FUEL_GROUP_MAP } from './mapping.js';

const VAR_AREA = 'Maakunta';
const VAR_CLASS = 'Ajoneuvoluokka';
const VAR_FUEL = 'Käyttövoima';
const VAR_QUARTER = 'Vuosineljännes';

/** Mainland Finland; the Åland register is not part of the table. */
const AREA_MAINLAND = { code: 'MA1', text: 'MANNER-SUOMI' };
const CLASS_PASSENGER_CARS = { code: '01', text: 'Henkilöautot' };

export interface TraficomStockOptions {
  client?: PxApi;
  baseUrl?: string;
  databasePath?: string;
  tableId?: string;
}

const DEFAULTS = {
  baseUrl: 'https://trafi2.stat.fi/PXWeb/api/v1/fi/TraFi',
  databasePath: 'Liikennekaytossa_olevat_ajoneuvot',
  tableId: '040_kanta_tau_104.px',
} as const;

/**
 * Reads the passenger cars in traffic on the last day of each quarter, by fuel, from the PxWeb
 * database. The table has no make or model, so this is the national stock only.
 */
export class TraficomStockAdapter implements SourceAdapter<StockDataset> {
  readonly id = 'traficom-pxweb-car-stock';

  private readonly client: PxApi;
  private readonly databasePath: string;
  private readonly tableId: string;

  constructor(options: TraficomStockOptions = {}) {
    this.client =
      options.client ?? new PxWebClient({ baseUrl: options.baseUrl ?? DEFAULTS.baseUrl });
    this.databasePath = options.databasePath ?? DEFAULTS.databasePath;
    this.tableId = options.tableId ?? DEFAULTS.tableId;
  }

  getVersion(): Promise<string> {
    return tableVersion(this.client, this.databasePath, this.tableId);
  }

  async fetch(): Promise<AdapterResult<StockDataset>> {
    const sourceVersion = await this.getVersion();
    const path = `${this.databasePath}/${this.tableId}`;
    assertSchema(await this.client.getTableMeta(path));

    const { doc, raw } = await this.client.query(path, {
      query: [
        { code: VAR_AREA, selection: { filter: 'item', values: [AREA_MAINLAND.code] } },
        { code: VAR_CLASS, selection: { filter: 'item', values: [CLASS_PASSENGER_CARS.code] } },
        { code: VAR_FUEL, selection: { filter: 'all', values: ['*'] } },
        { code: VAR_QUARTER, selection: { filter: 'all', values: ['*'] } },
      ],
      response: { format: 'json-stat2' },
    });

    return {
      dataset: {
        sourceId: this.id,
        sourceName: 'Traficom – Liikennekäytössä olevat ajoneuvot',
        sourceUrl: `https://trafi2.stat.fi/PXWeb/pxweb/fi/TraFi/TraFi__${this.databasePath}/${this.tableId}/`,
        licence: 'CC BY 4.0',
        sourceVersion,
        sourceUpdated: sourceVersion,
        ...readStock(doc),
      },
      rawFiles: [{ path: 'car-stock.json', content: raw }],
    };
  }
}

/** The table must still be the one this adapter reads, and every fuel class must be known. */
function assertSchema(meta: PxTableMeta): void {
  expectValue(meta, VAR_AREA, AREA_MAINLAND);
  expectValue(meta, VAR_CLASS, CLASS_PASSENGER_CARS);
  requireVariable(meta.variables, VAR_QUARTER);
  const fuels = requireVariable(meta.variables, VAR_FUEL);
  const unknown = fuels.values.filter((c) => c !== FUEL_TOTAL_CODE && !(c in STOCK_FUEL_GROUP_MAP));
  if (unknown.length > 0) throw new Error(`Unmapped fuel codes in source: ${unknown.join(', ')}`);
}

function expectValue(
  meta: PxTableMeta,
  variable: string,
  expected: { code: string; text: string },
): void {
  const { values, valueTexts } = requireVariable(meta.variables, variable);
  const text = valueTexts[values.indexOf(expected.code)];
  if (text?.toLowerCase() !== expected.text.toLowerCase()) {
    throw new Error(
      `"${variable}" value ${expected.code} is "${text ?? 'missing'}", not "${expected.text}" - source schema changed?`,
    );
  }
}

function readStock(doc: JsonStatDoc): Pick<StockDataset, 'quarters' | 'series' | 'total'> {
  const quarters = categoryCodes(doc, VAR_QUARTER);
  const quarterIndex = new Map(quarters.map((code, i) => [code, i]));
  const zeros = () => quarters.map(() => 0);
  const series = Object.fromEntries(FUEL_GROUP_IDS.map((group) => [group, zeros()])) as Record<
    FuelGroupId,
    number[]
  >;
  const total = zeros();

  for (const { coords, value } of iterateCells(doc)) {
    const fuel = coords[VAR_FUEL] ?? '';
    const index = quarterIndex.get(coords[VAR_QUARTER] ?? '');
    if (index === undefined) throw new Error('Unexpected cell in the car stock table');
    if (fuel === FUEL_TOTAL_CODE) {
      if (value === null) throw new Error(`The source has no total for ${quarters[index]}`);
      total[index] = value;
      continue;
    }
    const group = STOCK_FUEL_GROUP_MAP[fuel];
    if (!group) throw new Error(`Unmapped fuel code in source: ${fuel}`);
    // A class without a figure for a quarter has no cars then.
    const row = series[group];
    row[index] = (row[index] ?? 0) + (value ?? 0);
  }
  return { quarters, series, total };
}
