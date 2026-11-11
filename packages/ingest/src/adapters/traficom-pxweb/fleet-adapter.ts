import {
  emptyGroupCounts,
  sumCounts,
  type FleetAge,
  type FleetArea,
  type FleetDataset,
  type FleetMake,
  type FleetMakeKind,
  type GroupCounts,
} from '@regs/core';
import type { AdapterResult, RawFile, SourceAdapter } from '../types.js';
import { requireVariable, type PxApi } from '../pxweb/api.js';
import { PxWebClient, type PxQuery, type PxTableMeta, type PxVariable } from '../pxweb/client.js';
import { iterateCells, type JsonStatDoc } from '../pxweb/jsonstat.js';
import {
  assertKnownStockFuels,
  FUEL_TOTAL_CODE,
  slugify,
  STOCK_FUEL_GROUP_MAP,
} from './mapping.js';

const VAR_AREA = 'Alue';
const VAR_MAKE = 'Merkki';
const VAR_YEAR = 'Käyttöönottovuosi';
const VAR_FUEL = 'Käyttövoima';

const ALL = 'YH';
const AREA_MAINLAND = 'MA1';
const AREA_ABROAD = '200';
const AREA_UNKNOWN = 'X';
const MUNICIPALITY_PREFIX = 'KU';
const MAKE_OTHERS = 'MUUT';
const MAKE_MOTORHOMES = 'MATK';
/** The oldest cars are one row, "1959 and earlier"; they are given the age of 1959. */
const YEAR_OLDEST = { code: '9999', year: 1959 };

export interface TraficomFleetOptions {
  client?: PxApi;
  baseUrl?: string;
  databasePath?: string;
  tableId?: string;
}

const DEFAULTS = {
  baseUrl: 'https://trafi2.stat.fi/PXWeb/api/v1/fi/TraFi',
  databasePath: 'Liikennekaytossa_olevat_ajoneuvot',
  tableId: '010_kanta_tau_101.px',
} as const;

const item = (code: string, values: string[]) => ({
  code,
  selection: { filter: 'item' as const, values },
});
const every = (code: string) => ({ code, selection: { filter: 'all' as const, values: ['*'] } });

/** The three questions put to the table: cars by area, cars by make, and the years of the makes. */
const QUESTIONS = {
  areas: [every(VAR_AREA), item(VAR_MAKE, [ALL]), item(VAR_YEAR, [ALL]), every(VAR_FUEL)],
  makes: [item(VAR_AREA, [AREA_MAINLAND]), every(VAR_MAKE), item(VAR_YEAR, [ALL]), every(VAR_FUEL)],
  ages: [item(VAR_AREA, [AREA_MAINLAND]), every(VAR_MAKE), every(VAR_YEAR), item(VAR_FUEL, [ALL])],
} satisfies Record<string, PxQuery['query']>;

interface Variables {
  area: PxVariable;
  make: PxVariable;
  fuel: PxVariable;
}

/** The table must still have the variables read here, and every fuel class must be known. */
function readVariables(meta: PxTableMeta): Variables {
  requireVariable(meta.variables, VAR_YEAR);
  const variables = {
    area: requireVariable(meta.variables, VAR_AREA),
    make: requireVariable(meta.variables, VAR_MAKE),
    fuel: requireVariable(meta.variables, VAR_FUEL),
  };
  assertKnownStockFuels(variables.fuel.values);
  return variables;
}

/** The answers to the three questions, put together into the total, the areas and the makes. */
function readSnapshot(
  variables: Variables,
  docs: { areas: JsonStatDoc; makes: JsonStatDoc; ages: JsonStatDoc },
  date: string,
): Pick<FleetDataset, 'total' | 'areas' | 'makes'> {
  const areaCounts = readCounts(docs.areas, VAR_AREA);
  const makeCounts = readCounts(docs.makes, VAR_MAKE);
  const ages = readAges(docs.ages, Number(date.slice(0, 4)));
  const counts = makeCounts.get(ALL);
  const age = ages.get(ALL);
  if (!counts || !age) throw new Error('The source has no row for all passenger cars');
  return {
    total: { counts, age },
    areas: buildAreas(variables.area, areaCounts),
    makes: buildMakes(variables.make, makeCounts, ages),
  };
}

/**
 * Reads the passenger cars in traffic on one day, by municipality and by make, from the PxWeb
 * database. The table is a single snapshot that the source replaces each quarter, so every
 * release keeps the day it describes. It has no model.
 */
export class TraficomFleetAdapter implements SourceAdapter<FleetDataset> {
  readonly id = 'traficom-pxweb-car-fleet';

  private readonly client: PxApi;
  private readonly databasePath: string;
  private readonly tableId: string;

  constructor(options: TraficomFleetOptions = {}) {
    this.client =
      options.client ?? new PxWebClient({ baseUrl: options.baseUrl ?? DEFAULTS.baseUrl });
    this.databasePath = options.databasePath ?? DEFAULTS.databasePath;
    this.tableId = options.tableId ?? DEFAULTS.tableId;
  }

  private async listing(): Promise<{ updated: string; date: string }> {
    const items = await this.client.listFolder(this.databasePath);
    const table = items.find((i) => i.id === this.tableId);
    if (!table) throw new Error(`Table ${this.tableId} not found in ${this.databasePath}`);
    if (!table.updated) throw new Error(`Table ${this.tableId} reports no update timestamp`);
    return { updated: table.updated, date: dayOf(table.text) };
  }

  async getVersion(): Promise<string> {
    return (await this.listing()).updated;
  }

