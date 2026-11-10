import type { PxVariable, PxWebClient } from './client.js';

/** The part of the PxWeb client the adapters use, so tests can pass a fake. */
export type PxApi = Pick<PxWebClient, 'listFolder' | 'getTableMeta' | 'query'>;

/**
 * Splits items into requests within a cell budget. The API caps cells, not items, so the batch
 * size shrinks as the table gains months or fuel classes.
 */
export function planChunks<T>(
  items: readonly T[],
  cellsPerItem: number,
  maxCells: number,
  fixedSize?: number,
): T[][] {
  const size = fixedSize ?? Math.max(1, Math.floor(maxCells / Math.max(1, cellsPerItem)));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** The source's update timestamp for a table, which is the version the pipeline compares. */
export async function tableVersion(
  client: PxApi,
  databasePath: string,
  tableId: string,
): Promise<string> {
  const items = await client.listFolder(databasePath);
  const table = items.find((i) => i.id === tableId);
  if (!table) throw new Error(`Table ${tableId} not found in ${databasePath}`);
  if (!table.updated) throw new Error(`Table ${tableId} reports no update timestamp`);
  return table.updated;
}

export function requireVariable(variables: PxVariable[], code: string): PxVariable {
  const variable = variables.find((v) => v.code === code);
  if (!variable) throw new Error(`Table has no variable "${code}" - source schema changed?`);
  return variable;
}
