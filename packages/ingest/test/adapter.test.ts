import { describe, expect, it } from 'vitest';
import { TraficomPxWebAdapter } from '../src/adapters/traficom-pxweb/adapter.js';
import type { PxQuery } from '../src/adapters/pxweb/client.js';
import type { JsonStatDoc } from '../src/adapters/pxweb/jsonstat.js';
import { planChunks } from '../src/adapters/pxweb/api.js';
import { silentLogger } from '../src/logger.js';

const MODELS = [
  { code: 'SSSS', label: 'Henkilöautot yhteensä' },
  { code: '1000', label: 'ACME yhteensä' },
  { code: 'ACME A1', label: 'ACME A1' },
  { code: 'ACME B2', label: 'ACME B2' },
];
const FUELS = ['YH', '01', '04'];
const MONTHS = ['2026M01', '2026M02'];
const COUNT_PER_FUEL: Record<string, number> = { YH: 3, '01': 1, '04': 2 };

const indexOf = (codes: readonly string[]) => Object.fromEntries(codes.map((c, i) => [c, i]));

/** A tiny in-memory PxWeb table: every model has 1 petrol and 2 electric cars in each month. */
function fakeApi(updated = '2026-11-03T16:42:37') {
  const queries: PxQuery[] = [];
  const api: PxApi = {
    listFolder: async () => [{ id: 't.px', type: 't', text: 'table', updated }],
    getTableMeta: async () => ({
      title: 'fake',
      variables: [
        { code: 'Alue', text: 'Alue', values: ['MA1'], valueTexts: ['Manner-Suomi'] },
        {
          code: 'Mallisarja',
          text: 'Mallisarja',
          values: MODELS.map((m) => m.code),
          valueTexts: MODELS.map((m) => m.label),
        },
        { code: 'Käyttövoima', text: 'Käyttövoima', values: FUELS, valueTexts: FUELS },
        { code: 'Kuukausi', text: 'Kuukausi', values: MONTHS, valueTexts: MONTHS, time: true },
      ],
    }),
    query: async (_path, query) => {
      queries.push(query);
      const models = query.query[1]?.selection.values ?? [];
      const value = models.flatMap(() =>
        FUELS.flatMap((fuel) => MONTHS.map(() => COUNT_PER_FUEL[fuel] ?? 0)),
      );
      const doc: JsonStatDoc = {
        id: ['Alue', 'Mallisarja', 'Käyttövoima', 'Kuukausi'],
        size: [1, models.length, FUELS.length, MONTHS.length],
        dimension: {
          Alue: { category: { index: { MA1: 0 } } },
          Mallisarja: { category: { index: indexOf(models) } },
          Käyttövoima: { category: { index: indexOf(FUELS) } },
          Kuukausi: { category: { index: indexOf(MONTHS) } },
        },
        value,
        note: ['** A source note.'],
      };
      return { doc, raw: JSON.stringify(doc) };
    },
  };
  return { api, queries };
}

describe('planChunks', () => {
  it('derives the batch size from the cell budget', () => {
    expect(planChunks([1, 2, 3, 4, 5], 10, 25)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('always makes progress, even when one item exceeds the budget', () => {
    expect(planChunks([1, 2], 100, 10)).toEqual([[1], [2]]);
  });
  it('honours an explicit size', () => {
    expect(planChunks([1, 2, 3], 1, 1000, 2)).toEqual([[1, 2], [3]]);
  });
});

describe('TraficomPxWebAdapter', () => {
  const options = { tableId: 't.px', databasePath: 'db', logger: silentLogger };

  it('reports the table update stamp as its version', async () => {
    const { api } = fakeApi('2027-01-02T03:04:05');
    const adapter = new TraficomPxWebAdapter({ ...options, client: api });
    await expect(adapter.getVersion()).resolves.toBe('2027-01-02T03:04:05');
  });

  it('fetches in budgeted chunks and normalises the result', async () => {
    const { api, queries } = fakeApi();
    // 3 fuels x 2 months = 6 cells per model; a budget of 12 allows 2 models per request.
    const adapter = new TraficomPxWebAdapter({ ...options, client: api, maxCells: 12 });
    const { dataset, rawFiles } = await adapter.fetch();

    expect(queries).toHaveLength(2);
    expect(queries.every((q) => (q.query[1]?.selection.values.length ?? 0) <= 2)).toBe(true);
    expect(rawFiles.map((f) => f.path)).toEqual([
      'traficom-pxweb/2026-11-03T16-42-37/meta.json',
      'traficom-pxweb/2026-11-03T16-42-37/chunk-001.json',
      'traficom-pxweb/2026-11-03T16-42-37/chunk-002.json',
    ]);
    expect(dataset.entities.map((e) => e.kind)).toEqual(['total', 'make', 'model', 'model']);
    expect(dataset.entities[2]?.makeId).toBe('acme');
    // 4 entities x 2 months x 2 fuels with registrations; the "all fuels" row is never published.
    expect(dataset.observations).toHaveLength(16);
    expect(dataset.notes).toEqual(['A source note.']);
    expect(dataset.sourceVersion).toBe('2026-11-03T16:42:37');
  });

  it('fails clearly when the area is missing from the table', async () => {
    const { api } = fakeApi();
    const adapter = new TraficomPxWebAdapter({ ...options, client: api, areaCode: 'XX9' });
    await expect(adapter.fetch()).rejects.toThrow(/Area XX9 not present/);
  });
});
