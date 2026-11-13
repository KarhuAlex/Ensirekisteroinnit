import {
  emptyGroupCounts,
  encodeCells,
  FLEET_FORMAT,
  FUEL_GROUP_IDS,
  monthEndDate,
  SCHEMA_VERSION,
  sumCounts,
  type CarFleet,
  type CarFleetCells,
  type FleetCell,
  type FleetDataset,
  type GroupCounts,
} from '@regs/core';
import type { SourceAdapter } from '../adapters/types.js';
import type { Pipeline, PublishableRelease } from './pipeline.js';
import { releaseIdFor } from './release.js';
import { STOCK_TOTAL_RANGE } from './stock.js';

/** Finland has some 290 municipalities and the table lists about 100 makes. */
const MIN_MUNICIPALITIES = 250;
const MIN_MAKES = 50;
/** The table has about 17 000 pairs of a municipality and a make that have cars. */
const MIN_CELLS = 5_000;
const QUARTER_END_MONTHS = ['03', '06', '09', '12'];

const isWholeCount = (count: number): boolean => Number.isInteger(count) && count >= 0;

function dayProblems(date: string): string[] {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && monthEndDate(date.slice(0, 7)) === date;
  if (!valid) return [`"${date}" is not the last day of a month`];
  return QUARTER_END_MONTHS.includes(date.slice(5, 7))
    ? []
    : [`${date} is not the last day of a quarter`];
}

/** The rows' counts, group by group, must add up to the total exactly. */
function sumProblems(what: string, rows: readonly GroupCounts[], total: GroupCounts): string[] {
  return FUEL_GROUP_IDS.flatMap((group) => {
    const sum = rows.reduce((a, row) => a + row[group], 0);
    return sum === total[group]
      ? []
      : [`the ${what} add up to ${sum} ${group} cars, the total is ${total[group]}`];
  });
}

function duplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) repeated.push(id);
    seen.add(id);
  }
  return repeated;
}

/** The counts: whole numbers, a plausible total, and groups that add up everywhere. */
function countProblems({ total, areas, makes }: FleetDataset): string[] {
  const all = sumCounts(total.counts);
  const rows = [total.counts, ...areas.map((a) => a.counts), ...makes.map((m) => m.counts)];
  const problems: string[] = [];
  if (rows.some((row) => FUEL_GROUP_IDS.some((group) => !isWholeCount(row[group])))) {
    problems.push('a count is not a whole number of cars');
  }
  if (all < STOCK_TOTAL_RANGE.min || all > STOCK_TOTAL_RANGE.max) {
    problems.push(`total ${all} is implausible`);
  }
  problems.push(
    ...sumProblems(
      'areas',
      areas.map((a) => a.counts),
      total.counts,
    ),
    ...sumProblems(
      'makes',
      makes.map((m) => m.counts),
      total.counts,
    ),
  );
  if (total.age.cars !== all || makes.reduce((a, m) => a + m.age.cars, 0) !== all) {
    problems.push('the cars with an age do not add up to the total');
  }
  return problems;
}

/** The lists: about as many municipalities and makes as there should be, each id once. */
function listProblems({ areas, makes }: FleetDataset): string[] {
  const problems: string[] = [];
  if (areas.filter((a) => a.kind === 'municipality').length < MIN_MUNICIPALITIES) {
    problems.push(`fewer than ${MIN_MUNICIPALITIES} municipalities`);
  }
  if (makes.length < MIN_MAKES) problems.push(`fewer than ${MIN_MAKES} makes`);
  const repeated = [
    ...duplicateIds(areas.map((a) => a.id)),
    ...duplicateIds(makes.map((m) => m.id)),
  ];
  if (repeated.length > 0) problems.push(`repeated ids: ${repeated.join(', ')}`);
  return problems;
}

/** Adds the cells of each key up, group by group. */
function addUp(cells: readonly FleetCell[], keyOf: (cell: FleetCell) => string) {
  const sums = new Map<string, GroupCounts>();
  for (const cell of cells) {
    const sum = sums.get(keyOf(cell)) ?? emptyGroupCounts();
    for (const group of FUEL_GROUP_IDS) sum[group] += cell.counts[group];
    sums.set(keyOf(cell), sum);
  }
  return sums;
}

