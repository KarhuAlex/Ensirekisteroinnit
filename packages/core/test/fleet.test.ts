import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../src/types.js';
import { decodeCells, emptyGroupCounts, encodeCells, type FleetCell } from '../src/fleet.js';

const cell = (area: string, make: string, bev: number, petrol = 0): FleetCell => ({
  area,
  make,
  counts: { ...emptyGroupCounts(), bev, petrol },
});
const head = { schemaVersion: SCHEMA_VERSION, release: 'r', date: '2026-09-30' };

describe('fleet cells', () => {
  const cells = [
    cell('020', 'make-b', 3, 40),
    cell('005', 'make-a', 1),
    cell('005', 'make-b', 2, 5),
  ];

  it('keeps one entry per cell in parallel arrays, in an order of its own', () => {
    const file = encodeCells(cells, head);
    expect(file.areas).toEqual(['005', '020']);
    expect(file.makes).toEqual(['make-a', 'make-b']);
    expect(file.area).toEqual([0, 0, 1]);
    expect(file.make).toEqual([0, 1, 1]);
    expect(file.counts.bev).toEqual([1, 2, 3]);
    expect(file.counts.petrol).toEqual([0, 5, 40]);
  });

  it('is decoded back into the same cells', () => {
    expect(decodeCells(encodeCells(cells, head))).toEqual([cells[1], cells[2], cells[0]]);
  });

  it('is the same file whatever order the source gave the cells in', () => {
    expect(encodeCells([...cells].reverse(), head)).toEqual(encodeCells(cells, head));
  });

  it('is an empty file for no cells', () => {
    expect(decodeCells(encodeCells([], head))).toEqual([]);
  });
});
