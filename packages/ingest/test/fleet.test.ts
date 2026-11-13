import {
  decodeCells,
  emptyGroupCounts,
  sumCounts,
  type CarFleetCells,
  type FleetArea,
  type FleetCell,
  type FleetDataset,
  type FleetMake,
  type GroupCounts,
} from '@regs/core';
import { describe, expect, it } from 'vitest';
import type { PxApi } from '../src/adapters/pxweb/api.js';
import type { JsonStatDoc } from '../src/adapters/pxweb/jsonstat.js';
import {
  dayOf,
  makeGroups,
  readAges,
  readCells,
  readCounts,
  TraficomFleetAdapter,
} from '../src/adapters/traficom-pxweb/fleet-adapter.js';
import type { SourceAdapter } from '../src/adapters/types.js';
import { silentLogger } from '../src/logger.js';
import { buildFleetRelease, fleetPipeline, validateFleet } from '../src/pipeline/fleet.js';
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

function doc(dimensions: Record<string, string[]>, value: (number | null)[]): JsonStatDoc {
  const id = Object.keys(dimensions);
  return {
    id,
    size: id.map((d) => dimensions[d]!.length),
    value,
    dimension: Object.fromEntries(
      id.map((d) => [
        d,
        { category: { index: Object.fromEntries(dimensions[d]!.map((c, i) => [c, i])) } },
      ]),
    ),
  };
}

const FUELS = ['YH', '01', '04', '39'];
const AREAS = ['MA1', 'KU005', 'KU020', '200', 'X'];
const MAKES = ['YH', 'AUD', 'MUUT', 'MATK'];
const YEARS = ['YH', '2026', '2020', '9999'];
const MUNICIPALITIES_OF_SOURCE = ['KU005', 'KU020'];
const CELL_MAKES = ['AUD', 'MUUT', 'MATK'];

// Rows are areas or makes, columns the fuels: all, petrol, electric, plug-in hybrid.
const AREA_ROWS = [
  [100, 60, 30, 10],
  [50, 30, 15, 5],
  [40, 20, 15, 5],
  [6, 6, 0, 0],
  [4, 4, 0, 0],
];
const MAKE_ROWS = [
  [100, 60, 30, 10],
  [70, 40, 25, 5],
  [20, 15, 3, 2],
  [10, 5, 2, 3],
];
// Rows are makes, columns the years: all, 2026, 2020, and 1959 and earlier.
const AGE_ROWS = [
  [100, 10, 50, 40],
  [70, 10, 40, 20],
  [20, 0, 10, 10],
  [10, 0, 0, 10],
];

// Rows are a municipality and a make, columns the fuels: all, petrol, electric, plug-in hybrid.
// The makes of each municipality add up to its row above.
const CELL_ROWS = [
  [30, 18, 9, 3],
  [12, 8, 3, 1],
  [8, 4, 3, 1],
  [24, 12, 9, 3],
  [10, 6, 3, 1],
  [6, 2, 3, 1],
];

