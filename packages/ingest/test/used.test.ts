import type { Dataset } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { validateMakesAddUp } from '../src/pipeline/validate.js';
import {
  buildMakes,
  TraficomUsedImportAdapter,
} from '../src/adapters/traficom-pxweb/used-adapter.js';
import type { PxApi } from '../src/adapters/pxweb/api.js';
import type { JsonStatDoc } from '../src/adapters/pxweb/jsonstat.js';
import { silentLogger } from '../src/logger.js';
import { usedImportsPipeline } from '../src/pipeline/registrations.js';
import { LATEST_POINTER_PATH, runPipeline } from '../src/pipeline/run.js';
import { PrefixedStore } from '../src/storage/prefixed-store.js';
import type { ObjectStore } from '../src/storage/types.js';

class MemoryStore implements ObjectStore {
  readonly files = new Map<string, string>();
  async put(path: string, body: string) {
    this.files.set(path, body);
  }
  async get(path: string) {
    return this.files.get(path) ?? null;
  }
}

const MAKES = { YH: 'Henkilöautot yhteensä', A1: 'Audi', B1: 'BMW' };
const FUELS = { YH: 'Yhteensä', '01': 'Bensiini', '03': 'Polttoöljy', '04': 'Sähkö' };
const MONTHS = ['2026M01', '2026M02'];

function fakeApi(fuels: Record<string, string> = FUELS): PxApi {
  const variable = (code: string, labels: Record<string, string>) => ({
    code,
    text: code,
    values: Object.keys(labels),
    valueTexts: Object.values(labels),
  });
  const variables = [
    variable('Merkki', MAKES),
    variable('Käyttöönottovuosi', { YH: 'Yhteensä' }),
    variable('Käyttövoima', fuels),
    variable('Kuukausi', Object.fromEntries(MONTHS.map((m) => [m, m]))),
  ];
  const index = (codes: string[]) => Object.fromEntries(codes.map((c, i) => [c, i]));
  return {
    listFolder: async () => [{ id: '040_yksmaah_tau_104.px', type: 't', text: 't', updated: 'v1' }],
    getTableMeta: async () => ({ title: 't', variables }),
    query: async (_path, q) => {
      const values = (code: string) => {
        const sel = q.query.find((x) => x.code === code)!.selection;
        return sel.filter === 'all' ? variables.find((v) => v.code === code)!.values : sel.values;
      };
      const makes = values('Merkki');
      const years = values('Käyttöönottovuosi');
      const fuelCodes = values('Käyttövoima');
      const months = values('Kuukausi');
      // The all-cars row is the sum of the two real makes.
      const value = makes.flatMap((make) =>
        years.flatMap(() =>
          fuelCodes.flatMap((fuel) =>
            months.map(() => (fuel === 'YH' ? 3 : 1) * (make === 'YH' ? 2 : 1)),
          ),
        ),
      );
      const dim = (codes: string[]) => ({ category: { index: index(codes) } });
      const doc: JsonStatDoc = {
        id: ['Merkki', 'Käyttöönottovuosi', 'Käyttövoima', 'Kuukausi'],
        size: [makes.length, years.length, fuelCodes.length, months.length],
        value,
        dimension: {
          Merkki: dim(makes),
          Käyttöönottovuosi: dim(years),
          Käyttövoima: dim(fuelCodes),
          Kuukausi: dim(months),
        },
      };
      return { doc, raw: JSON.stringify(doc) };
    },
  };
}

describe('buildMakes', () => {
  it('maps the all-cars row to the total entity and the rest to makes', () => {
    const { entities, idByCode } = buildMakes([
      { code: 'YH', label: 'Henkilöautot yhteensä' },
      { code: '1', label: 'Mercedes-Benz' },
    ]);
    expect(entities).toMatchObject([
      { id: 'total', kind: 'total' },
      { id: 'mercedes-benz', kind: 'make' },
    ]);
    expect(idByCode.get('1')).toBe('mercedes-benz');
  });

  it('gives a make with a repeated label an id of its own', () => {
    const { entities } = buildMakes([
      { code: '1', label: 'Opel' },
      { code: '2', label: 'OPEL' },
    ]);
    expect(new Set(entities.map((e) => e.id)).size).toBe(2);
  });
});

describe('TraficomUsedImportAdapter', () => {
  const adapter = (api: PxApi) =>
    new TraficomUsedImportAdapter({ client: api, logger: silentLogger });

  it('reads makes by fuel and month, and files unknown-class fuels under other', async () => {
    const { dataset } = await adapter(fakeApi()).fetch();
    expect(dataset.entities.map((e) => e.id)).toEqual(['total', 'audi', 'bmw']);
    const audi = dataset.observations.filter((o) => o.entityId === 'audi');
    expect(audi.map((o) => o.fuel).sort()).toEqual(
      ['bev', 'bev', 'other', 'other', 'petrol', 'petrol'].sort(),
    );
    expect(dataset.sourceVersion).toBe('v1');
  });

  it('fails on a fuel class it does not know', async () => {
    await expect(adapter(fakeApi({ ...FUELS, '99': 'Uusi' })).fetch()).rejects.toThrow(
      /Unmapped fuel codes/,
    );
  });
});

describe('validateMakesAddUp', () => {
  const entities: Dataset['entities'] = [
    { id: 'total', label: 'All', kind: 'total' },
    { id: 'audi', label: 'Audi', kind: 'make' },
    { id: 'bmw', label: 'BMW', kind: 'make' },
  ];
  const obs = (entityId: string, count: number) => ({
    entityId,
    period: '2026-01',
    fuel: 'petrol' as const,
    count,
  });
  const dataset = (observations: Dataset['observations']) =>
    ({ entities, observations }) as Dataset;

  it('accepts makes that add up to the total', () => {
    expect(() =>
      validateMakesAddUp(dataset([obs('total', 10), obs('audi', 6), obs('bmw', 4)])),
    ).not.toThrow();
  });

  it('rejects a month where makes are missing', () => {
    expect(() => validateMakesAddUp(dataset([obs('total', 10), obs('audi', 6)]))).toThrow(
      /do not add up/,
    );
  });
});

describe('used imports pipeline', () => {
  it('publishes under its own prefix with a make level matrix', async () => {
    const published = new MemoryStore();
    const run = () =>
      runPipeline(
        usedImportsPipeline(adapter(fakeApi()), {
          minEntities: 3,
          minMonths: 2,
          minObservations: 1,
        }),
        {
          rawStore: new PrefixedStore(new MemoryStore(), 'used/'),
          publishedStore: new PrefixedStore(published, 'used/'),
          logger: silentLogger,
        },
      );
    function adapter(api: PxApi) {
      return new TraficomUsedImportAdapter({ client: api, logger: silentLogger });
    }

    expect((await run()).status).toBe('published');
    const keys = [...published.files.keys()];
    expect(keys).toContain(`used/${LATEST_POINTER_PATH}`);
    const matrixKey = keys.find((k) => k.endsWith('/matrix.json'))!;
    const matrix = JSON.parse(published.files.get(matrixKey)!);
    expect(matrix.rows.map((r: { id: string }) => r.id)).toEqual(['total', 'audi', 'bmw']);
    expect((await run()).status).toBe('skipped');
  });
});
