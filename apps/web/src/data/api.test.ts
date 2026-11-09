import { SCHEMA_VERSION, type Matrix } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { checkMatrixMonths } from './api';

const matrix = (months: string[]): Matrix => ({
  schemaVersion: SCHEMA_VERSION,
  months,
  groups: [],
  rows: [],
});

describe('checkMatrixMonths', () => {
  it('accepts a matrix with the manifest months', () => {
    const m = matrix(['2025-01', '2025-02']);
    expect(checkMatrixMonths(m, ['2025-01', '2025-02'])).toBe(m);
  });

  it('rejects a matrix with other months or a different count', () => {
    expect(() => checkMatrixMonths(matrix(['2025-01']), ['2025-01', '2025-02'])).toThrow();
    expect(() =>
      checkMatrixMonths(matrix(['2025-01', '2025-03']), ['2025-01', '2025-02']),
    ).toThrow();
  });
});