/** Cells of a municipality or make that the lists do not have, and cells that are not whole. */
function cellListProblems(
  cells: readonly FleetCell[],
  municipalities: ReadonlyMap<string, GroupCounts>,
  makes: ReadonlyMap<string, GroupCounts>,
): string[] {
  const problems: string[] = [];
  if (cells.length < MIN_CELLS) problems.push(`fewer than ${MIN_CELLS} cells`);
  const unknown = cells.filter((c) => !municipalities.has(c.area) || !makes.has(c.make));
  if (unknown.length > 0) problems.push(`${unknown.length} cells of an unknown area or make`);
  const repeated = duplicateIds(cells.map((c) => `${c.area} ${c.make}`));
  if (repeated.length > 0) problems.push(`repeated cells: ${repeated.slice(0, 3).join(', ')}`);
  if (cells.some((c) => FUEL_GROUP_IDS.some((group) => !isWholeCount(c.counts[group])))) {
    problems.push('a cell count is not a whole number of cars');
  }
  return problems;
}

/** The makes of every municipality add up to its cars; one with no cells at all is found too. */
function municipalityProblems(
  cells: readonly FleetCell[],
  municipalities: ReadonlyMap<string, GroupCounts>,
): string[] {
  const madeOf = addUp(cells, (c) => c.area);
  return [...municipalities].flatMap(([id, total]) => {
    const counts = madeOf.get(id) ?? emptyGroupCounts();
    return FUEL_GROUP_IDS.some((group) => counts[group] !== total[group])
      ? [`the makes of municipality ${id} do not add up to its cars`]
      : [];
  });
}

/** No make has more cars in its municipalities than it has in all; some are abroad or unplaced. */
function makeProblems(cells: readonly FleetCell[], makes: ReadonlyMap<string, GroupCounts>) {
  return [...addUp(cells, (c) => c.make)].flatMap(([id, counts]) => {
    const total = makes.get(id);
    return total && FUEL_GROUP_IDS.some((group) => counts[group] > total[group])
      ? [`the make ${id} has more cars in its municipalities than in all`]
      : [];
  });
}

function cellProblems({ areas, makes, cells }: FleetDataset): string[] {
  const municipalities = new Map(
    areas.filter((a) => a.kind === 'municipality').map((a) => [a.id, a.counts]),
  );
  const makeCounts = new Map(makes.map((m) => [m.id, m.counts]));
  return [
    ...cellListProblems(cells, municipalities, makeCounts),
    ...municipalityProblems(cells, municipalities),
    ...makeProblems(cells, makeCounts),
  ];
}

export const fleetProblems = (dataset: FleetDataset): string[] => [
  ...dayProblems(dataset.date),
  ...listProblems(dataset),
  ...countProblems(dataset),
  ...cellProblems(dataset),
];

/** A failed check aborts the run, so the previous release keeps being served. */
export function validateFleet(dataset: FleetDataset): void {
  const problems = fleetProblems(dataset);
  if (problems.length > 0) throw new Error(`Car fleet failed validation: ${problems.join('; ')}`);
}

export function buildFleetRelease(dataset: FleetDataset, now: Date): PublishableRelease {
  const id = releaseIdFor(now);
  const generatedAt = now.toISOString();
  const fleet: CarFleet = {
    schemaVersion: SCHEMA_VERSION,
    release: id,
    generatedAt,
    source: {
      id: dataset.sourceId,
      name: dataset.sourceName,
      url: dataset.sourceUrl,
      licence: dataset.licence,
      updated: dataset.sourceUpdated,
    },
    date: dataset.date,
    total: dataset.total,
    areas: dataset.areas,
    makes: dataset.makes,
  };
  const cells: CarFleetCells = encodeCells(dataset.cells, {
    schemaVersion: SCHEMA_VERSION,
    release: id,
    date: dataset.date,
  });
  return {
    id,
    generatedAt,
    files: [
      { path: 'fleet.json', body: JSON.stringify(fleet) },
      { path: 'fleet-cells.json', body: JSON.stringify(cells) },
    ],
  };
}

export function fleetPipeline(adapter: SourceAdapter<FleetDataset>): Pipeline<FleetDataset> {
  return {
    name: 'car fleet',
    format: FLEET_FORMAT,
    adapter,
    validate: validateFleet,
    build: buildFleetRelease,
    sourceVersionOf: (dataset) => dataset.sourceVersion,
  };
}
