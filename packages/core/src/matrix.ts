import type { MatrixRow } from './types.js';

/** Sums one fuel group over the months `from` to `to`, both inclusive. Months outside the data are ignored. */
export function matrixSum(
  row: MatrixRow,
  groupIndex: number,
  monthCount: number,
  from: number,
  to: number,
): number {
  const offset = groupIndex * monthCount;
  let sum = 0;
  for (let m = Math.max(0, from); m <= Math.min(monthCount - 1, to); m++) {
    sum += row.counts[offset + m] ?? 0;
  }
  return sum;
}
