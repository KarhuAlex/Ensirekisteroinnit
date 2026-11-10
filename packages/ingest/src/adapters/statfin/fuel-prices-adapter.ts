import type { FuelPriceDataset, PriceFuelId } from '@regs/core';
import type { AdapterResult, SourceAdapter } from '../types.js';
import { PxWebClient, type PxTableMeta } from '../pxweb/client.js';
import { categoryCodes, iterateCells, type JsonStatDoc } from '../pxweb/jsonstat.js';
import { periodFromCode } from '../traficom-pxweb/mapping.js';
import { requireVariable, tableVersion, type PxApi } from '../pxweb/api.js';

const VAR_MONTH = 'timeperiod_m';
const VAR_FUEL = 'coicop_13_20160512';
const VAR_CONTENT = 'contentscode';
/** The one content value read: the average price. Another value must never be mixed in. */
const CONTENT_AVERAGE_PRICE = 'khi-keskihinta';

/** Statistics Finland's product codes for the pump fuels, mapped to the canonical ones. */
const FUEL_CODE_MAP: Readonly<Record<string, PriceFuelId>> = {
  '0700200': 'petrol', // petrol 95 E10
  '0700100': 'diesel',
};

export interface StatFinFuelPriceOptions {
  client?: PxApi;
  baseUrl?: string;
  databasePath?: string;
  tableId?: string;
}

const DEFAULTS = {
  baseUrl: 'https://pxdata.stat.fi/PXWeb/api/v1/fi/StatFin',
  databasePath: 'khi',
  tableId: '11xx.px',
} as const;

/** Reads the monthly average pump prices of petrol and diesel from Statistics Finland. */
export class StatFinFuelPriceAdapter implements SourceAdapter<FuelPriceDataset> {
  readonly id = 'statfin-fuel-prices';

  private readonly client: PxApi;
  private readonly databasePath: string;
  private readonly tableId: string;

  constructor(options: StatFinFuelPriceOptions = {}) {
    this.client =
      options.client ?? new PxWebClient({ baseUrl: options.baseUrl ?? DEFAULTS.baseUrl });
    this.databasePath = options.databasePath ?? DEFAULTS.databasePath;
    this.tableId = options.tableId ?? DEFAULTS.tableId;
  }

  getVersion(): Promise<string> {
    return tableVersion(this.client, this.databasePath, this.tableId);
  }

  async fetch(): Promise<AdapterResult<FuelPriceDataset>> {
    const sourceVersion = await this.getVersion();
    const path = `${this.databasePath}/${this.tableId}`;
    assertSchema(await this.client.getTableMeta(path));

    const { doc, raw } = await this.client.query(path, {
      query: [
        { code: VAR_FUEL, selection: { filter: 'item', values: Object.keys(FUEL_CODE_MAP) } },
        { code: VAR_MONTH, selection: { filter: 'all', values: ['*'] } },
        { code: VAR_CONTENT, selection: { filter: 'item', values: [CONTENT_AVERAGE_PRICE] } },
      ],
      response: { format: 'json-stat2' },
    });
    const { months, series } = readSeries(doc);

    return {
      dataset: {
        sourceId: this.id,
        sourceName: 'Tilastokeskus – Polttonesteiden keskihintoja',
        sourceUrl: `https://pxdata.stat.fi/PXWeb/pxweb/fi/StatFin/StatFin__${this.databasePath}/${this.tableId}/`,
        licence: 'CC BY 4.0',
        sourceVersion,
        sourceUpdated: sourceVersion,
        months,
        series,
      },
      rawFiles: [{ path: 'fuel-prices.json', content: raw }],
    };
  }
}

/** The table must still have the variables and the content this adapter reads. */
function assertSchema(meta: PxTableMeta): void {
  requireVariable(meta.variables, VAR_MONTH);
  requireVariable(meta.variables, VAR_FUEL);
  const content = requireVariable(meta.variables, VAR_CONTENT);
  if (!content.values.includes(CONTENT_AVERAGE_PRICE)) {
    throw new Error(`Table has no "${CONTENT_AVERAGE_PRICE}" content - source schema changed?`);
  }
}

function readSeries(doc: JsonStatDoc): Pick<FuelPriceDataset, 'months' | 'series'> {
  const monthCodes = categoryCodes(doc, VAR_MONTH);
  const monthIndex = new Map(monthCodes.map((code, i) => [code, i]));
  const series: FuelPriceDataset['series'] = {
    petrol: monthCodes.map(() => null),
    diesel: monthCodes.map(() => null),
  };
  for (const { coords, value } of iterateCells(doc)) {
    const fuel = FUEL_CODE_MAP[coords[VAR_FUEL] ?? ''];
    const index = monthIndex.get(coords[VAR_MONTH] ?? '');
    if (!fuel || index === undefined || coords[VAR_CONTENT] !== CONTENT_AVERAGE_PRICE) {
      throw new Error('Unexpected cell in the fuel price table');
    }
    series[fuel][index] = value;
  }
  return { months: monthCodes.map(periodFromCode), series };
}
