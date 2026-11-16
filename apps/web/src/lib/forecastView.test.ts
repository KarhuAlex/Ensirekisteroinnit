import { describe, expect, it } from 'vitest';
import { CEILINGS, DEFAULT_MODEL, MAX_HORIZON, MIN_HISTORY } from './forecast';
import {
  buildScenario,
  ceilingParam,
  chartSeries,
  monthsAfter,
  padTo,
  parseCeiling,
  pastScenarios,
  reachOf,
  shareHistory,
  type ShareHistory,
} from './forecastView';

const expit = (x: number) => 1 / (1 + Math.exp(-x));

/** Months from 2023-01 on with a share that follows a logistic curve. */
function history(count: number, perMonth = 0.08): ShareHistory {
  return {
    months: monthsAfter('2022-12', count),
    shares: Array.from({ length: count }, (_, i) => expit(-4 + perMonth * i) * 100),
  };
}

describe('monthsAfter', () => {
  it('gives the months after a month, across a change of year', () => {
    expect(monthsAfter('2026-10', 4)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('is none for none, and goes on for years', () => {
    expect(monthsAfter('2026-10', 0)).toEqual([]);
    expect(monthsAfter('2026-12', 25).at(-1)).toBe('2029-01');
  });
});

describe('parseCeiling and ceilingParam', () => {
  it('knows the ceilings that are offered, by their percent', () => {
    for (const ceiling of CEILINGS) {
      expect(parseCeiling(String(Math.round(ceiling * 100)))).toBe(ceiling);
    }
  });

  it('falls back to the default for anything else', () => {
    expect(parseCeiling(null)).toBe(DEFAULT_MODEL.ceiling);
    expect(parseCeiling('55')).toBe(DEFAULT_MODEL.ceiling);
    expect(parseCeiling('high')).toBe(DEFAULT_MODEL.ceiling);
  });

  it('leaves the default out of the address and round-trips the others', () => {
    expect(ceilingParam(DEFAULT_MODEL.ceiling)).toBeNull();
    expect(parseCeiling(ceilingParam(0.7))).toBe(0.7);
    expect(ceilingParam(0.85)).toBe('85');
  });
});

describe('shareHistory', () => {
  it('keeps the months that have a share, with their shares', () => {
    expect(shareHistory(['2026-01', '2026-02', '2026-03'], [null, 4, 5.5])).toEqual({
      months: ['2026-02', '2026-03'],
      shares: [4, 5.5],
    });
  });
});

describe('buildScenario', () => {
  it('has a path and a band for every month of the horizon, and names those months', () => {
    const scenario = buildScenario(history(48), 1);
    expect(scenario?.futureMonths).toHaveLength(MAX_HORIZON);
    expect(scenario?.futureMonths[0]).toBe('2027-01');
    expect(scenario?.forecast.path).toHaveLength(MAX_HORIZON);
    expect(scenario?.ceiling).toBe(1);
  });

  it('has nothing to say with too little history', () => {
    expect(buildScenario(history(MIN_HISTORY - 1), 1)).toBeNull();
  });

  it('has nothing to say where there are too few past errors for a band', () => {
    expect(buildScenario(history(MIN_HISTORY + 8), 1)).toBeNull();
  });

  it('has a lower scenario for a lower ceiling', () => {
    const high = buildScenario(history(48), 1);
    const low = buildScenario(history(48), 0.7);
    expect(low?.forecast.path[35]).toBeLessThan(high?.forecast.path[35] as number);
  });
});

describe('reachOf', () => {
  it('names the earliest month by the upper edge and the latest by the lower', () => {
    const scenario = buildScenario(history(60, 0.15), 1);
    const reach = reachOf(scenario!, 50);
    expect(reach.kind).toBe('window');
    if (reach.kind !== 'window') return;
    expect(reach.earliest <= (reach.latest ?? '9999-99')).toBe(true);
    expect(scenario?.futureMonths).toContain(reach.earliest);
  });

  it('has none where even the upper edge does not get there within the horizon', () => {
    expect(reachOf(buildScenario(history(48), 0.7)!, 90)).toEqual({ kind: 'none' });
  });

  it('has no latest month where the lower edge does not get there', () => {
    const scenario = buildScenario(history(48), 1);
    const reach = reachOf(scenario!, 85);
    if (reach.kind === 'window') expect(reach.latest).toBeNull();
  });
});

describe('pastScenarios', () => {
  it('makes a forecast from each of the months back, running up to the latest month', () => {
    const h = history(60);
    const past = pastScenarios(h, [24, 12], 1);
    expect(past.map((p) => p.origin)).toEqual([h.months[35], h.months[47]]);
    for (const p of past) {
      expect(p.values).toHaveLength(h.shares.length);
      expect(p.values[p.values.length - 1]).not.toBeNull();
    }
  });

  it('has no value up to and including the month it was made from', () => {
    const h = history(60);
    const [past] = pastScenarios(h, [12], 1);
    const origin = h.months.indexOf(past!.origin);
    expect(past!.values.slice(0, origin + 1).every((v) => v === null)).toBe(true);
    expect(past!.values[origin + 1]).not.toBeNull();
  });

  it('leaves out a distance back that leaves too little history to make it from', () => {
    const h = history(30);
    expect(pastScenarios(h, [36, 24, 12], 1).map((p) => p.origin)).toEqual([h.months[17]]);
  });
});

describe('chartSeries', () => {
  const h = history(30);

  it('has the facts and then nothing for the months of the scenario', () => {
    const scenario = buildScenario(h, 1)!;
    const series = chartSeries(h, scenario);
    expect(series.months).toHaveLength(30 + MAX_HORIZON);
    expect(series.actual.slice(0, 30)).toEqual(h.shares);
    expect(series.actual.slice(30).every((v) => v === null)).toBe(true);
  });

  it('starts the scenario and its band from the last fact, so the lines meet', () => {
    const scenario = buildScenario(h, 1)!;
    const series = chartSeries(h, scenario);
    const last = h.shares[29];
    for (const edge of [series.path, series.low, series.high]) {
      expect(edge.slice(0, 29).every((v) => v === null)).toBe(true);
      expect(edge[29]).toBe(last);
    }
    expect(series.path[30]).toBe(scenario.forecast.path[0]);
    expect(series.high.at(-1)).toBe(scenario.forecast.high.at(-1));
  });

  it('is the facts alone, with empty lines, where there is no scenario', () => {
    const series = chartSeries(h, null);
    expect(series.months).toEqual(h.months);
    expect(series.path.every((v) => v === null)).toBe(true);
    expect(series.path).toHaveLength(30);
  });
});

describe('padTo', () => {
  it('adds empty months at the end up to the length', () => {
    expect(padTo([1, 2], 4)).toEqual([1, 2, null, null]);
    expect(padTo([1, 2, 3], 2)).toEqual([1, 2, 3]);
  });
});
