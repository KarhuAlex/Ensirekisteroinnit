import { FUEL_GROUP_IDS, SCHEMA_VERSION, type Matrix } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { compareSeries, metricUnit, SERIES_SLOTS, seriesSlots, summarize } from './comparison';

const MONTHS = 14;

/** A row from the electric and petrol cars registered each month. */
function row(id: string, bev: number[], petrol: number[]) {
  const counts = new Array<number>(FUEL_GROUP_IDS.length * MONTHS).fill(0);
  FUEL_GROUP_IDS.forEach((group, g) => {
    const source = group === 'bev' ? bev : group === 'petrol' ? petrol : [];
    source.forEach((count, m) => (counts[g * MONTHS + m] = count));
  });
  return { id, counts };
}

const fill = (value: number, from = 0) =>
  Array.from({ length: MONTHS }, (_, m) => (m >= from ? value : 0));

const matrix: Matrix = {
  schemaVersion: SCHEMA_VERSION,
  months: Array.from({ length: MONTHS }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`),
  groups: [...FUEL_GROUP_IDS],
  rows: [
    row('total', fill(10), fill(90)), // 100 a month
    row('steady', fill(5), fill(5)), // 10 a month, half electric
    row('late', fill(30, 2), fill(0)), // 30 a month from March, all electric
    row('tiny', fill(1), fill(0)), // 1 a month, 12 in a year: too few for a share
  ],
};

const valuesOf = (id: string, metric: Parameters<typeof compareSeries>[2]) =>
  compareSeries(matrix, [id], metric)[0]!.values;

describe('compareSeries', () => {
  it('counts registrations a month, and leaves out the months before the first one', () => {
    expect(valuesOf('steady', 'monthly')).toEqual(fill(10));
    const late = valuesOf('late', 'monthly');
    expect(late.slice(0, 2)).toEqual([null, null]);
    expect(late[2]).toBe(30);
  });

  it('sums the last 12 months, so a new model grows into it', () => {
    const late = valuesOf('late', 'rolling');
    expect(late[2]).toBe(30);
    expect(late[3]).toBe(60);
    expect(late[13]).toBe(360);
    expect(valuesOf('steady', 'rolling')[13]).toBe(120);
  });

  it('gives the share of all new cars once there is a full year of months', () => {
    const share = valuesOf('steady', 'share');
    expect(share[10]).toBeNull();
    expect(share[11]).toBeCloseTo(10);
  });

  it('gives the electric share of its own registrations', () => {
    expect(valuesOf('steady', 'bevShare')[13]).toBeCloseTo(50);
    expect(valuesOf('late', 'bevShare')[13]).toBeCloseTo(100);
  });

  it('leaves the electric share out where it rests on too few cars', () => {
    expect(valuesOf('tiny', 'bevShare')[13]).toBeNull();
  });

  it('skips an id the matrix does not have, and keeps the order of the rest', () => {
    const series = compareSeries(matrix, ['late', 'nobody', 'steady'], 'monthly');
    expect(series.map((s) => s.id)).toEqual(['late', 'steady']);
  });
});

describe('metricUnit', () => {
  it('is a percentage for the shares and a count otherwise', () => {
    expect(metricUnit('share')).toBe('pct');
    expect(metricUnit('bevShare')).toBe('pct');
    expect(metricUnit('rolling')).toBe('count');
    expect(metricUnit('monthly')).toBe('count');
  });
});

describe('compareSeries on a matrix that is not right', () => {
  it('fails loudly without a row for all cars, which every share is a share of', () => {
    const noTotal: Matrix = { ...matrix, rows: matrix.rows.filter((r) => r.id !== 'total') };
    expect(() => compareSeries(noTotal, ['steady'], 'monthly')).toThrow(/all cars/);
  });

  it('fails loudly without the battery-electric group', () => {
    const noBev: Matrix = { ...matrix, groups: matrix.groups.filter((g) => g !== 'bev') };
    expect(() => compareSeries(noBev, ['steady'], 'monthly')).toThrow(/battery-electric/);
  });

  it('gives the same answer when asked again for the same matrix', () => {
    const again = compareSeries(matrix, ['steady', 'late'], 'share');
    expect(compareSeries(matrix, ['steady', 'late'], 'share')).toEqual(again);
  });
});

describe('seriesSlots', () => {
  const ids = ['volkswagen', 'skoda', 'toyota', 'audi'];

  it('gives every id a slot of its own', () => {
    const slots = [...seriesSlots(ids).values()];
    expect(new Set(slots).size).toBe(ids.length);
    expect(slots.every((slot) => slot >= 0 && slot < SERIES_SLOTS)).toBe(true);
  });

  it('keeps the slot of an id when another one is removed', () => {
    const all = seriesSlots(ids);
    const without = seriesSlots(ids.filter((id) => id !== 'skoda'));
    // An id that did not share its preferred slot with the removed one keeps its slot.
    const kept = ids.filter((id) => id !== 'skoda' && without.get(id) === all.get(id));
    expect(kept.length).toBeGreaterThanOrEqual(2);
  });

  it('is the same for the same ids in any run', () => {
    expect([...seriesSlots(ids)]).toEqual([...seriesSlots(ids)]);
  });
});

describe('summarize', () => {
  const [steady, late] = summarize(matrix, ['steady', 'late']);

  it('gives the last 12 months', () => {
    expect(steady).toMatchObject({ id: 'steady', last12: 120 });
  });

  it('has no figure for a year ago where the thing did not exist yet', () => {
    expect(late!.yearAgo).toBeNull();
  });

  it('gives the share of all cars and the electric share of its own', () => {
    expect(steady!.share).toBeCloseTo(10);
    expect(steady!.bevShare).toBeCloseTo(50);
  });

  it('counts a thing that started late from its first month', () => {
    expect(late).toMatchObject({ id: 'late', last12: 360 });
  });
});
