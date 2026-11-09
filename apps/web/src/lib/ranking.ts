import {
  matrixSum,
  TOTAL_ENTITY_ID,
  type FuelGroupId,
  type Matrix,
  type MatrixRow,
} from '@regs/core';
import { MONTHS_PER_YEAR } from './stats';

/** Inclusive indexes into the matrix's months. */
export interface MonthRange {
  from: number;
  to: number;
}

export type CompareMode = 'none' | 'previous' | 'yearAgo';

/** Percentage changes are not shown when the comparison period has fewer registrations than this. */
export const MIN_BASE = 10;

export const rangeLength = (range: MonthRange): number => range.to - range.from + 1;

export const sameRange = (a: MonthRange, b: MonthRange): boolean =>
  a.from === b.from && a.to === b.to;

export function shiftRange(range: MonthRange, by: number, monthCount: number): MonthRange | null {
  const from = range.from + by;
  const to = range.to + by;
  return from < 0 || to >= monthCount ? null : { from, to };
}

/** A year earlier only applies to spans of up to a year, since longer ones would overlap themselves. */
export function comparisonRange(
  range: MonthRange,
  mode: CompareMode,
  monthCount: number,
): MonthRange | null {
  if (mode === 'none') return null;
  if (mode === 'previous') return shiftRange(range, -rangeLength(range), monthCount);
  return rangeLength(range) > MONTHS_PER_YEAR
    ? null
    : shiftRange(range, -MONTHS_PER_YEAR, monthCount);
}

export interface RankQuery {
  range: MonthRange;
  fuels: readonly FuelGroupId[];
  compare: CompareMode;
  /** Selects which rows take part, such as makes or models. */
  include: (id: string) => boolean;
}

export interface RankedRow {
  id: string;
  /** Ties share a rank. */
  rank: number;
  count: number;
  /** Of all registrations in the period, counting the same fuels. */
  share: number | null;
  /** Ignores the fuel filter. */
  mix: Record<FuelGroupId, number>;
  previous: number | null;
}

export interface NamedRow extends RankedRow {
  name: string;
  make: string;
}

export interface Ranking {
  rows: RankedRow[];
  total: number;
  previousTotal: number | null;
  comparison: MonthRange | null;
}

export function rankEntities(matrix: Matrix, query: RankQuery): Ranking {
  const monthCount = matrix.months.length;
  const groupIndex = (group: FuelGroupId) => matrix.groups.indexOf(group);
  const selected = query.fuels.map(groupIndex).filter((i) => i >= 0);
  const comparison = comparisonRange(query.range, query.compare, monthCount);

  const count = (row: MatrixRow, range: MonthRange) =>
    selected.reduce((sum, g) => sum + matrixSum(row, g, monthCount, range.from, range.to), 0);

  const totalRow = matrix.rows.find((row) => row.id === TOTAL_ENTITY_ID);
  const total = totalRow ? count(totalRow, query.range) : 0;
  const previousTotal = totalRow && comparison ? count(totalRow, comparison) : null;

  const rows = matrix.rows
    .filter((row) => row.id !== TOTAL_ENTITY_ID && query.include(row.id))
    .map((row) => ({ row, count: count(row, query.range) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || (a.row.id < b.row.id ? -1 : 1));

  const ranked: RankedRow[] = [];
  rows.forEach(({ row, count: n }, i) => {
    const mix = Object.fromEntries(
      matrix.groups.map((group, g) => [
        group,
        matrixSum(row, g, monthCount, query.range.from, query.range.to),
      ]),
    ) as Record<FuelGroupId, number>;
    ranked.push({
      id: row.id,
      rank: i > 0 && rows[i - 1]!.count === n ? ranked[i - 1]!.rank : i + 1,
      count: n,
      share: total > 0 ? (n / total) * 100 : null,
      mix,
      previous: comparison ? count(row, comparison) : null,
    });
  });

  return { rows: ranked, total, previousTotal, comparison };
}

export interface Change {
  delta: number;
  /** Null when the base is below `MIN_BASE`. */
  percent: number | null;
}

export function changeOf(count: number, previous: number | null): Change | null {
  if (previous === null) return null;
  return {
    delta: count - previous,
    percent: previous >= MIN_BASE ? ((count - previous) / previous) * 100 : null,
  };
}
