import type {
  Area,
  AreaObservations,
  Entity,
  Observation,
  Period,
  RegionalDataset,
} from '@regs/core';
import { consoleLogger, type Logger } from '../../logger.js';
import type { ObjectStore } from '../../storage/types.js';
import { mapWithConcurrency } from '../../util/pool.js';
import type { AdapterResult, SourceAdapter } from '../types.js';
import { AreaCacheStore } from './area-cache.js';
import { PxWebClient, type PxQuery, type PxTableMeta } from '../pxweb/client.js';
import { iterateCells } from '../pxweb/jsonstat.js';
import {
  ALL_CARS_CODE,
  areaFromCode,
  buildEntities,
  codeFromPeriod,
  FUEL_TOTAL_CODE,
  NATIONAL_AREA_CODE,
  periodFromCode,
} from './mapping.js';
import { assertKnownFuels, VAR_AREA, VAR_FUEL, VAR_MODEL, VAR_MONTH } from './table-schema.js';
import { planChunks, requireVariable, tableVersion, type PxApi } from '../pxweb/api.js';
import { collectObservations } from './query.js';

export interface TraficomRegionalOptions {
  /** Holds one file per area, so an interrupted run resumes and later runs fetch only new months. */
  cache: ObjectStore;
  client?: PxApi;
  baseUrl?: string;
  databasePath?: string;
  tableId?: string;
  fromYear?: number;
  maxCells?: number;
  concurrency?: number;
  /** Months read again on every source update, since the source can correct recent figures. */
  refetchMonths?: number;
  logger?: Logger;
}

const DEFAULTS = {
  baseUrl: 'https://trafi2.stat.fi/PXWeb/api/v1/fi/TraFi',
  databasePath: 'Ensirekisteroinnit',
  tableId: '050_ensirek_tau_105.px',
  fromYear: 2021,
  maxCells: 100_000,
  concurrency: 2,
  refetchMonths: 3,
} as const;

interface SourceArea {
  code: string;
  area: Area;
}

interface TableSchema {
  entities: Entity[];
  idByCode: ReadonlyMap<string, string>;
  areas: SourceArea[];
  modelCodes: string[];
  fuelCount: number;
  monthCodes: string[];
}

interface FetchPlan {
  sourceVersion: string;
  modelCodes: string[];
  idByCode: ReadonlyMap<string, string>;
  fuelCount: number;
  monthCodes: string[];
}

/**
 * Reads first registrations per municipality from the same Traficom table as the national
 * adapter, starting from `fromYear`. Each request covers one area, because the source answers far
 * faster that way than for many areas at once.
 */
export class TraficomRegionalAdapter implements SourceAdapter<RegionalDataset> {
  readonly id = 'traficom-pxweb-regional';

  private readonly client: PxApi;
  private readonly databasePath: string;
  private readonly tableId: string;
  private readonly cache: AreaCacheStore;
  private readonly log: Logger;
  private readonly fromYear: number;
  private readonly maxCells: number;
  private readonly concurrency: number;
  private readonly refetchMonths: number;

  constructor(options: TraficomRegionalOptions) {
    this.client =
      options.client ?? new PxWebClient({ baseUrl: options.baseUrl ?? DEFAULTS.baseUrl });
    this.databasePath = options.databasePath ?? DEFAULTS.databasePath;
    this.tableId = options.tableId ?? DEFAULTS.tableId;
    this.cache = new AreaCacheStore(options.cache);
    this.log = options.logger ?? consoleLogger;
    this.fromYear = options.fromYear ?? DEFAULTS.fromYear;
    this.maxCells = options.maxCells ?? DEFAULTS.maxCells;
    this.concurrency = options.concurrency ?? DEFAULTS.concurrency;
    this.refetchMonths = options.refetchMonths ?? DEFAULTS.refetchMonths;
  }

  private get tablePath(): string {
    return `${this.databasePath}/${this.tableId}`;
  }

  getVersion(): Promise<string> {
    return tableVersion(this.client, this.databasePath, this.tableId);
  }

  async fetch(): Promise<AdapterResult<RegionalDataset>> {
    const sourceVersion = await this.getVersion();
    const schema = this.readSchema(await this.client.getTableMeta(this.tablePath));
    const plan: FetchPlan = {
      sourceVersion,
      modelCodes: schema.modelCodes,
      idByCode: schema.idByCode,
      fuelCount: schema.fuelCount,
      monthCodes: schema.monthCodes,
    };

    const nationalTotals = await this.fetchNationalTotals(plan.monthCodes);
    const areaObservations = await this.fetchAreas(schema.areas, plan);
    return {
      dataset: {
        sourceId: this.id,
        sourceName: 'Traficom – Henkilöautojen ensirekisteröinnit kunnittain',
        sourceUrl: 'https://trafi2.stat.fi/PXWeb/pxweb/fi/TraFi/TraFi__Ensirekisteroinnit/',
        licence: 'CC BY 4.0',
        sourceVersion,
        sourceUpdated: sourceVersion,
        entities: schema.entities,
        areas: schema.areas.map((a) => a.area),
        areaObservations,
        nationalTotals,
      },
      rawFiles: [],
    };
  }

