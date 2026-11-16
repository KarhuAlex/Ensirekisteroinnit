import type { Period } from '@regs/core';
import {
  CEILINGS,
  crossingWindow,
  DEFAULT_MODEL,
  forecast,
  forecastPath,
  MAX_HORIZON,
  MIN_HISTORY,
  type Forecast,
} from './forecast';

/** The shares of the scenario page are of the battery-electric cars among first registrations. */
export const REACH_LEVELS = [60, 70, 80] as const;

/** Which of the ceilings is meant by the address parameter; anything else is no ceiling chosen. */
export function parseCeiling(value: string | null): number {
  const percent = Number(value);
  return CEILINGS.find((ceiling) => Math.round(ceiling * 100) === percent) ?? DEFAULT_MODEL.ceiling;
}

/** The address parameter of a ceiling; the default is left out so the plain page keeps a clean URL. */
export const ceilingParam = (ceiling: number): string | null =>
  ceiling === DEFAULT_MODEL.ceiling ? null : String(Math.round(ceiling * 100));

/** The months after a month, as many as asked for. */
export function monthsAfter(last: Period, count: number): Period[] {
  const year = Number(last.slice(0, 4));
  const month = Number(last.slice(5, 7));
  return Array.from({ length: count }, (_, i) => {
    const index = year * 12 + (month - 1) + i + 1;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
}

/** A share for each of the months that have one: the first months of a rolling share have none. */
export interface ShareHistory {
  months: Period[];
  shares: number[];
}

export function shareHistory(
  months: readonly Period[],
  series: readonly (number | null)[],
): ShareHistory {
  const history: ShareHistory = { months: [], shares: [] };
  months.forEach((month, i) => {
    const share = series[i];
    if (share !== null && share !== undefined) {
      history.months.push(month);
      history.shares.push(share);
    }
  });
  return history;
}

export interface Scenario {
  ceiling: number;
  history: ShareHistory;
  /** The months ahead that the forecast has a value for. */
  futureMonths: Period[];
  forecast: Forecast;
}

/** The scenario for a ceiling; `null` while there is too little history for a path and a band. */
export function buildScenario(history: ShareHistory, ceiling: number): Scenario | null {
  const made = forecast(history.shares, MAX_HORIZON, { ...DEFAULT_MODEL, ceiling });
  if (made.path.length === 0) return null;
  const last = history.months[history.months.length - 1] as Period;
  return { ceiling, history, futureMonths: monthsAfter(last, MAX_HORIZON), forecast: made };
}

/**
 * When a level is reached. `none`: not even by the upper edge of the band within the horizon.
 * `window`: the earliest month, by the upper edge, and the latest, by the lower edge; the latest is
 * `null` when the lower edge does not get there within the horizon, so it may be later still.
 */
export type Reach = { kind: 'none' } | { kind: 'window'; earliest: Period; latest: Period | null };

export function reachOf(scenario: Scenario, level: number): Reach {
  const { earliest, latest } = crossingWindow(scenario.forecast, level);
  if (earliest === null) return { kind: 'none' };
  return {
    kind: 'window',
    earliest: scenario.futureMonths[earliest - 1] as Period,
    latest: latest === null ? null : (scenario.futureMonths[latest - 1] as Period),
  };
}

/** What the method would have said some months ago, from there up to the latest month. */
export interface PastScenario {
  /** The month the forecast was made from. */
  origin: Period;
  /** A value for each month of the history, empty up to and including the origin. */
  values: (number | null)[];
}

/** The forecasts made from each of the given numbers of months back, for the same ceiling. */
export function pastScenarios(
  history: ShareHistory,
  monthsBack: readonly number[],
  ceiling: number,
): PastScenario[] {
  const n = history.shares.length;
  return monthsBack.flatMap((back) => {
    const originIndex = n - 1 - back;
    if (originIndex < MIN_HISTORY - 1) return [];
    const path = forecastPath(history.shares.slice(0, originIndex + 1), back, {
      ...DEFAULT_MODEL,
      ceiling,
    });
    const values = history.shares.map((_, i) =>
      i > originIndex ? (path[i - originIndex - 1] ?? null) : null,
    );
    return [{ origin: history.months[originIndex] as Period, values }];
  });
}

/** The values of a chart of the history, with the scenario after it if there is one. */
export interface ChartSeries {
  months: Period[];
  actual: (number | null)[];
  /** Starts from the last month of the history, so that the line of facts and this one meet. */
  path: (number | null)[];
  low: (number | null)[];
  high: (number | null)[];
}

const nulls = (count: number): null[] => Array.from({ length: count }, () => null);

export function chartSeries(history: ShareHistory, scenario: Scenario | null): ChartSeries {
  const n = history.shares.length;
  const ahead = scenario ? scenario.futureMonths.length : 0;
  const last = history.shares[n - 1] ?? null;
  // The scenario is drawn from the last fact, which is also the start of its band.
  const fromLast = (values: readonly number[] | undefined): (number | null)[] =>
    scenario && values ? [...nulls(n - 1), last, ...values] : nulls(n + ahead);
  return {
    months: [...history.months, ...(scenario?.futureMonths ?? [])],
    actual: [...history.shares, ...nulls(ahead)],
    path: fromLast(scenario?.forecast.path),
    low: fromLast(scenario?.forecast.low),
    high: fromLast(scenario?.forecast.high),
  };
}

/** Values for each month of the history, made to cover the months after it too. */
export const padTo = (values: readonly (number | null)[], length: number): (number | null)[] => [
  ...values,
  ...nulls(Math.max(0, length - values.length)),
];
