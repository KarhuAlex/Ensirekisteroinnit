import type { GroupedSeries } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { summarizeElectrification } from './electrification';

/** 26 months, 100 registrations each; electric grows by one car per month. */
function growingElectric(months = 26): { grouped: GroupedSeries; totals: number[] } {
  const bev = Array.from({ length: months }, (_, i) => i);
  const totals = new Array<number>(months).fill(100);
  const zeros = new Array<number>(months).fill(0);
  return {
    grouped: {
      bev,
      phev: [...zeros],
      petrol: totals.map((t, i) => t - (bev[i] ?? 0)),
      diesel: [...zeros],
      other: [...zeros],
    },
    totals,
  };
}

describe('summarizeElectrification', () => {
  const { grouped, totals } = growingElectric();
  const summary = summarizeElectrification(grouped, totals);

  it('reports the latest month and its change over a year', () => {
    expect(summary.regsNow).toBe(100);
    expect(summary.regsDelta).toBe(0);
    expect(summary.bevNow).toBe(25);
    expect(summary.bevDelta).toBe(12);
  });

  it('splits the latest month between the fuel groups', () => {
    expect(summary.mixNow).toEqual({ bev: 25, phev: 0, petrol: 75, diesel: 0, other: 0 });
  });

  it('compares the last 12 months with the 12 before', () => {
    // months 14..25 average 19.5 electric, months 2..13 average 7.5
    expect(summary.bev12).toBeCloseTo(19.5);
    expect(summary.bev12Delta).toBeCloseTo(12);
  });

  it('adds plug-in hybrids to the plug-in share', () => {
    const withHybrids = { ...grouped, phev: grouped.bev.map(() => 10) };
    expect(summarizeElectrification(withHybrids, totals).plug12).toBeCloseTo(29.5);
  });

  it('leaves year-over-year figures empty when history is too short', () => {
    const short = growingElectric(6);
    const result = summarizeElectrification(short.grouped, short.totals);
    expect(result.regsDelta).toBeNull();
    expect(result.bevDelta).toBeNull();
    expect(result.bev12Delta).toBeNull();
  });

  it('produces rolling series aligned with the months', () => {
    expect(summary.bevSeries).toHaveLength(26);
    expect(summary.bevSeries[10]).toBeNull();
    expect(summary.bevSeries[25]).toBeCloseTo(19.5);
  });
});
