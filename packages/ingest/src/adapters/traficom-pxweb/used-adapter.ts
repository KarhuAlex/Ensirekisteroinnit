import { TOTAL_ENTITY_ID, type Dataset, type Entity, type Observation } from '@regs/core';
import { consoleLogger, type Logger } from '../../logger.js';
import type { AdapterResult, SourceAdapter } from '../types.js';
import { PxWebClient, type PxQuery } from './client.js';
import { FUEL_TOTAL_CODE, slugify, USED_FUEL_CODE_MAP } from './mapping.js';
import { collectObservations, planChunks, tableVersion, type PxApi } from './query.js';
import { requireVariable, VAR_FUEL, VAR_MONTH } from './table-schema.js';

const VAR_MAKE = 'Merkki';
const VAR_USE_YEAR = 'Käyttöönottovuosi';
/** The all-makes and all-ages rows of the table. */
const ALL_CODE = 'YH';

export interface TraficomUsedImportOptions {
  client?: PxApi;
  baseUrl?: string;
  databasePath?: string;
  tableId?: string;
  maxCells?: number;
  logger?: Logger;
}

const DEFAULTS = {
  baseUrl: 'https://trafi2.stat.fi/PXWeb/api/v1/fi/TraFi',
  databasePath: 'Kaytettyna_maahantuodut',
  tableId: '040_yksmaah_tau_104.px',
  maxCells: 100_000,
} as const;

/**
 * Reads passenger cars imported used by make, fuel and month from the PxWeb database. The table
 * has no model or area, so the entities are makes, and it is summed over the age groups.
 */
export class TraficomUsedImportAdapter implements SourceAdapter<Dataset> {
  readonly id = 'traficom-pxweb-used-imports';

  private readonly client: PxApi;
  private readonly databasePath: string;
  private readonly tableId: string;
  private readonly maxCells: number;
  private readonly log: Logger;

  constructor(options: TraficomUsedImportOptions = {}) {
    this.client =
      options.client ?? new PxWebClient({ baseUrl: options.baseUrl ?? DEFAULTS.baseUrl });
    this.databasePath = options.databasePath ?? DEFAULTS.databasePath;
    this.tableId = options.tableId ?? DEFAULTS.tableId;
    this.maxCells = options.maxCells ?? DEFAULTS.maxCells;
    this.log = options.logger ?? consoleLogger;
  }

  private get tablePath(): string {
    return `${this.databasePath}/${this.tableId}`;
  }

  getVersion(): Promise<string> {
    return tableVersion(this.client, this.databasePath, this.tableId);
  }

  async fetch(): Promise<AdapterResult<Dataset>> {
    const sourceVersion = await this.getVersion();
    const meta = await this.client.getTableMeta(this.tablePath);
    const makes = requireVariable(meta.variables, VAR_MAKE);
    const fuels = requireVariable(meta.variables, VAR_FUEL);
    const months = requireVariable(meta.variables, VAR_MONTH);
    requireVariable(meta.variables, VAR_USE_YEAR);

    const unknown = fuels.values.filter((c) => c !== FUEL_TOTAL_CODE && !(c in USED_FUEL_CODE_MAP));
    if (unknown.length > 0) throw new Error(`Unmapped fuel codes in source: ${unknown.join(', ')}`);

    const { entities, idByCode } = buildMakes(
      makes.values.map((code, i) => ({ code, label: makes.valueTexts[i] ?? code })),
    );
    const cellsPerMake = fuels.values.length * months.values.length;
    const chunks = planChunks(makes.values, cellsPerMake, this.maxCells);
    const { observations, notes } = await this.fetchChunks(chunks, idByCode);

    return {
      dataset: {
        sourceId: this.id,
        sourceName: 'Traficom – Käytettynä maahantuodut henkilöautot',
        sourceUrl: 'https://trafi2.stat.fi/PXWeb/pxweb/fi/TraFi/TraFi__Kaytettyna_maahantuodut/',
        licence: 'CC BY 4.0',
        sourceVersion,
        sourceUpdated: sourceVersion,
        entities,
        observations,
        notes: notes.filter(Boolean),
      },
      rawFiles: [],
    };
  }

  private async fetchChunks(
    chunks: string[][],
    idByCode: ReadonlyMap<string, string>,
  ): Promise<{ observations: Observation[]; notes: string[] }> {
    const observations: Observation[] = [];
    const notes = new Set<string>();
    let mismatches = 0;
    for (const [index, chunk] of chunks.entries()) {
      this.log.info(`Fetching chunk ${index + 1}/${chunks.length} (${chunk.length} makes)`);
      const { doc } = await this.client.query(this.tablePath, makeQuery(chunk));
      for (const n of doc.note ?? []) notes.add(n.replace(/^\*+\s*/, '').trim());
      const result = collectObservations(doc, idByCode, {
        entityVariable: VAR_MAKE,
        fuelMap: USED_FUEL_CODE_MAP,
      });
      observations.push(...result.observations);
      mismatches += result.mismatches;
    }
    if (mismatches > 0) {
      this.log.warn(
        `${mismatches} make-months where fuel rows do not add up to the reported total`,
      );
    }
    return { observations, notes: [...notes] };
  }
}

function makeQuery(makeCodes: string[]): PxQuery {
  return {
    query: [
      { code: VAR_MAKE, selection: { filter: 'item', values: makeCodes } },
      { code: VAR_USE_YEAR, selection: { filter: 'item', values: [ALL_CODE] } },
      { code: VAR_FUEL, selection: { filter: 'all', values: ['*'] } },
      { code: VAR_MONTH, selection: { filter: 'all', values: ['*'] } },
    ],
    response: { format: 'json-stat2' },
  };
}

/**
 * The makes of the table plus its all-cars row. Ids follow the registrations data (a slug of the
 * label), so a make in both datasets gets the same id and the make page can link to it.
 */
export function buildMakes(values: readonly { code: string; label: string }[]): {
  entities: Entity[];
  idByCode: Map<string, string>;
} {
  const used = new Set<string>([TOTAL_ENTITY_ID]);
  const idByCode = new Map<string, string>();
  const entities: Entity[] = [];
  for (const { code, label } of values) {
    if (code === ALL_CODE) {
      idByCode.set(code, TOTAL_ENTITY_ID);
      entities.push({ id: TOTAL_ENTITY_ID, label: 'All cars imported used', kind: 'total' });
      continue;
    }
    let id = slugify(label);
    if (!id || used.has(id)) id = `${id ? `${id}-` : ''}${slugify(code) || 'x'}`;
    used.add(id);
    idByCode.set(code, id);
    entities.push({ id, label: label.trim(), kind: 'make' });
  }
  return { entities, idByCode };
}