function fakeApi(over: { fuels?: string[]; title?: string; areaRows?: number[][] } = {}): PxApi {
  const fuels = over.fuels ?? FUELS;
  return {
    listFolder: async () => [
      {
        id: '010.px',
        type: 't',
        text: over.title ?? 'Liikennekäytössä 30.09.2026 olevat henkilöautot alueittain',
        updated: 'v1',
      },
    ],
    getTableMeta: async () => ({
      title: 't',
      variables: [
        {
          code: 'Alue',
          text: 'a',
          values: AREAS,
          valueTexts: ['MANNER-SUOMI', 'Alajärvi', 'Akaa', 'Ulkomaat', 'Tuntematon'],
        },
        {
          code: 'Merkki',
          text: 'm',
          values: MAKES,
          valueTexts: [
            'Henkilöautot yhteensä',
            'Audi',
            'Muut merkit yhteensä',
            'Matkailuautot yhteensä',
          ],
        },
        { code: 'Käyttöönottovuosi', text: 'y', values: YEARS, valueTexts: YEARS },
        { code: 'Käyttövoima', text: 'f', values: fuels, valueTexts: fuels },
      ],
    }),
    query: async (_path, { query }) => {
      const filterOf = (code: string) => query.find((q) => q.code === code)?.selection.filter;
      const asksForCells = query.some(
        (q) => q.code === 'Alue' && q.selection.values.includes('KU005'),
      );
      const askedMakes = query.find((q) => q.code === 'Merkki')?.selection.values ?? [];
      const result = asksForCells
        ? doc(
            {
              Alue: MUNICIPALITIES_OF_SOURCE,
              Merkki: askedMakes,
              Käyttöönottovuosi: ['YH'],
              Käyttövoima: FUELS,
            },
            MUNICIPALITIES_OF_SOURCE.flatMap((_, municipality) =>
              askedMakes.flatMap(
                (make) => CELL_ROWS[municipality * CELL_MAKES.length + CELL_MAKES.indexOf(make)]!,
              ),
            ),
          )
        : filterOf('Alue') === 'all'
          ? doc(
              { Alue: AREAS, Merkki: ['YH'], Käyttöönottovuosi: ['YH'], Käyttövoima: FUELS },
              (over.areaRows ?? AREA_ROWS).flat(),
            )
          : filterOf('Käyttöönottovuosi') === 'all'
            ? doc(
                { Alue: ['MA1'], Merkki: MAKES, Käyttöönottovuosi: YEARS, Käyttövoima: ['YH'] },
                AGE_ROWS.flat(),
              )
            : doc(
                { Alue: ['MA1'], Merkki: MAKES, Käyttöönottovuosi: ['YH'], Käyttövoima: FUELS },
                MAKE_ROWS.flat(),
              );
      return { doc: result, raw: JSON.stringify(result) };
    },
  };
}

describe('dayOf', () => {
  it('reads the day a table title names', () => {
    expect(dayOf('Liikennekäytössä 30.09.2026 olevat henkilöautot alueittain')).toBe('2026-09-30');
    expect(dayOf('Cars in traffic on 1.3.2027')).toBe('2027-03-01');
  });

  it('fails when the title names no day', () => {
    expect(() => dayOf('Liikennekäytössä olevat henkilöautot')).toThrow(/names no day/);
  });
});

describe('readCounts', () => {
  it('adds the fuel classes up into groups', () => {
    const counts = readCounts(
      doc({ Alue: ['MA1'], Käyttövoima: FUELS }, [100, 60, 30, 10]),
      'Alue',
    );
    expect(counts.get('MA1')).toEqual({ petrol: 60, diesel: 0, bev: 30, phev: 10, other: 0 });
  });

  it('fails when a row does not add up to the source total', () => {
    const wrong = doc({ Alue: ['MA1'], Käyttövoima: FUELS }, [100, 60, 30, 9]);
    expect(() => readCounts(wrong, 'Alue')).toThrow(/do not add up/);
  });

  it('counts a class without a figure as no cars', () => {
    const gap = doc({ Alue: ['MA1'], Käyttövoima: FUELS }, [90, 60, 30, null]);
    expect(readCounts(gap, 'Alue').get('MA1')?.phev).toBe(0);
  });
});

describe('makeGroups', () => {
  it('keeps every request within the limit of the source', () => {
    const makes = Array.from({ length: 102 }, (_, i) => String(i));
    const groups = makeGroups(makes, 292, 19);
    expect(groups.flat()).toEqual(makes);
    for (const group of groups) expect(group.length * 292 * 19).toBeLessThanOrEqual(110_000);
    expect(groups.length).toBeGreaterThan(1);
  });

  it('asks for at least one make at a time', () => {
    expect(makeGroups(['a', 'b'], 100_000, 19)).toEqual([['a'], ['b']]);
  });
});

