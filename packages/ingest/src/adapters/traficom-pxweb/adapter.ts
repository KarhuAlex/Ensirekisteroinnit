import type { Dataset, Observation } from '@regs/core';
import { consoleLogger, type Logger } from '../../logger.js';
import type { AdapterResult, RawFile, SourceAdapter } from '../types.js';
import { PxWebClient, type PxQuery } from './client.js';
import { collectObservations, planChunks, type PxApi } from './query.js';
import { ALL_CARS_CODE, buildEntities } from './mapping.js';
import {
  assertKnownFuels,
  requireVariable,
  VAR_AREA,
  VAR_FUEL,
  VAR_MODEL,
  VAR_MONTH,
} from './table-schema.js';

export interface TraficomPxWebOptions {
  client?: PxApi;
  baseUrl?: string;
  databasePath?: string;
  tableId?: string;
  /** Area code to fetch; `MA1` is mainland Finland. */
  areaCode?: string;
  /** Cell budget per request, kept below the API's own cap (110 000 at Traficom). */
  maxCells?: number;
  /** Fixed number of model series per request; by default derived from `maxCells`. */
  chunkSize?: number;
  logger?: Logger;
}

const DEFAULTS = {
  baseUrl: 'https://trafi2.stat.fi/PXWeb/api/v1/fi/TraFi',
  databasePath: 'Ensirekisteroinnit',
  tableId: '050_ensirek_tau_105.px',
  areaCode: 'MA1',
  maxCells: 100_000,
} as const;

/**
 * Reads first registrations of passenger cars by model series, fuel and month from Traficom's
 * PxWeb database. It fetches national totals for now; the area dimension is where municipality
 * data would plug in.
 */
export class TraficomPxWebAdapter implements SourceAdapter {
  readonly id = 'traficom-pxweb';

  private readonly client: PxApi;
  private readonly databasePath: string;
  private readonly tableId: string;
  private readonly areaCode: string;
  private readonly maxCells: number;
  private readonly chunkSize: number | undefined;
  private readonly log: Logger;
  private readonly baseUrl: string;

  constructor(opts: TraficomPxWebOptions = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULTS.baseUrl;
    this.client = opts.client ?? new PxWebClient({ baseUrl: this.baseUrl });
    this.databasePath = opts.databasePath ?? DEFAULTS.databasePath;
    this.tableId = opts.tableId ?? DEFAULTS.tableId;
    this.areaCode = opts.areaCode ?? DEFAULTS.areaCode;
    this.maxCells = opts.maxCells ?? DEFAULTS.maxCells;
    this.chunkSize = opts.chunkSize;
    this.log = opts.logger ?? consoleLogger;
  }

  private get tablePath(): string {
    return `${this.databasePath}/${this.tableId}`;
  }

  async getVersion(): Promise<string> {
    const items = await this.client.listFolder(this.databasePath);
    const table = items.find((i) => i.id === this.tableId);
    if (!table) throw new Error(`Table ${this.tableId} not found in ${this.databasePath}`);
    if (!table.updated) throw new Error(`Table ${this.tableId} reports no update timestamp`);
    return table.updated;
  }

  async fetch(): Promise<AdapterResult> {
    const sourceVersion = await this.getVersion();
    const meta = await this.client.getTableMeta(this.tablePath);

    const area = requireVariable(meta.variables, VAR_AREA);
    const models = requireVariable(meta.variables, VAR_MODEL);
    const fuels = requireVariable(meta.variables, VAR_FUEL);
    const months = requireVariable(meta.variables, VAR_MONTH);

    if (!area.values.includes(this.areaCode)) {
      throw new Error(`Area ${this.areaCode} not present in ${this.tableId}`);
    }
    assertKnownFuels(fuels);

    const { entities, idByCode } = buildEntities(
      models.values.map((code, i) => ({ code, label: models.valueTexts[i] ?? code })),
    );

    const cellsPerModel = fuels.values.length * months.values.length;
    const chunks = planChunks(models.values, cellsPerModel, this.maxCells, this.chunkSize);

    const safeVersion = sourceVersion.replace(/[^0-9A-Za-z-]/g, '-');
    const rawFiles: RawFile[] = [
      { path: `${this.id}/${safeVersion}/meta.json`, content: JSON.stringify(meta) },
    ];
    const observations: Observation[] = [];
    const notes = new Set<string>();
    let sourceUpdated = sourceVersion;
    let mismatches = 0;

    for (const [index, chunk] of chunks.entries()) {
      this.log.info(`Fetching chunk ${index + 1}/${chunks.length} (${chunk.length} model series)`);
      const { doc, raw } = await this.client.query(
        this.tablePath,
        buildQuery(this.areaCode, chunk),
      );
      rawFiles.push({
        path: `${this.id}/${safeVersion}/chunk-${String(index + 1).padStart(3, '0')}.json`,
        content: raw,
      });
      if (doc.updated && doc.updated > sourceUpdated) sourceUpdated = doc.updated;
      for (const n of doc.note ?? []) notes.add(n.replace(/^\*+\s*/, '').trim());

      const result = collectObservations(doc, idByCode);
      observations.push(...result.observations);
      mismatches += result.mismatches;
    }

    if (mismatches > 0) {
      this.log.warn(
        `${mismatches} entity-months where fuel rows do not add up to the reported total`,
      );
    }

    const dataset: Dataset = {
      sourceId: this.id,
      sourceName: 'Traficom – Henkilöautojen mallisarjojen ensirekisteröinnit',
      sourceUrl: 'https://trafi2.stat.fi/PXWeb/pxweb/fi/TraFi/TraFi__Ensirekisteroinnit/',
      licence: 'CC BY 4.0',
      sourceVersion,
      sourceUpdated,
      entities,
      observations,
      notes: [...notes].filter(Boolean),
    };
    this.log.info(
      `Fetched ${observations.length} observations for ${entities.length} entities, ${months.values.length} months`,
    );
    return { dataset, rawFiles };
  }
}

export function buildQuery(areaCode: string, modelCodes: string[]): PxQuery {
  return {
    query: [
      { code: VAR_AREA, selection: { filter: 'item', values: [areaCode] } },
      { code: VAR_MODEL, selection: { filter: 'item', values: modelCodes } },
      { code: VAR_FUEL, selection: { filter: 'all', values: ['*'] } },
      { code: VAR_MONTH, selection: { filter: 'all', values: ['*'] } },
    ],
    response: { format: 'json-stat2' },
  };
}

export { ALL_CARS_CODE };