  private readSchema(meta: PxTableMeta): TableSchema {
    const areaVar = requireVariable(meta.variables, VAR_AREA);
    const models = requireVariable(meta.variables, VAR_MODEL);
    const fuels = requireVariable(meta.variables, VAR_FUEL);
    const months = requireVariable(meta.variables, VAR_MONTH);
    assertKnownFuels(fuels);

    const { entities, idByCode } = buildEntities(
      models.values.map((code, i) => ({ code, label: models.valueTexts[i] ?? code })),
    );
    return {
      entities,
      idByCode,
      areas: areaVar.values
        .map((code, i) => ({ code, area: areaFromCode(code, areaVar.valueTexts[i] ?? code) }))
        .flatMap(({ code, area }) => (area ? [{ code, area }] : [])),
      modelCodes: models.values,
      fuelCount: fuels.values.length,
      monthCodes: months.values.filter((c) => Number(c.slice(0, 4)) >= this.fromYear),
    };
  }

  private async fetchAreas(areas: SourceArea[], plan: FetchPlan): Promise<AreaObservations[]> {
    let done = 0;
    return mapWithConcurrency(areas, this.concurrency, async ({ code, area }) => {
      const observations = await this.loadArea(code, plan).catch((error: unknown) => {
        throw new Error(`Area ${code} failed`, { cause: error });
      });
      this.log.info(`Area ${code} ready (${++done}/${areas.length})`);
      return { areaId: area.id, observations };
    });
  }

  private async loadArea(code: string, plan: FetchPlan): Promise<Observation[]> {
    const cached = await this.cache.read(code);
    const usable = cached?.fromYear === this.fromYear ? cached : null;
    if (usable?.sourceVersion === plan.sourceVersion) return usable.observations;

    const through = usable ? plan.monthCodes.indexOf(codeFromPeriod(usable.throughMonth)) : -1;
    const start = through < 0 ? 0 : Math.max(0, through - this.refetchMonths + 1);
    const monthCodes = plan.monthCodes.slice(start);
    const firstPeriod = periodFromCode(monthCodes[0] as string);

    const fetched = await this.queryArea(code, { ...plan, monthCodes });
    const kept = usable ? usable.observations.filter((o) => o.period < firstPeriod) : [];
    const observations = [...kept, ...fetched];
    await this.cache.write(code, {
      sourceVersion: plan.sourceVersion,
      fromYear: this.fromYear,
      throughMonth: periodFromCode(plan.monthCodes.at(-1) as string),
      observations,
    });
    return observations;
  }

  private async queryArea(code: string, plan: FetchPlan): Promise<Observation[]> {
    const cellsPerModel = plan.fuelCount * plan.monthCodes.length;
    const observations: Observation[] = [];
    for (const chunk of planChunks(plan.modelCodes, cellsPerModel, this.maxCells)) {
      const { doc } = await this.client.query(
        this.tablePath,
        areaQuery(code, chunk, plan.monthCodes),
      );
      observations.push(...collectObservations(doc, plan.idByCode).observations);
    }
    return observations;
  }

  private async fetchNationalTotals(monthCodes: string[]): Promise<Record<Period, number>> {
    const { doc } = await this.client.query(this.tablePath, {
      query: [
        { code: VAR_AREA, selection: { filter: 'item', values: [NATIONAL_AREA_CODE] } },
        { code: VAR_MODEL, selection: { filter: 'item', values: [ALL_CARS_CODE] } },
        { code: VAR_FUEL, selection: { filter: 'item', values: [FUEL_TOTAL_CODE] } },
        { code: VAR_MONTH, selection: { filter: 'item', values: monthCodes } },
      ],
      response: { format: 'json-stat2' },
    });
    const totals: Record<Period, number> = {};
    for (const { coords, value } of iterateCells(doc)) {
      totals[periodFromCode(coords[VAR_MONTH] as string)] = value ?? 0;
    }
    return totals;
  }
}

function areaQuery(areaCode: string, modelCodes: string[], monthCodes: string[]): PxQuery {
  return {
    query: [
      { code: VAR_AREA, selection: { filter: 'item', values: [areaCode] } },
      { code: VAR_MODEL, selection: { filter: 'item', values: modelCodes } },
      { code: VAR_FUEL, selection: { filter: 'all', values: ['*'] } },
      { code: VAR_MONTH, selection: { filter: 'item', values: monthCodes } },
    ],
    response: { format: 'json-stat2' },
  };
}