  async fetch(): Promise<AdapterResult<FleetDataset>> {
    const { updated, date } = await this.listing();
    const path = `${this.databasePath}/${this.tableId}`;
    const variables = readVariables(await this.client.getTableMeta(path));
    const ask = (selection: PxQuery['query']) =>
      this.client.query(path, { query: selection, response: { format: 'json-stat2' } });
    const areaDoc = await ask(QUESTIONS.areas);
    const makeDoc = await ask(QUESTIONS.makes);
    const ageDoc = await ask(QUESTIONS.ages);

    return {
      dataset: {
        sourceId: this.id,
        sourceName: 'Traficom – Liikennekäytössä olevat henkilöautot',
        sourceUrl: `https://trafi2.stat.fi/PXWeb/pxweb/fi/TraFi/TraFi__${this.databasePath}/${this.tableId}/`,
        licence: 'CC BY 4.0',
        sourceVersion: updated,
        sourceUpdated: updated,
        date,
        ...readSnapshot(
          variables,
          { areas: areaDoc.doc, makes: makeDoc.doc, ages: ageDoc.doc },
          date,
        ),
      },
      rawFiles: [
        raw('fleet-areas.json', areaDoc.raw),
        raw('fleet-makes.json', makeDoc.raw),
        raw('fleet-ages.json', ageDoc.raw),
      ],
    };
  }
}

const raw = (path: string, content: string): RawFile => ({ path, content });

/** The day a table's title names, such as "Liikennekäytössä 30.09.2026 olevat henkilöautot". */
export function dayOf(title: string): string {
  const match = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(title);
  if (!match) throw new Error(`The table title names no day: "${title}"`);
  const [, day, month, year] = match;
  return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
}

/** Cars per fuel group for each value of `rowVariable`, checked against the source's own total. */
export function readCounts(doc: JsonStatDoc, rowVariable: string): Map<string, GroupCounts> {
  const rows = new Map<string, GroupCounts>();
  const own = new Map<string, number>();
  for (const { coords, value } of iterateCells(doc)) {
    const row = coords[rowVariable] ?? '';
    const fuel = coords[VAR_FUEL] ?? '';
    if (fuel === FUEL_TOTAL_CODE) {
      own.set(row, value ?? 0);
      continue;
    }
    const group = STOCK_FUEL_GROUP_MAP[fuel];
    if (!group) throw new Error(`Unmapped fuel code in source: ${fuel}`);
    const counts = rows.get(row) ?? emptyGroupCounts();
    // A class without a figure has no cars.
    counts[group] += value ?? 0;
    rows.set(row, counts);
  }
  for (const [row, counts] of rows) {
    if (sumCounts(counts) !== (own.get(row) ?? 0)) {
      throw new Error(`The fuel classes of ${row} do not add up to the source's total`);
    }
  }
  return rows;
}

/** How many cars each make has and the sum of their ages, from the year the cars came into use. */
export function readAges(doc: JsonStatDoc, snapshotYear: number): Map<string, FleetAge> {
  const ages = new Map<string, FleetAge>();
  const own = new Map<string, number>();
  for (const { coords, value } of iterateCells(doc)) {
    const make = coords[VAR_MAKE] ?? '';
    const code = coords[VAR_YEAR] ?? '';
    const cars = value ?? 0;
    if (code === ALL) {
      own.set(make, cars);
      continue;
    }
    const year = code === YEAR_OLDEST.code ? YEAR_OLDEST.year : Number(code);
    if (!Number.isInteger(year) || year > snapshotYear) {
      throw new Error(`Unexpected year of first use: ${code}`);
    }
    const age = ages.get(make) ?? { cars: 0, years: 0 };
    age.cars += cars;
    age.years += cars * (snapshotYear - year);
    ages.set(make, age);
  }
  for (const [make, age] of ages) {
    if (age.cars !== (own.get(make) ?? 0)) {
      throw new Error(`The years of ${make} do not add up to the source's total`);
    }
  }
  return ages;
}

function areaOf(code: string, name: string): Pick<FleetArea, 'id' | 'kind' | 'name'> {
  if (code === AREA_ABROAD) return { id: 'abroad', kind: 'abroad', name };
  if (code === AREA_UNKNOWN) return { id: 'unknown', kind: 'unknown', name };
  if (code.startsWith(MUNICIPALITY_PREFIX)) {
    return { id: code.slice(MUNICIPALITY_PREFIX.length), kind: 'municipality', name };
  }
  throw new Error(`Unexpected area in the source: ${code}`);
}

function buildAreas(variable: PxVariable, counts: ReadonlyMap<string, GroupCounts>): FleetArea[] {
  return variable.values
    .filter((code) => code !== AREA_MAINLAND)
    .map((code) => {
      const row = counts.get(code);
      if (!row) throw new Error(`The source has no cars for ${code}`);
      const name = variable.valueTexts[variable.values.indexOf(code)] ?? code;
      return { ...areaOf(code, name), counts: row };
    });
}

const makeKind = (code: string): FleetMakeKind =>
  code === MAKE_OTHERS ? 'others' : code === MAKE_MOTORHOMES ? 'motorhomes' : 'make';

function buildMakes(
  variable: PxVariable,
  counts: ReadonlyMap<string, GroupCounts>,
  ages: ReadonlyMap<string, FleetAge>,
): FleetMake[] {
  const used = new Set<string>();
  return variable.values
    .filter((code) => code !== ALL)
    .map((code) => {
      const row = counts.get(code);
      const age = ages.get(code);
      if (!row || !age) throw new Error(`The source has no cars for the make ${code}`);
      const name = (variable.valueTexts[variable.values.indexOf(code)] ?? code).trim();
      // Two makes can share a name once it is made into an id; the source code tells them apart.
      let id = slugify(name);
      if (!id || used.has(id)) id = `${id ? `${id}-` : ''}${slugify(code) || 'x'}`;
      used.add(id);
      return { id, name, kind: makeKind(code), counts: row, age };
    });
}