describe('readCells', () => {
  const cellDoc = (rows: number[][]) =>
    doc(
      { Alue: ['KU005'], Merkki: ['AUD', 'MUUT'], Käyttöönottovuosi: ['YH'], Käyttövoima: FUELS },
      rows.flat(),
    );
  const ids = new Map([
    ['AUD', 'audi'],
    ['MUUT', 'muut'],
  ]);
  const EMPTY = [0, 0, 0, 0];

  it('reads the cars of each make in each municipality and leaves out empty pairs', () => {
    expect(readCells([cellDoc([[30, 18, 9, 3], EMPTY])], ids)).toEqual([
      { area: '005', make: 'audi', counts: { petrol: 18, diesel: 0, bev: 9, phev: 3, other: 0 } },
    ]);
  });

  it('fails when the fuels of a pair do not add up to its total', () => {
    expect(() => readCells([cellDoc([[31, 18, 9, 3], EMPTY])], ids)).toThrow(/do not add up/);
  });

  it('fails on a make or an area it has no id or place for', () => {
    const rows = [[3, 3, 0, 0], EMPTY];
    expect(() => readCells([cellDoc(rows)], new Map([['MUUT', 'muut']]))).toThrow(
      /Unexpected cell/,
    );
    const abroad = doc(
      { Alue: ['200'], Merkki: ['AUD'], Käyttöönottovuosi: ['YH'], Käyttövoima: FUELS },
      [3, 3, 0, 0],
    );
    expect(() => readCells([abroad], ids)).toThrow(/Unexpected cell/);
  });
});

describe('readAges', () => {
  it('sums the ages from the year of first use and gives the oldest row the age of 1959', () => {
    const ages = readAges(
      doc({ Merkki: ['AUD'], Käyttöönottovuosi: YEARS }, [70, 10, 40, 20]),
      2026,
    );
    expect(ages.get('AUD')).toEqual({ cars: 70, years: 40 * 6 + 20 * 67 });
  });

  it('fails on a year after the day counted and on years that do not add up', () => {
    const future = doc({ Merkki: ['AUD'], Käyttöönottovuosi: ['YH', '2027'] }, [5, 5]);
    expect(() => readAges(future, 2026)).toThrow(/Unexpected year/);
    const short = doc({ Merkki: ['AUD'], Käyttöönottovuosi: ['YH', '2020'] }, [5, 4]);
    expect(() => readAges(short, 2026)).toThrow(/do not add up/);
  });
});

describe('TraficomFleetAdapter', () => {
  it('reads the day, the areas, the makes and their ages', async () => {
    const { dataset, rawFiles } = await new TraficomFleetAdapter({
      client: fakeApi(),
      tableId: '010.px',
    }).fetch();
    expect(dataset.date).toBe('2026-09-30');
    expect(dataset.total.counts).toEqual({ petrol: 60, diesel: 0, bev: 30, phev: 10, other: 0 });
    expect(dataset.total.age).toEqual({ cars: 100, years: 40 * 67 + 50 * 6 });
    expect(dataset.areas.map((a) => [a.id, a.kind])).toEqual([
      ['005', 'municipality'],
      ['020', 'municipality'],
      ['abroad', 'abroad'],
      ['unknown', 'unknown'],
    ]);
    expect(dataset.makes.map((m) => [m.id, m.kind])).toEqual([
      ['audi', 'make'],
      ['muut-merkit-yhteensa', 'others'],
      ['matkailuautot-yhteensa', 'motorhomes'],
    ]);
    expect(dataset.cells).toHaveLength(6);
    expect(dataset.cells[0]).toEqual({
      area: '005',
      make: 'audi',
      counts: { petrol: 18, diesel: 0, bev: 9, phev: 3, other: 0 },
    });
    expect(rawFiles.map((f) => f.path)).toEqual([
      'fleet-areas.json',
      'fleet-makes.json',
      'fleet-ages.json',
      'fleet-cells-1.json',
    ]);
    expect(() => validateFleet(dataset)).toThrow(/fewer than/);
  });

  it('puts the answers to several requests together, and keeps each one as a raw file', async () => {
    // Two municipalities and four fuels make eight cells a make, so one make fits a request.
    const { dataset, rawFiles } = await new TraficomFleetAdapter({
      client: fakeApi(),
      tableId: '010.px',
      cellsPerRequest: 8,
    }).fetch();
    expect(dataset.cells).toHaveLength(6);
    const pairs = dataset.cells.map((c) => `${c.area} ${c.make}`).sort();
    expect(pairs).toEqual([
      '005 audi',
      '005 matkailuautot-yhteensa',
      '005 muut-merkit-yhteensa',
      '020 audi',
      '020 matkailuautot-yhteensa',
      '020 muut-merkit-yhteensa',
    ]);
    expect(rawFiles.map((f) => f.path).slice(3)).toEqual([
      'fleet-cells-1.json',
      'fleet-cells-2.json',
      'fleet-cells-3.json',
    ]);
  });

  it('fails on a fuel class it does not know and on a title without a day', async () => {
    const unknown = new TraficomFleetAdapter({
      client: fakeApi({ fuels: [...FUELS, '99'] }),
      tableId: '010.px',
    });
    await expect(unknown.fetch()).rejects.toThrow(/Unmapped fuel codes in source: 99/);
    const untitled = new TraficomFleetAdapter({
      client: fakeApi({ title: 'Cars' }),
      tableId: '010.px',
    });
    await expect(untitled.fetch()).rejects.toThrow(/names no day/);
  });
});

const spread = (total: number): GroupCounts => ({
  ...emptyGroupCounts(),
  petrol: total,
});

const MUNICIPALITIES = 260;
const MAKE_COUNT = 50;
const TOTAL = MUNICIPALITIES * 10_000;

/** A dataset big enough to pass validation: 260 municipalities and 50 makes that share the cars. */
function dataset(over: Partial<FleetDataset> = {}): FleetDataset {
  const areas: FleetArea[] = Array.from({ length: MUNICIPALITIES }, (_, i) => ({
    id: String(i).padStart(3, '0'),
    name: `Kunta ${i}`,
    kind: 'municipality',
    counts: spread(TOTAL / MUNICIPALITIES),
  }));
  const makes: FleetMake[] = Array.from({ length: MAKE_COUNT }, (_, i) => {
    // the first makes take the remainder, so the shares add up to the total exactly
    const cars = Math.floor(TOTAL / MAKE_COUNT) + (i < TOTAL % MAKE_COUNT ? 1 : 0);
    return {
      id: `make-${i}`,
      name: `Make ${i}`,
      kind: 'make',
      counts: spread(cars),
      age: { cars, years: cars * 10 },
    };
  });
  // Each municipality has the same cars of every make, so the makes add up to the municipality.
  const each = TOTAL / MUNICIPALITIES / MAKE_COUNT;
  const cells: FleetCell[] = areas.flatMap((area) =>
    makes.map((make) => ({ area: area.id, make: make.id, counts: spread(each) })),
  );
  return {
    sourceId: 's',
    sourceName: 'name',
    sourceUrl: 'https://example.org',
    licence: 'CC BY 4.0',
    sourceVersion: 'v1',
    sourceUpdated: 'v1',
    date: '2026-09-30',
    total: { counts: spread(TOTAL), age: { cars: TOTAL, years: TOTAL * 10 } },
    areas,
    makes,
    cells,
    ...over,
  };
}

describe('validateFleet', () => {
  it('accepts a complete snapshot', () => {
    expect(() => validateFleet(dataset())).not.toThrow();
  });

  it('rejects a day that is not the last day of a quarter', () => {
    expect(() => validateFleet(dataset({ date: '2026-09-29' }))).toThrow(/last day of a month/);
    expect(() => validateFleet(dataset({ date: '2026-10-31' }))).toThrow(/of a quarter/);
  });

  it('rejects areas or makes that do not add up to the total', () => {
    const areas = dataset();
    areas.areas[0]!.counts.petrol += 1;
    expect(() => validateFleet(areas)).toThrow(/areas add up/);
    const makes = dataset();
    makes.makes[0]!.counts.bev += 1;
    expect(() => validateFleet(makes)).toThrow(/makes add up/);
  });

  it('rejects ages that do not cover the cars, repeated ids and a thin list', () => {
    const ages = dataset();
    ages.makes[0]!.age.cars -= 1;
    expect(() => validateFleet(ages)).toThrow(/with an age/);
    const repeated = dataset();
    repeated.makes[1]!.id = repeated.makes[0]!.id;
    expect(() => validateFleet(repeated)).toThrow(/repeated ids/);
    const thin = dataset();
    thin.makes = thin.makes.slice(0, 10);
    expect(() => validateFleet(thin)).toThrow(/fewer than 50 makes/);
  });

  it('rejects an implausible total and a count that is not whole', () => {
    const wild = dataset();
    wild.total.counts = spread(24);
    expect(() => validateFleet(wild)).toThrow(/implausible/);
    const half = dataset();
    half.total.counts.other = -1;
    expect(() => validateFleet(half)).toThrow(/whole number/);
  });

  it('rejects cells of an unknown make, and repeated cells', () => {
    const unknown = dataset();
    unknown.cells[0]!.make = 'nobody';
    expect(() => validateFleet(unknown)).toThrow(/unknown area or make/);
    const repeated = dataset();
    repeated.cells[1] = { ...repeated.cells[0]! };
    expect(() => validateFleet(repeated)).toThrow(/repeated cells/);
  });

  it('rejects a municipality whose makes do not add up to its cars', () => {
    const short = dataset();
    short.cells[0]!.counts.petrol -= 1;
    expect(() => validateFleet(short)).toThrow(/municipality 000 do not add up/);
  });

  it('rejects a municipality that has cars but no cells at all', () => {
    const missing = dataset();
    missing.cells = missing.cells.filter((c) => c.area !== '000');
    expect(() => validateFleet(missing)).toThrow(/municipality 000 do not add up/);
  });

  it('rejects a make with more cars in its municipalities than in all', () => {
    const many = dataset();
    many.makes[5]!.counts.petrol = 1;
    expect(() => validateFleet(many)).toThrow(/more cars in its municipalities/);
  });

  it('rejects a thin list of cells and a cell that is not a whole number', () => {
    const thin = dataset();
    thin.cells = thin.cells.slice(0, 100);
    expect(() => validateFleet(thin)).toThrow(/fewer than 5000 cells/);
    const half = dataset();
    half.cells[0]!.counts.other = 0.5;
    expect(() => validateFleet(half)).toThrow(/cell count is not a whole number/);
  });

  it('adds the groups up through sumCounts', () => {
    expect(sumCounts(dataset().total.counts)).toBe(TOTAL);
  });
});

describe('car fleet pipeline', () => {
  const adapter: SourceAdapter<FleetDataset> = {
    id: 'fake',
    getVersion: async () => 'v1',
    fetch: async () => ({ dataset: dataset(), rawFiles: [] }),
  };

  it('publishes its files under its own prefix, pointer last, and skips an unchanged source', async () => {
    const published = new MemoryStore();
    const run = () =>
      runPipeline(fleetPipeline(adapter), {
        rawStore: new PrefixedStore(new MemoryStore(), 'fleet/'),
        publishedStore: new PrefixedStore(published, 'fleet/'),
        logger: silentLogger,
      });
    expect((await run()).status).toBe('published');
    const keys = [...published.files.keys()];
    expect(keys.at(-1)).toBe(`fleet/${LATEST_POINTER_PATH}`);
    expect(keys.some((k) => k.endsWith('/fleet.json'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/fleet-cells.json'))).toBe(true);
    expect((await run()).status).toBe('skipped');
  });

  it('builds a release whose files name their own release id and the day counted', () => {
    const release = buildFleetRelease(dataset(), new Date('2026-11-10T08:00:00Z'));
    expect(release.id).toBe('20261110T080000Z');
    const [fleet, cells] = release.files.map((file) => JSON.parse(file.body));
    expect(fleet).toMatchObject({ release: release.id, date: '2026-09-30' });
    expect(cells).toMatchObject({ release: release.id, date: '2026-09-30' });
  });

  it('publishes cells that decode to the cells of the dataset', () => {
    const source = dataset();
    const release = buildFleetRelease(source, new Date('2026-11-10T08:00:00Z'));
    const file = JSON.parse(release.files[1]!.body) as CarFleetCells;
    const byKey = (a: FleetCell, b: FleetCell) =>
      `${a.area} ${a.make}`.localeCompare(`${b.area} ${b.make}`);
    expect(decodeCells(file).sort(byKey)).toEqual([...source.cells].sort(byKey));
  });
});
